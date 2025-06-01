//! This module contains basic tests for geco-specific types.

// Use geco's own protobuf definitions
use geco::protobuf_gen::MapAnimation; // Assuming 'Feature' is what 'Polygon' became

#[test]
fn test_geco_map_animation_creation() {
    // This test now uses geco::protobuf_gen::MapAnimation
    let animation = MapAnimation {
        name: "Test Geco Animation".to_string(),
        animation_id: "geco-test-id".to_string(),
        total_frames: 10,
        features: vec![], // Assuming 'features' is the correct field name now
    };

    assert_eq!(animation.name, "Test Geco Animation");
    assert_eq!(animation.animation_id, "geco-test-id");
    assert_eq!(animation.total_frames, 10);
    assert_eq!(animation.features.len(), 0);
}
