#[cfg(target_arch = "wasm32")]
mod wasm_tests {
    use assert_matches::assert_matches;
    use wasm_bindgen_test::*;
    
    use geco::Geco;
    use prost::Message;
    use wasm_bindgen::JsValue;
    
    // Configure test environment for browser-like testing
    wasm_bindgen_test_configure!(run_in_browser);
    
    #[wasm_bindgen_test]
    fn test_geco_initialization() {
        let geco = Geco::new();
        
        // Verify the animation has default properties
        assert_eq!(geco.get_animation_name(), "Untitled Animation");
        
        // Verify empty polygon data
        let polygons_json = geco.get_polygons_json();
        assert_eq!(polygons_json, "[]");
    }
    
    #[wasm_bindgen_test]
    fn test_set_animation_name() {
        let mut geco = Geco::new();
        let new_name = "Test Animation";
        
        geco.set_animation_name(new_name.to_string());
        assert_eq!(geco.get_animation_name(), new_name);
    }
    
    #[wasm_bindgen_test]
    fn test_add_static_polygon() {
        let mut geco = Geco::new();
        
        // Add a polygon
        geco.add_static_polygon("poly1".to_string(), 1.0, 2.0);
        
        // Verify the JSON output contains the polygon
        let polygons_json = geco.get_polygons_json();
        assert!(polygons_json.contains("poly1"));
        assert!(polygons_json.contains("1.0"));
        assert!(polygons_json.contains("2.0"));
    }
    
    #[wasm_bindgen_test]
    fn test_add_point_to_active_polygon() {
        let mut geco = Geco::new();
        
        // Add a polygon first
        geco.add_static_polygon("poly2".to_string(), 1.0, 1.0);
        
        // Add a point to it
        geco.add_point_to_active_polygon(2.0, 3.0, 0.0);
        
        // Verify polygon JSON has both points
        let polygons_json = geco.get_polygons_json();
        assert!(polygons_json.contains("poly2-pt0"));
        assert!(polygons_json.contains("poly2-pt1"));
    }
    
    #[wasm_bindgen_test]
    fn test_protobuf_serialization() {
        let mut geco = Geco::new();
        
        // Setup test data
        geco.set_animation_name("Protobuf Test".to_string());
        geco.add_static_polygon("poly3".to_string(), 5.0, 6.0);
        geco.add_point_to_active_polygon(7.0, 8.0, 0.0);
        
        // Test serialization
        let bytes = geco.get_animation_protobuf();
        assert!(!bytes.is_empty());
        
        // Create a new instance
        let mut geco2 = Geco::new();
        
        // Load the serialized data
        let result = geco2.load_animation_protobuf(&bytes);
        assert!(result.is_ok());
        
        // Verify the deserialized data
        assert_eq!(geco2.get_animation_name(), "Protobuf Test");
        let polygons_json = geco2.get_polygons_json();
        assert!(polygons_json.contains("poly3"));
        assert!(polygons_json.contains("poly3-pt0"));
        assert!(polygons_json.contains("poly3-pt1"));
    }
    
    #[wasm_bindgen_test]
    fn test_invalid_protobuf_deserialization() {
        let mut geco = Geco::new();
        
        // Create invalid protobuf data
        let invalid_data = vec![0, 1, 2, 3];
        
        // Try to load it
        let result = geco.load_animation_protobuf(&invalid_data);
        
        // Verify it returns an error
        assert!(result.is_err());
    }
    
    #[wasm_bindgen_test]
    fn test_add_point_without_active_polygon() {
        let mut geco = Geco::new();
        
        // Try to add a point without creating a polygon first
        geco.add_point_to_active_polygon(1.0, 2.0, 3.0);
        
        // Verify nothing changed
        let polygons_json = geco.get_polygons_json();
        assert_eq!(polygons_json, "[]");
    }
}