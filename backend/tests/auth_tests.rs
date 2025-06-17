// backend/tests/auth_tests.rs
mod common;

use axum::http::StatusCode;
use axum_extra::extract::cookie::Cookie;
use axum_test::TestServer;
use backend::{auth, DbPool};
use common::test_db::{fixtures, TestDb};

// Helper function to create a test server with the auth routes
async fn create_test_app_with_auth(pool: DbPool) -> TestServer {
    let auth_routes = axum::Router::new()
        // We don't need the actual OAuth handlers for these tests,
        // as we will be mocking the authenticated user state.
        .route("/me", axum::routing::get(auth::me_handler))
        .route(
            "/my_animations",
            axum::routing::get(auth::my_animations_handler),
        );

    let app = axum::Router::new()
        .nest("/api", auth_routes)
        .with_state(pool);

    TestServer::new(app).unwrap()
}

#[tokio::test]
async fn test_me_unauthorized() {
    let test_db = TestDb::new();
    let server = create_test_app_with_auth(test_db.pool.clone()).await;

    // Request without a cookie should be unauthorized
    let response = server.get("/api/me").await;
    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_me_authorized() {
    let test_db = TestDb::new();
    let mut conn = test_db.conn();
    let (user, session) = fixtures::create_user_and_session(&mut conn);
    let server = create_test_app_with_auth(test_db.pool.clone()).await;

    // Create a cookie with the session token
    let cookie = Cookie::new("klyja_session_token", session.session_token);

    // Make the request with the authentication cookie
    let response = server.get("/api/me").add_cookie(cookie).await;

    assert_eq!(response.status_code(), StatusCode::OK);
    let me_response: auth::MeResponse = response.json();
    assert_eq!(me_response.id, user.id);
    assert_eq!(me_response.display_name, user.display_name);
}

#[tokio::test]
async fn test_my_animations_authorized_and_empty() {
    let test_db = TestDb::new();
    let mut conn = test_db.conn();
    let (_user, session) = fixtures::create_user_and_session(&mut conn);
    let server = create_test_app_with_auth(test_db.pool.clone()).await;

    let cookie = Cookie::new("klyja_session_token", session.session_token);

    let response = server.get("/api/my_animations").add_cookie(cookie).await;

    assert_eq!(response.status_code(), StatusCode::OK);
    let animations: Vec<auth::UserAnimationInfo> = response.json();
    assert!(animations.is_empty());
}

#[tokio::test]
async fn test_my_animations_with_data() {
    let test_db = TestDb::new();
    let mut conn = test_db.conn();
    let (user, session) = fixtures::create_user_and_session(&mut conn);
    fixtures::insert_test_animation(&mut conn, "My First Animation", user.id);
    let server = create_test_app_with_auth(test_db.pool.clone()).await;

    let cookie = Cookie::new("klyja_session_token", session.session_token);

    let response = server.get("/api/my_animations").add_cookie(cookie).await;

    assert_eq!(response.status_code(), StatusCode::OK);
    let animations: Vec<auth::UserAnimationInfo> = response.json();
    assert_eq!(animations.len(), 1);
    assert_eq!(animations[0].name, "My First Animation");
}
