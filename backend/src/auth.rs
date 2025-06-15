// backend/src/auth.rs
use crate::{
    errors::AppError,
    models::{NewSession, NewUser, Session, User},
    schema::{sessions, users},
    DbPool,
};
use axum::{
    async_trait,
    extract::{FromRequestParts, Path, Query, State},
    http::{header, request::Parts, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Json, RequestPartsExt,
};
use axum_extra::extract::{cookie::Cookie, CookieJar};
use chrono::{Duration, Utc};
use diesel::prelude::*;
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, AuthorizationCode, ClientId,
    ClientSecret, CsrfToken, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::env;

const CSRF_COOKIE_NAME: &str = "klyja_csrf_token";
const SESSION_COOKIE_NAME: &str = "klyja_session_token";

// --- STRUCTS FOR OAUTH USER DATA ---

#[derive(Deserialize)]
struct GitHubUser {
    id: u64,
    email: Option<String>,
    name: Option<String>,
    login: String,
}

#[derive(Deserialize)]
struct GoogleUser {
    sub: String,
    email: String,
    name: String,
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
            let mut client = github_oauth_client();
            client = client.add_scope(Scope::new("user:email".to_string()));
            client.authorize_url(CsrfToken::new_random)
        }
        "google" => {
            let client = google_oauth_client()
                .add_scope(Scope::new("openid".to_string()))
                .add_scope(Scope::new("profile".to_string()))
                .add_scope(Scope::new("email".to_string()));
            client.authorize_url(CsrfToken::new_random)
        }
        _ => panic!("Unsupported provider"),
    };

    let cookie = Cookie::build((CSRF_COOKIE_NAME, csrf_token.secret().to_string()))
        .path("/")
        .http_only(true)
        .secure(true) // Set to false for local HTTP development if needed
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

    // --- Exchange code for token ---
    let token_res = match provider.as_str() {
        "github" => {
            github_oauth_client()
                .exchange_code(AuthorizationCode::new(query.code))
                .request_async(async_http_client)
                .await
        }
        "google" => {
            google_oauth_client()
                .exchange_code(AuthorizationCode::new(query.code))
                .request_async(async_http_client)
                .await
        }
        _ => return Err(AppError::BadRequest("Unsupported provider".to_string())),
    }
    .map_err(|e| AppError::Internal(format!("OAuth token exchange failed: {}", e)))?;

    // --- Fetch user info ---
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
                    .unwrap_or_else(|| format!("{}@github.local", user_info.login)), // GitHub sometimes doesn't provide public email
                user_info.name.unwrap_or(user_info.login),
            )
        }
        "google" => {
            let user_info: GoogleUser = req_client
                .get("https://www.googleapis.com/oauth2/v3/userinfo")
                .bearer_auth(token_res.access_token().secret())
                .send()
                .await?
                .json()
                .await?;
            (user_info.sub, user_info.email, user_info.name)
        }
        _ => unreachable!(),
    };

    // --- Find or create user and session ---
    let pool = pool.clone();
    let user = tokio::task::spawn_blocking(move || {
        let mut conn = pool.get()?;

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

    tokio::task::spawn_blocking(move || {
        let mut conn = pool.get()?;
        diesel::insert_into(sessions::table)
            .values(&new_session)
            .execute(&mut conn)?;
        Ok::<(), AppError>(())
    })
    .await??;

    let session_cookie = Cookie::build((SESSION_COOKIE_NAME, session_token))
        .path("/")
        .http_only(true)
        .secure(true) // Set to false for local HTTP if needed
        .same_site(axum_extra::extract::cookie::SameSite::Lax);

    let jar = jar.add(session_cookie).remove(CSRF_COOKIE_NAME);

    Ok((jar, Redirect::to("/")))
}

pub async fn logout_handler(
    jar: CookieJar,
    State(pool): State<DbPool>,
) -> Result<(CookieJar, Redirect), AppError> {
    if let Some(cookie) = jar.get(SESSION_COOKIE_NAME) {
        let token = cookie.value().to_owned();
        tokio::task::spawn_blocking(move || {
            let mut conn = pool.get()?;
            diesel::delete(sessions::table.filter(sessions::session_token.eq(token)))
                .execute(&mut conn)?;
            Ok::<_, AppError>(())
        })
        .await??;
    }

    let jar = jar.remove(SESSION_COOKIE_NAME);
    Ok((jar, Redirect::to("/")))
}

// --- AXUM EXTRACTOR FOR AUTHENTICATED USER ---

#[derive(Debug)]
pub struct AuthenticatedUser(pub User);

#[async_trait]
impl<S> FromRequestParts<S> for AuthenticatedUser
where
    DbPool: FromRequestParts<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let State(pool) = State::<DbPool>::from_request_parts(parts, _state)
            .await
            .map_err(|_| AppError::Internal("Could not extract DbPool".to_string()))?;

        let jar = CookieJar::from_request_parts(parts, _state)
            .await
            .map_err(|_| AppError::BadRequest("Could not extract cookies".to_string()))?;

        let session_token = jar
            .get(SESSION_COOKIE_NAME)
            .map(|cookie| cookie.value().to_string())
            .ok_or(AppError::Unauthorized)?;

        let (user, _session): (User, Session) = tokio::task::spawn_blocking(move || {
            let mut conn = pool.get()?;
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
        .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))?
        .map_err(|db_err| db_err.into())?;

        Ok(AuthenticatedUser(user))
    }
}

// --- USER INFO HANDLER ---
#[derive(Serialize)]
pub struct MeResponse {
    id: i32,
    display_name: String,
    email: String,
}

pub async fn me_handler(user: AuthenticatedUser) -> Json<MeResponse> {
    Json(MeResponse {
        id: user.0.id,
        display_name: user.0.display_name,
        email: user.0.email,
    })
}

// This is a new handler to get a list of animations for the logged-in user
#[derive(Serialize)]
pub struct UserAnimationInfo {
    id: i32,
    name: String,
    updated_at: NaiveDateTime,
}

pub async fn my_animations_handler(
    user: AuthenticatedUser,
    State(pool): State<DbPool>,
) -> Result<Json<Vec<UserAnimationInfo>>, AppError> {
    let user_id = user.0.id;
    let animations = tokio::task::spawn_blocking(move || {
        let mut conn = pool.get()?;
        crate::schema::animations::table
            .filter(crate::schema::animations::user_id.eq(user_id))
            .select((
                crate::schema::animations::id,
                crate::schema::animations::name,
                crate::schema::animations::updated_at,
            ))
            .order(crate::schema::animations::updated_at.desc())
            .load::<(i32, String, NaiveDateTime)>(&mut conn)
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
