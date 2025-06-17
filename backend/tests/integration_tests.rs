// backend/tests/integration_tests.rs
mod common;

use axum::http::StatusCode;
use axum_extra::extract::cookie::Cookie;
use axum_test::{TestRequest, TestServer};
use backend::protobuf_gen::{Feature, FeatureType, MapAnimation};
use backend::{
    handlers,
    models::{Session, User},
    DbPool,
};
use bytes::Bytes;
use common::test_db::{fixtures, TestDb};
use prost::Message;
use rstest::*;
use std::collections::HashMap;

/// Creates a test server with all necessary routes for integration tests.
async fn create_test_app(pool: DbPool) -> TestServer {
    let app = axum::Router::new()
        .route(
            "/api/health",
            axum::routing::get(handlers::health_check_handler),
        )
        .route(
            "/api/save_animation",
            axum::routing::post(handlers::save_animation_handler),
        )
        .route(
            "/api/load_animation/:id",
            axum::routing::get(handlers::load_animation_handler),
        )
        .with_state(pool);

    TestServer::new(app).unwrap()
}

/// A test helper that bundles a TestServer with an authenticated user and session.
struct AuthenticatedTestServer {
    server: TestServer,
    user: User,
    session: Session,
}

impl AuthenticatedTestServer {
    /// Creates a new instance of the test server, a new user, and a session for that user.
    async fn new(pool: DbPool) -> Self {
        let mut conn = pool.get().unwrap();
        let (user, session) = fixtures::create_user_and_session(&mut conn);
        let server = create_test_app(pool).await;

        AuthenticatedTestServer {
            server,
            user,
            session,
        }
    }

    /// Attaches the authentication cookie to a given TestRequest.
    fn with_auth_cookie(&self, request: TestRequest) -> axum_test::TestRequest {
        let cookie = Cookie::new("klyja_session_token", self.session.session_token.clone());
        request.add_cookie(cookie)
    }
}

// --- Test Cases ---

#[tokio::test]
async fn test_health_check() {
    let test_db = TestDb::new();
    let server = create_test_app(test_db.pool.clone()).await;

    let response = server.get("/api/health").await;

    assert_eq!(response.status_code(), StatusCode::OK);
    assert_eq!(response.text(), "Healthy!");
}

