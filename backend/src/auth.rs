// backend/src/auth.rs

//! Contains all logic related to user authentication, session management,
//! and the OAuth2 flow. This module handles redirecting users to a provider (GitHub),
//! processing the callback, creating user accounts and sessions, and validating
//! requests to protected endpoints.

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

/// The name of the cookie used to store the CSRF token. This token is used to
/// prevent Cross-Site Request Forgery attacks during the OAuth2 login flow.
const CSRF_COOKIE_NAME: &str = "klyja_csrf_token";
/// The name of the cookie used to store the user's session token. This token
/// acts as the user's "remember me" login credential.
const SESSION_COOKIE_NAME: &str = "klyja_session_token";

/// A struct representing the user information we care about from the GitHub API response.
#[derive(Deserialize)]
struct GitHubUser {
    id: u64,
    email: Option<String>,
    name: Option<String>,
    login: String,
}

// --- OAUTH CLIENT SETUP ---

/// Constructs an OAuth2 client for GitHub using configuration from environment variables.
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

/// Handler to initiate the OAuth2 login flow.
/// It generates a CSRF token, stores it in a secure cookie, and redirects the user
/// to the GitHub authentication page.
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

    // The CSRF token is stored in a cookie that is sent back to the browser.
    // When GitHub redirects back to our callback handler, we'll compare the token
    // in the cookie with the `state` parameter from GitHub to ensure the request is legitimate.
    let cookie = Cookie::build((CSRF_COOKIE_NAME, csrf_token.secret().to_string()))
        .path("/")
        .http_only(true) // Prevents JavaScript from accessing the cookie.
        .secure(true) // Ensures the cookie is only sent over HTTPS.
        .same_site(axum_extra::extract::cookie::SameSite::Lax);

    (jar.add(cookie), Redirect::to(authorize_url.as_str()))
}

/// The query parameters received from GitHub after the user authenticates.
#[derive(Deserialize)]
pub struct AuthCallbackQuery {
    code: String,
    state: String,
}

