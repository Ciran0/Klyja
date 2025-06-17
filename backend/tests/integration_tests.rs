// backend/tests/integration_tests.rs
mod common;

use axum::http::StatusCode; // Removed Request and body::Body
use axum_test::TestServer;
use backend::protobuf_gen::MapAnimation;
use backend::{handlers, DbPool};
use bytes::Bytes; // Import Bytes
use common::{fixtures, TestDb};
use prost::Message;
use rstest::*;
// tower::ServiceExt is not directly needed if you are using TestServer methods
// If you were manually building a service and calling it, then ServiceExt would be used.
// For now, let's comment it out as TestServer abstracts its usage.
// use tower::ServiceExt; // for oneshot

/// Creates a test server with the test database
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

#[tokio::test]
async fn test_health_check() {
    let test_db = TestDb::new();
    let server = create_test_app(test_db.pool.clone()).await;

    let response = server.get("/api/health").await;

    assert_eq!(response.status_code(), StatusCode::OK);
    assert_eq!(response.text(), "Healthy!");
}

#[tokio::test]
async fn test_save_animation_success() {
    let test_db = TestDb::new();
    let server = create_test_app(test_db.pool.clone()).await;

    let animation_data_vec = fixtures::create_test_animation_proto("Test Animation");
    let animation_data_bytes = Bytes::from(animation_data_vec); // Convert to Bytes

    let response = server
        .post("/api/save_animation")
        .bytes(animation_data_bytes) // Pass Bytes
        .await;

    assert_eq!(response.status_code(), StatusCode::CREATED);

    let json: serde_json::Value = response.json();
    assert!(json["id"].is_number());
    assert_eq!(json["message"], "Animation saved successfully");
}

#[tokio::test]
async fn test_save_animation_invalid_protobuf() {
    let test_db = TestDb::new();
    let server = create_test_app(test_db.pool.clone()).await;

    let invalid_data_vec = vec![0xFF, 0xFF, 0xFF, 0xFF];
    let invalid_data_bytes = Bytes::from(invalid_data_vec); // Convert to Bytes

    let response = server
        .post("/api/save_animation")
        .bytes(invalid_data_bytes) // Pass Bytes
        .await;

    assert_eq!(response.status_code(), StatusCode::BAD_REQUEST);

    let json: serde_json::Value = response.json();
    assert!(json["error"]
        .as_str()
        .unwrap()
        .contains("Invalid data format"));
}

#[tokio::test]
async fn test_load_animation_success() {
    let test_db = TestDb::new();

    let mut conn = test_db.conn();
    let saved_animation = fixtures::insert_test_animation(&mut conn, "Load Test");
    drop(conn);

    let server = create_test_app(test_db.pool.clone()).await;

    let response = server
        .get(&format!("/api/load_animation/{}", saved_animation.id))
        .await;

    assert_eq!(response.status_code(), StatusCode::OK);

    // Get Bytes directly from the response by consuming it
    let body_bytes: Bytes = response.into_bytes(); // Changed from response.bytes()
    let decoded = MapAnimation::decode(body_bytes).expect("Failed to decode response");
    assert_eq!(decoded.name, "Load Test");
}

#[tokio::test]
async fn test_load_animation_not_found() {
    let test_db = TestDb::new();
    let server = create_test_app(test_db.pool.clone()).await;

    let response = server.get("/api/load_animation/99999").await;

    assert_eq!(response.status_code(), StatusCode::NOT_FOUND);

    let json: serde_json::Value = response.json();
    assert!(json["error"].as_str().unwrap().contains("not found"));
}

#[tokio::test]
async fn test_save_and_load_flow() {
    let test_db = TestDb::new();
    let server = create_test_app(test_db.pool.clone()).await;

    let animation_data_vec = fixtures::create_test_animation_proto("Flow Test");
    let animation_data_bytes = Bytes::from(animation_data_vec.clone()); // Clone Vec for Bytes, keep original for assert

    let save_response = server
        .post("/api/save_animation")
        .bytes(animation_data_bytes) // Pass Bytes
        .await;

    assert_eq!(save_response.status_code(), StatusCode::CREATED);
    let save_json: serde_json::Value = save_response.json();
    let animation_id = save_json["id"].as_i64().unwrap();

    let load_response = server
        .get(&format!("/api/load_animation/{}", animation_id))
        .await;

    assert_eq!(load_response.status_code(), StatusCode::OK);

    let loaded_bytes: Bytes = load_response.into_bytes(); // Changed from load_response.bytes()
    assert_eq!(loaded_bytes.to_vec(), animation_data_vec); // Compare Vec<u8> with Vec<u8>
}

#[rstest]
#[case::small(10)]
#[case::medium(100)]
#[case::large(500)]
#[tokio::test]
async fn test_save_animation_various_sizes(#[case] polygon_count: usize) {
    let test_db = TestDb::new();
    let server = create_test_app(test_db.pool.clone()).await;

    let mut animation = MapAnimation {
        animation_id: format!("size-test-{}", uuid::Uuid::new_v4()),
        name: format!("Size Test {}", polygon_count),
        total_frames: 30,
        polygons: Vec::with_capacity(polygon_count),
    };

    for i in 0..polygon_count {
        let polygon = backend::protobuf_gen::Polygon {
            polygon_id: format!("poly-{}", i),
            points: vec![],
            properties: Default::default(),
        };
        animation.polygons.push(polygon);
    }

    let animation_data_vec = animation.encode_to_vec();
    let animation_data_bytes = Bytes::from(animation_data_vec); // Convert to Bytes

    let response = server
        .post("/api/save_animation")
        .bytes(animation_data_bytes) // Pass Bytes
        .await;

    assert_eq!(response.status_code(), StatusCode::CREATED);
}