#[tokio::test]
async fn test_save_animation_unauthorized() {
    let test_db = TestDb::new();
    let server = create_test_app(test_db.pool.clone()).await;
    let animation_data_vec = fixtures::create_test_animation_proto("Unauthorized Test");
    let animation_data_bytes = Bytes::from(animation_data_vec);

    // Make the request without an authentication cookie
    let response = server
        .post("/api/save_animation")
        .bytes(animation_data_bytes)
        .await;

    // Expect an UNAUTHORIZED status code
    assert_eq!(response.status_code(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_save_animation_success() {
    let test_db = TestDb::new();
    let auth_server = AuthenticatedTestServer::new(test_db.pool.clone()).await;
    let animation_data_vec = fixtures::create_test_animation_proto("Test Animation");
    let animation_data_bytes = Bytes::from(animation_data_vec);

    let request = auth_server.server.post("/api/save_animation");
    let response = auth_server
        .with_auth_cookie(request)
        .bytes(animation_data_bytes)
        .await;

    assert_eq!(response.status_code(), StatusCode::CREATED);

    let json: serde_json::Value = response.json();
    assert!(json["id"].is_number());
    assert_eq!(json["message"], "Animation saved successfully");
}

#[tokio::test]
async fn test_save_animation_invalid_protobuf() {
    let test_db = TestDb::new();
    let auth_server = AuthenticatedTestServer::new(test_db.pool.clone()).await;
    let invalid_data_bytes = Bytes::from(vec![0xFF, 0xFE, 0xFD]); // Invalid protobuf data

    let request = auth_server.server.post("/api/save_animation");
    let response = auth_server
        .with_auth_cookie(request)
        .bytes(invalid_data_bytes)
        .await;

    assert_eq!(response.status_code(), StatusCode::BAD_REQUEST);

    let json: serde_json::Value = response.json();
    assert!(json["error"]
        .as_str()
        .unwrap()
        .contains("Failed to decode Protobuf message"));
}

#[tokio::test]
async fn test_load_animation_success() {
    let test_db = TestDb::new();
    let auth_server = AuthenticatedTestServer::new(test_db.pool.clone()).await;
    let mut conn = test_db.conn();
    let saved_animation =
        fixtures::insert_test_animation(&mut conn, "Load Test", auth_server.user.id);
    drop(conn);

    let request = auth_server
        .server
        .get(&format!("/api/load_animation/{}", saved_animation.id));
    let response = auth_server.with_auth_cookie(request).await;

    assert_eq!(response.status_code(), StatusCode::OK);

    let body_bytes: Bytes = response.into_bytes();
    let decoded = MapAnimation::decode(body_bytes).expect("Failed to decode response");
    assert_eq!(decoded.name, "Load Test");
}

#[tokio::test]
async fn test_load_animation_not_found() {
    let test_db = TestDb::new();
    let auth_server = AuthenticatedTestServer::new(test_db.pool.clone()).await;

    let request = auth_server.server.get("/api/load_animation/99999"); // Non-existent ID
    let response = auth_server.with_auth_cookie(request).await;

    assert_eq!(response.status_code(), StatusCode::NOT_FOUND);

    let json: serde_json::Value = response.json();
    assert!(json["error"].as_str().unwrap().contains("not found"));
}

#[tokio::test]
async fn test_load_animation_access_denied_for_other_user() {
    let test_db = TestDb::new();
    let mut conn = test_db.conn();

    // Create User A and their animation
    let (user_a, _session_a) = fixtures::create_user_and_session(&mut conn);
    let animation_a = fixtures::insert_test_animation(&mut conn, "User A's Animation", user_a.id);
    drop(conn); // Release the connection

    // Create User B who will try to access the animation
    let auth_server_b = AuthenticatedTestServer::new(test_db.pool.clone()).await;

    // Assert that User B is not User A
    assert_ne!(auth_server_b.user.id, user_a.id);

    // User B attempts to load User A's animation
    let request = auth_server_b
        .server
        .get(&format!("/api/load_animation/{}", animation_a.id));
    let response = auth_server_b.with_auth_cookie(request).await;

    // The service logic should prevent access, resulting in a NOT_FOUND error
    // because the animation is not found *for that specific user*.
    assert_eq!(response.status_code(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_save_and_load_flow() {
    let test_db = TestDb::new();
    let auth_server = AuthenticatedTestServer::new(test_db.pool.clone()).await;
    let animation_data_vec = fixtures::create_test_animation_proto("Flow Test");
    let animation_data_bytes = Bytes::from(animation_data_vec.clone());

    // 1. Save the animation
    let save_request = auth_server.server.post("/api/save_animation");
    let save_response = auth_server
        .with_auth_cookie(save_request)
        .bytes(animation_data_bytes)
        .await;

    assert_eq!(save_response.status_code(), StatusCode::CREATED);
    let save_json: serde_json::Value = save_response.json();
    let animation_id = save_json["id"].as_i64().unwrap();

    // 2. Load the animation
    let load_request = auth_server
        .server
        .get(&format!("/api/load_animation/{}", animation_id));
    let load_response = auth_server.with_auth_cookie(load_request).await;

    assert_eq!(load_response.status_code(), StatusCode::OK);

    let loaded_bytes: Bytes = load_response.into_bytes();
    assert_eq!(loaded_bytes.to_vec(), animation_data_vec);
}

#[rstest]
#[case::small(10)]
#[case::medium(100)]
#[case::large(500)]
#[tokio::test]
async fn test_save_animation_various_sizes(#[case] feature_count: usize) {
    let test_db = TestDb::new();
    let auth_server = AuthenticatedTestServer::new(test_db.pool.clone()).await;

    let mut animation = MapAnimation {
        animation_id: format!("size-test-{}", uuid::Uuid::new_v4()),
        name: format!("Size Test {}", feature_count),
        total_frames: 30,
        features: Vec::with_capacity(feature_count),
    };

    for i in 0..feature_count {
        let feature = Feature {
            feature_id: format!("feature-{}", i),
            name: format!("Feature {}", i),
            r#type: FeatureType::Polygon as i32,
            appearance_frame: 0,
            disappearance_frame: 30,
            point_animation_paths: vec![],
            structure_snapshots: vec![],
            properties: HashMap::new(),
        };
        animation.features.push(feature);
    }

    let animation_data_vec = animation.encode_to_vec();
    let animation_data_bytes = Bytes::from(animation_data_vec);

    let request = auth_server.server.post("/api/save_animation");
    let response = auth_server
        .with_auth_cookie(request)
        .bytes(animation_data_bytes)
        .await;

    assert_eq!(response.status_code(), StatusCode::CREATED);
}
