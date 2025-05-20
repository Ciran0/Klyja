//! Basic tests for geco crate that don't require wasm

use geco::protobuf_gen::{AnimatedPoint, MapAnimation, Point, Polygon};
use prost::Message;

#[test]
fn test_map_animation_serialization() {
    // Create a test map animation
    let map_animation = MapAnimation {
        animation_id: "test-animation".to_string(),
        name: "Test Animation".to_string(),
        total_frames: 30,
        polygons: vec![],
    };

    // Serialize to bytes
    let bytes = map_animation.encode_to_vec();

    // Deserialize
    let decoded = MapAnimation::decode(&bytes[..]).unwrap();

    // Verify
    assert_eq!(decoded.animation_id, "test-animation");
    assert_eq!(decoded.name, "Test Animation");
    assert_eq!(decoded.total_frames, 30);
    assert!(decoded.polygons.is_empty());
}

#[test]
fn test_point_serialization() {
    // Create a point
    let point = Point {
        x: 1.0,
        y: 2.0,
        z: Some(3.0),
    };

    // Serialize to bytes
    let mut buf = Vec::new();
    point.encode(&mut buf).unwrap();

    // Deserialize
    let decoded = Point::decode(&buf[..]).unwrap();

    // Verify
    assert_eq!(decoded.x, 1.0);
    assert_eq!(decoded.y, 2.0);
    assert_eq!(decoded.z, Some(3.0));
}

#[test]
fn test_polygon_with_points() {
    // Create a point
    let point1 = Point {
        x: 1.0,
        y: 2.0,
        z: Some(3.0),
    };

    let point2 = Point {
        x: 4.0,
        y: 5.0,
        z: Some(6.0),
    };

    // Create animated points
    let animated_point1 = AnimatedPoint {
        point_id: "point-1".to_string(),
        initial_position: Some(point1),
        movements: vec![],
    };

    let animated_point2 = AnimatedPoint {
        point_id: "point-2".to_string(),
        initial_position: Some(point2),
        movements: vec![],
    };

    // Create a polygon
    let mut properties = std::collections::HashMap::new();
    properties.insert("color".to_string(), "red".to_string());

    let polygon = Polygon {
        polygon_id: "polygon-1".to_string(),
        points: vec![animated_point1, animated_point2],
        properties,
    };

    // Serialize
    let bytes = polygon.encode_to_vec();

    // Deserialize
    let decoded = Polygon::decode(&bytes[..]).unwrap();

    // Verify
    assert_eq!(decoded.polygon_id, "polygon-1");
    assert_eq!(decoded.points.len(), 2);
    assert_eq!(decoded.points[0].point_id, "point-1");
    assert_eq!(decoded.points[1].point_id, "point-2");
    assert_eq!(decoded.properties.get("color").unwrap(), "red");
}

