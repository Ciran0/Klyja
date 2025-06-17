// backend/src/auth.rs
use crate::{
    errors::AppError,
    models::{NewSession, NewUser, Session, User},
    schema::{sessions, users},
    DbPool,
};
use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts, Path, Query, State},
    http::{header, request::Parts},
    response::Redirect,
    Json,
};
use axum_extra::extract::{cookie::Cookie, CookieJar};
use chrono::{Duration, NaiveDateTime, Utc};
use diesel::prelude::*;
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, AuthorizationCode, ClientId,
    ClientSecret, CsrfToken, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::env;
use utoipa::ToSchema;

const CSRF_COOKIE_NAME: &str = "klyja_csrf_token";
const SESSION_COOKIE_NAME: &str = "klyja_session_token";

#[derive(Deserialize)]
struct GitHubUser {
    id: u64,
    email: Option<String>,
    name: Option<String>,
    login: String,
}

// --- OAUTH CLIENT SETUP ---

fn github_oauth_client() -> BasicClient {
    let client_id = env::var("GITHUB_CLIENT_ID").expect("Missing GITHUB_CLIENT_ID");
    let client_secret = env::var("GITHUB_CLIENT_SECRET").expect("Missing GITHUB_CLIENT_SECRET");
    let redirect_url = env::var("APP_BASE_URL").unwrap() + "/api/auth/github/callback";

    BasicClient::new(
        ClientId::new(client_id),
        Some(ClientSecret::new(client_secret)),
        AuthUrl::new("https://github.com/login/oauth/authorize".to_string()).unwrap(),
        Some(TokenUrl::new("https://github.com/login/oauth/access_token".to_string()).unwrap()),
    )
    .set_redirect_uri(RedirectUrl::new(redirect_url).unwrap())
}

// --- AUTH HANDLERS ---

pub async fn auth_redirect_handler(
    Path(provider): Path<String>,
    jar: CookieJar,
) -> (CookieJar, Redirect) {
    let (authorize_url, csrf_token) = match provider.as_str() {
        "github" => {
            let client = github_oauth_client();
            client
                .authorize_url(CsrfToken::new_random)
                .add_scope(Scope::new("user:email".to_string()))
                .url()
        }
        _ => panic!("Unsupported provider: {}", provider),
    };

    let cookie = Cookie::build((CSRF_COOKIE_NAME, csrf_token.secret().to_string()))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax);

    (jar.add(cookie), Redirect::to(authorize_url.as_str()))
}

#[derive(Deserialize)]
pub struct AuthCallbackQuery {
    code: String,
    state: String,
}