/// Handles the callback from the OAuth provider (GitHub) after the user has authenticated.
///
/// This is the most complex part of the authentication flow. It performs the following steps:
/// 1. Validates the CSRF token (`state`).
/// 2. Exchanges the authorization `code` for an access token.
/// 3. Uses the access token to fetch the user's profile from GitHub.
/// 4. Finds the user in our database or creates a new account if they don't exist.
/// 5. Creates a new, secure session for the user and stores it in the database.
/// 6. Sets the session token in a secure cookie on the user's browser, logging them in.
/// 7. Redirects the user to the application's home page.
pub async fn auth_callback_handler(
    Path(provider): Path<String>,
    Query(query): Query<AuthCallbackQuery>,
    State(pool): State<DbPool>,
    jar: CookieJar,
) -> Result<(CookieJar, Redirect), AppError> {
    // 1. **CSRF Validation**: Ensure the `state` parameter from GitHub matches the token we stored.
    let csrf_cookie = jar
        .get(CSRF_COOKIE_NAME)
        .ok_or_else(|| AppError::BadRequest("No CSRF token found in cookie".to_string()))?;

    if csrf_cookie.value() != query.state {
        return Err(AppError::BadRequest("CSRF token mismatch".to_string()));
    }

    // 2. **Token Exchange**: Exchange the one-time `code` for a long-lived access token.
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

    // 3. **Fetch User Profile**: Use the access token to get user details from the GitHub API.
    let req_client = reqwest::Client::new();
    let (provider_id, email, display_name) = match provider.as_str() {
        "github" => {
            let user_info: GitHubUser = req_client
                .get("https://api.github.com/user")
                .bearer_auth(token_res.access_token().secret())
                .header(header::USER_AGENT, "KlyjaApp") // GitHub API requires a User-Agent.
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

    // 4. **Find or Create User**:
    // We use `spawn_blocking` because Diesel's database operations are synchronous.
    // This prevents blocking the entire async runtime while we wait for the database.
    let pool_for_user_task = pool.clone();
    let user = tokio::task::spawn_blocking(move || {
        let mut conn = pool_for_user_task.get().map_err(AppError::from)?;

        // Check if a user with this provider ID already exists.
        let existing_user: Option<User> = users::table
            .filter(users::provider.eq(&provider))
            .filter(users::provider_id.eq(&provider_id))
            .first(&mut conn)
            .optional()?;

        let user = match existing_user {
            // If they exist, use that user record.
            Some(user) => user,
            // Otherwise, create a new user record.
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

    // 5. **Create Session**: Generate a secure, random token for the session.
    let session_token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();

    let expires_at = Utc::now().naive_utc() + Duration::days(7); // Session is valid for 7 days.

    let new_session = NewSession {
        session_token: session_token.clone(),
        user_id: user.id,
        expires_at,
    };

    // Store the new session in the database.
    tokio::task::spawn_blocking(move || {
        let mut conn = pool.get().map_err(AppError::from)?;
        diesel::insert_into(sessions::table)
            .values(&new_session)
            .execute(&mut conn)?;
        Ok::<(), AppError>(())
    })
    .await??;

    // 6. **Set Session Cookie**: Create the session cookie to send to the user's browser.
    let session_cookie = Cookie::build((SESSION_COOKIE_NAME, session_token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax);

    // Add the new session cookie and remove the old CSRF cookie.
    let jar = jar.add(session_cookie).remove(CSRF_COOKIE_NAME);

    // 7. **Redirect**: Send the user to the home page, now logged in.
    Ok((jar, Redirect::to("/")))
}

/// Logs the user out by deleting their session from the database and removing the session cookie.
pub async fn logout_handler(
    jar: CookieJar,
    State(pool): State<DbPool>,
) -> Result<(CookieJar, Redirect), AppError> {
    if let Some(cookie) = jar.get(SESSION_COOKIE_NAME) {
        let token = cookie.value().to_owned();
        // Delete the session from the database.
        tokio::task::spawn_blocking(move || {
            let mut conn = pool.get().map_err(AppError::from)?;
            diesel::delete(sessions::table.filter(sessions::session_token.eq(token)))
                .execute(&mut conn)?;
            Ok::<_, AppError>(())
        })
        .await??;
    }

    // Remove the session cookie from the browser.
    let jar = jar.remove(SESSION_COOKIE_NAME);
    Ok((jar, Redirect::to("/")))
}

/// A wrapper around the `User` model that can only be created by validating
/// an active session. This is the core of the authentication system.
#[derive(Debug)]
pub struct AuthenticatedUser(pub User);

/// Axum Extractor implementation for `AuthenticatedUser`.
///
/// This is the magic that protects our routes. By adding `AuthenticatedUser` as a parameter
/// to any handler, Axum will run this `from_request_parts` function first.
///
/// The function attempts to validate the user's session token from their cookie.
/// - If validation succeeds, it provides the `User` model to the handler.
/// - If validation fails for any reason (missing cookie, invalid token, expired session),
///   it returns an `AppError::Unauthorized` rejection, immediately terminating the
///   request and sending a `401 Unauthorized` response to the client.
#[async_trait]
impl<S> FromRequestParts<S> for AuthenticatedUser
where
    DbPool: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let pool = DbPool::from_ref(state);

        // Extract the session cookie from the request.
        let jar = CookieJar::from_request_parts(parts, state)
            .await
            .map_err(|_| AppError::BadRequest("Could not extract cookies".to_string()))?;

        let session_token = jar
            .get(SESSION_COOKIE_NAME)
            .map(|cookie| cookie.value().to_string())
            .ok_or(AppError::Unauthorized)?; // Fails if the cookie is missing.

        // Validate the token against the database. This is done in a blocking task.
        let pool_for_task = pool.clone();
        let (user, _session): (User, Session) = tokio::task::spawn_blocking(move || {
            let mut conn = pool_for_task.get()?;
            let now = Utc::now().naive_utc();

            // The query checks three things:
            // 1. The session token exists in the `sessions` table.
            // 2. The session has not expired (`expires_at` is in the future).
            // 3. It joins with the `users` table to fetch the user's details.
            sessions::table
                .inner_join(users::table)
                .filter(sessions::session_token.eq(session_token))
                .filter(sessions::expires_at.gt(now))
                .first::<(Session, User)>(&mut conn)
                .map(|(session, user)| (user, session))
                .map_err(|_| AppError::Unauthorized) // Fails if no record is found.
        })
        .await
        .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))??; // Fails if the task itself panics or returns an error.

        // If all checks pass, wrap the User model in AuthenticatedUser and return it.
        Ok(AuthenticatedUser(user))
    }
}

/// The response payload for the `/api/me` endpoint.
#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct MeResponse {
    pub id: i32,
    pub display_name: String,
    pub email: String,
}

/// Returns the profile information for the currently authenticated user.
/// Requires a valid session.
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
    // Because `user: AuthenticatedUser` is a parameter, this code will only run
    // if the user is successfully authenticated by the extractor.
    Json(MeResponse {
        id: user.0.id,
        display_name: user.0.display_name,
        email: user.0.email,
    })
}

/// The response payload for an animation in the `/api/my_animations` list.
#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct UserAnimationInfo {
    pub id: i32,
    pub name: String,
    pub updated_at: NaiveDateTime,
}

/// Returns a list of all animations owned by the currently authenticated user.
/// Requires a valid session.
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
    // Fetch all animations from the database where the `user_id` matches the authenticated user.
    let animations = tokio::task::spawn_blocking(move || -> Result<_, AppError> {
        let mut conn = pool.get()?;

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

    // Map the database results into the response payload structure.
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
