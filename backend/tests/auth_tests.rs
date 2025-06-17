// backend/tests/auth_tests.rs
mod common;

use axum::http::StatusCode;
use axum_test::TestServer;
use backend::{auth, DbPool};
use common::test_db::TestDb;

async fn create_test_app_with_auth(pool: DbPool) -> TestServer {
    let auth_routes = axum::Router::new()
        .route(
            "/:provider",
            axum::routing::get(auth::auth_redirect_handler),
        )
        .route(
            "/:provider/callback",
            axum::routing::get(auth::auth_callback_handler),
        )
        .route("/logout", axum::routing::get(auth::logout_handler));

    let api_routes = axum::Router::new()
        .nest("/auth", auth_routes)
        .route("/me", axum::routing::get(auth::me_handler))
        .route(
            "/my_animations",
            axum::routing::get(auth::my_animations_handler),
        );

    let app = axum::Router::new()
        .nest("/api", api_routes)
        .with_state(pool);

    TestServer::new(app).unwrap()
}

#[tokio::test]
async fn test_me_unauthorized() {
    let test_db = TestDb::new();
    let server = create_test_app_with_auth(test_db.pool.clone()).await;

    let response = server.get("/api/me").await;
    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);
}

// Add more tests for the auth logic, such as:
// - A full OAuth2 flow mock (this is complex and may require a mock OAuth2 server)
// - Testing the `my_animations` endpoint