pub async fn auth_callback_handler(
    Path(provider): Path<String>,
    Query(query): Query<AuthCallbackQuery>,
    State(pool): State<DbPool>,
    jar: CookieJar,
) -> Result<(CookieJar, Redirect), AppError> {
    let csrf_cookie = jar
        .get(CSRF_COOKIE_NAME)
        .ok_or_else(|| AppError::BadRequest("No CSRF token found in cookie".to_string()))?;

    if csrf_cookie.value() != query.state {
        return Err(AppError::BadRequest("CSRF token mismatch".to_string()));
    }

    let token_res = match provider.as_str() {
        "github" => {
            github_oauth_client()
                .exchange_code(AuthorizationCode::new(query.code))
                .request_async(async_http_client)
                .await
        }
        _ => return Err(AppError::BadRequest("Unsupported provider".to_string())),
    }
    .map_err(|e| AppError::Internal(format!("OAuth token exchange failed: {}", e)))?;

    let req_client = reqwest::Client::new();
    let (provider_id, email, display_name) = match provider.as_str() {
        "github" => {
            let user_info: GitHubUser = req_client
                .get("https://api.github.com/user")
                .bearer_auth(token_res.access_token().secret())
                .header(header::USER_AGENT, "KlyjaApp")
                .send()
                .await?
                .json()
                .await?;
            (
                user_info.id.to_string(),
                user_info
                    .email
                    .unwrap_or_else(|| format!("{}@github.local", user_info.login)),
                user_info.name.unwrap_or(user_info.login),
            )
        }
        _ => unreachable!(),
    };

    // FIX 3: Clone the pool for each task that needs it, right before you use it.
    let pool_for_user_task = pool.clone();
    let user = tokio::task::spawn_blocking(move || {
        // FIX 4: Explicitly map the error from pool.get() into our AppError type.
        let mut conn = pool_for_user_task.get().map_err(AppError::from)?;

        let existing_user: Option<User> = users::table
            .filter(users::provider.eq(&provider))
            .filter(users::provider_id.eq(&provider_id))
            .first(&mut conn)
            .optional()?;

        let user = match existing_user {
            Some(user) => user,
            None => {
                let new_user = NewUser {
                    provider: &provider,
                    provider_id: &provider_id,
                    email: &email,
                    display_name: &display_name,
                };
                diesel::insert_into(users::table)
                    .values(&new_user)
                    .get_result(&mut conn)?
            }
        };
        Ok::<User, AppError>(user)
    })
    .await??;

    let session_token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();

    let expires_at = Utc::now().naive_utc() + Duration::days(7);

    let new_session = NewSession {
        session_token: session_token.clone(),
        user_id: user.id,
        expires_at,
    };

    // The original 'pool' from the State is still valid here and can be used.
    tokio::task::spawn_blocking(move || {
        let mut conn = pool.get().map_err(AppError::from)?;
        diesel::insert_into(sessions::table)
            .values(&new_session)
            .execute(&mut conn)?;
        Ok::<(), AppError>(())
    })
    .await??;

    let session_cookie = Cookie::build((SESSION_COOKIE_NAME, session_token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax);

    let jar = jar.add(session_cookie).remove(CSRF_COOKIE_NAME);

    Ok((jar, Redirect::to("/")))
}

// ... the rest of the file (logout_handler, AuthenticatedUser extractor, etc.) is the same as the previous version ...
pub async fn logout_handler(
    jar: CookieJar,
    State(pool): State<DbPool>,
) -> Result<(CookieJar, Redirect), AppError> {
    if let Some(cookie) = jar.get(SESSION_COOKIE_NAME) {
        let token = cookie.value().to_owned();
        tokio::task::spawn_blocking(move || {
            let mut conn = pool.get().map_err(AppError::from)?;
            diesel::delete(sessions::table.filter(sessions::session_token.eq(token)))
                .execute(&mut conn)?;
            Ok::<_, AppError>(())
        })
        .await??;
    }

    let jar = jar.remove(SESSION_COOKIE_NAME);
    Ok((jar, Redirect::to("/")))
}

#[derive(Debug)]
pub struct AuthenticatedUser(pub User);

#[async_trait]
impl<S> FromRequestParts<S> for AuthenticatedUser
where
    DbPool: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let pool = DbPool::from_ref(state);

        let jar = CookieJar::from_request_parts(parts, state)
            .await
            .map_err(|_| AppError::BadRequest("Could not extract cookies".to_string()))?;

        let session_token = jar
            .get(SESSION_COOKIE_NAME)
            .map(|cookie| cookie.value().to_string())
            .ok_or(AppError::Unauthorized)?;

        // Clone the pool for the blocking task
        let pool_for_task = pool.clone();
        let (user, _session): (User, Session) = tokio::task::spawn_blocking(move || {
            // I've also simplified the .get() call here for consistency
            let mut conn = pool_for_task.get()?;
            let now = Utc::now().naive_utc();

            sessions::table
                .inner_join(users::table)
                .filter(sessions::session_token.eq(session_token))
                .filter(sessions::expires_at.gt(now))
                .first::<(Session, User)>(&mut conn)
                .map(|(session, user)| (user, session))
                .map_err(|_| AppError::Unauthorized)
        })
        .await
        .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))??;

        Ok(AuthenticatedUser(user))
    }
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct MeResponse {
    pub id: i32,
    pub display_name: String,
    pub email: String,
}

#[utoipa::path(
    get,
    path = "/api/me",
    tag = "Auth",
    responses(
        (status = 200, description = "Current user info", body = MeResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(("session_cookie" = []))
)]
pub async fn me_handler(user: AuthenticatedUser) -> Json<MeResponse> {
    Json(MeResponse {
        id: user.0.id,
        display_name: user.0.display_name,
        email: user.0.email,
    })
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct UserAnimationInfo {
    pub id: i32,
    pub name: String,
    pub updated_at: NaiveDateTime,
}

#[utoipa::path(
    get,
    path = "/api/my_animations",
    tag = "Animations",
    responses(
        (status = 200, description = "List of user's animations", body = Vec<UserAnimationInfo>),
        (status = 401, description = "Unauthorized")
    ),
    security(("session_cookie" = []))
)]
pub async fn my_animations_handler(
    user: AuthenticatedUser,
    State(pool): State<DbPool>,
) -> Result<Json<Vec<UserAnimationInfo>>, AppError> {
    let user_id = user.0.id;
    // CORRECTED: Added an explicit return type to the closure
    let animations = tokio::task::spawn_blocking(move || -> Result<_, AppError> {
        // SIMPLIFIED: `pool.get()?` is cleaner. The `?` will convert the r2d2::Error into AppError.
        let mut conn = pool.get()?;

        // ADDED `?` to propagate the Diesel error, which will also be converted into AppError.
        let result = crate::schema::animations::table
            .filter(crate::schema::animations::user_id.eq(user_id))
            .select((
                crate::schema::animations::id,
                crate::schema::animations::name,
                crate::schema::animations::updated_at,
            ))
            .order(crate::schema::animations::updated_at.desc())
            .load::<(i32, String, NaiveDateTime)>(&mut conn)?;

        Ok(result)
    })
    .await??;

    let response = animations
        .into_iter()
        .map(|(id, name, updated_at)| UserAnimationInfo {
            id,
            name,
            updated_at,
        })
        .collect();

    Ok(Json(response))
}
