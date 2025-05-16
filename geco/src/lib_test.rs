#[cfg(test)]
mod tests {
    use crate::protobuf_gen::{AnimatedPoint, MapAnimation, Point, Polygon};
    use crate::{SimpleAnimatedPoint, SimplePoint, SimplePolygon};
    use prost::Message;

    #[test]
    fn test_simple_point_from() {
        let point = Point {
            x: 1.0,
            y: 2.0,
            z: Some(3.0),
        };
        
        let simple_point = SimplePoint::from(&point);
        
        assert_eq!(simple_point.x, 1.0);
        assert_eq!(simple_point.y, 2.0);
        assert_eq!(simple_point.z, Some(3.0));
    }
    
    #[test]
    fn test_simple_animated_point_from() {
        let point = Point {
            x: 1.0,
            y: 2.0,
            z: Some(3.0),
        };
        
        let animated_point = AnimatedPoint {
            point_id: "test-point".to_string(),
            initial_position: Some(point),
            movements: vec![],
        };
        
        let simple_animated_point = SimpleAnimatedPoint::from(&animated_point);
        
        assert_eq!(simple_animated_point.point_id, "test-point");
        assert!(simple_animated_point.initial_position.is_some());
        
        let simple_pos = simple_animated_point.initial_position.unwrap();
        assert_eq!(simple_pos.x, 1.0);
        assert_eq!(simple_pos.y, 2.0);
        assert_eq!(simple_pos.z, Some(3.0));
    }
    
    #[test]
    fn test_simple_polygon_from() {
        let point = Point {
            x: 1.0,
            y: 2.0,
            z: Some(3.0),
        };
        
        let animated_point = AnimatedPoint {
            point_id: "test-point".to_string(),
            initial_position: Some(point),
            movements: vec![],
        };
        
        let mut properties = std::collections::HashMap::new();
        properties.insert("color".to_string(), "red".to_string());
        
        let polygon = Polygon {
            polygon_id: "test-polygon".to_string(),
            points: vec![animated_point],
            properties,
        };
        
        let simple_polygon = SimplePolygon::from(&polygon);
        
        assert_eq!(simple_polygon.polygon_id, "test-polygon");
        assert_eq!(simple_polygon.points.len(), 1);
        assert_eq!(simple_polygon.points[0].point_id, "test-point");
        assert_eq!(simple_polygon.properties.get("color").unwrap(), "red");
    }
    
    #[test]
    fn test_map_animation_serialization() {
        let point = Point {
            x: 1.0,
            y: 2.0,
            z: Some(3.0),
        };
        
        let animated_point = AnimatedPoint {
            point_id: "test-point".to_string(),
            initial_position: Some(point),
            movements: vec![],
        };
        
        let polygon = Polygon {
            polygon_id: "test-polygon".to_string(),
            points: vec![animated_point],
            properties: Default::default(),
        };
        
        let animation = MapAnimation {
            animation_id: "test-animation".to_string(),
            name: "Test Animation".to_string(),
            total_frames: 10,
            polygons: vec![polygon],
        };
        
        // Serialize to protobuf
        let bytes = animation.encode_to_vec();
        
        // Deserialize
        let decoded = MapAnimation::decode(&bytes[..]).unwrap();
        
        // Verify the data
        assert_eq!(decoded.animation_id, "test-animation");
        assert_eq!(decoded.name, "Test Animation");
        assert_eq!(decoded.total_frames, 10);
        assert_eq!(decoded.polygons.len(), 1);
        assert_eq!(decoded.polygons[0].polygon_id, "test-polygon");
        assert_eq!(decoded.polygons[0].points.len(), 1);
        assert_eq!(decoded.polygons[0].points[0].point_id, "test-point");
        let pos = decoded.polygons[0].points[0].initial_position.as_ref().unwrap();
        assert_eq!(pos.x, 1.0);
        assert_eq!(pos.y, 2.0);
        assert_eq!(pos.z, Some(3.0));
    }
}