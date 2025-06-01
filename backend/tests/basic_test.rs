//! This module contains basic tests to verify that our code compiles and runs without errors.

use backend::{
    errors::AppError,
    models::Animation,
    protobuf_gen::MapAnimation, // Make sure this path is correct if backend::protobuf_gen is how you access it
};

#[test]
fn test_map_animation_creation() {
    let animation = MapAnimation {
        name: "Test Animation".to_string(),
        animation_id: "test-id".to_string(),
        total_frames: 10,
        features: vec![], // Changed from polygons to features
    };

    // Test that fields are set correctly
    assert_eq!(animation.name, "Test Animation");
    assert_eq!(animation.animation_id, "test-id");
    assert_eq!(animation.total_frames, 10);
    assert_eq!(animation.features.len(), 0); // Changed from polygons to features
}

#[test]
fn test_app_error_construction() {
    let not_found_error = AppError::NotFound("Not found test error".to_string());

    // We can't easily test the response conversion without setting up HTTP tests,
    // but we can at least verify the error constructs properly
    match not_found_error {
        AppError::NotFound(msg) => {
            assert_eq!(msg, "Not found test error");
        }
        _ => panic!("Wrong error type"),
    }
}

#[test]
fn test_animation_struct() {
    let now = chrono::Local::now().naive_local();
    let animation = Animation {
        id: 123,
        name: "Test".to_string(),
        protobuf_data: vec![1, 2, 3],
        created_at: now,
        updated_at: now,
    };

    assert_eq!(animation.id, 123);
    assert_eq!(animation.name, "Test");
    assert_eq!(animation.protobuf_data, vec![1, 2, 3]);
}

