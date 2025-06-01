#[cfg(target_arch = "wasm32")]
mod wasm_tests {
    use geco::Geco; // Assuming Geco is in crate root for wasm_tests too
    use wasm_bindgen::JsValue;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    // Helper to create a Geco instance for tests, if not already standard
    // fn create_test_geco() -> Geco { Geco::new() } // Not needed if Geco::new() is simple

    #[wasm_bindgen_test]
    fn test_geco_initialization_and_name() {
        let mut geco = Geco::new();
        assert_eq!(geco.get_animation_name(), "Untitled Animation");
        geco.set_animation_name("WASM Test".to_string());
        assert_eq!(geco.get_animation_name(), "WASM Test");
    }

    #[wasm_bindgen_test]
    fn test_total_frames_management() {
        let mut geco = Geco::new();
        assert_eq!(geco.get_total_frames(), 100); // Default
        geco.set_total_frames(200);
        assert_eq!(geco.get_total_frames(), 200);
        geco.set_total_frames(0); // Invalid, should not change
        assert_eq!(geco.get_total_frames(), 200);
    }

    #[wasm_bindgen_test]
    fn test_create_feature_and_set_active() {
        let mut geco = Geco::new();
        let feature_id1 = geco.create_feature("MyPoly".to_string(), 1, 0, 10).unwrap();
        assert!(geco.active_feature_id.is_some());
        assert_eq!(geco.active_feature_id.as_ref().unwrap(), &feature_id1);

        let feature_id2 = geco.create_feature("MyLine".to_string(), 2, 5, 15).unwrap();
        assert_eq!(geco.active_feature_id.as_ref().unwrap(), &feature_id2); // Should be last created

        let features_json = geco.get_renderable_features_json_at_frame(5);
        assert!(features_json.contains("MyPoly"));
        assert!(features_json.contains("MyLine"));
    }

    // ---- Tests moved from lib_test.rs and adapted ----
    #[wasm_bindgen_test]
    fn test_create_feature_invalid_type_wasm() {
        let mut geco = Geco::new();
        let result = geco.create_feature("Invalid Type".to_string(), 99, 0, 100);
        assert!(result.is_err());
        let err_msg = result.unwrap_err().as_string().unwrap_or_default();
        assert_eq!(err_msg, "Invalid feature type value");
    }

    #[wasm_bindgen_test]
    fn test_add_point_no_active_feature_wasm() {
        let mut geco = Geco::new(); // No feature created, so no active feature
        let result = geco.add_point_to_active_feature("p1".to_string(), 0, 1.0, 0.0, Some(0.0));
        assert!(result.is_err());
        let err_msg = result.unwrap_err().as_string().unwrap_or_default();
        assert_eq!(err_msg, "No active feature selected");
    }

    #[wasm_bindgen_test]
    fn test_add_point_duplicate_id_in_feature_wasm() {
        let mut geco = Geco::new();
        let _feature_id = geco.create_feature("Test".to_string(), 1, 0, 10).unwrap();
        geco.add_point_to_active_feature("p1".to_string(), 0, 1.0, 0.0, Some(0.0))
            .unwrap();
        let result = geco.add_point_to_active_feature("p1".to_string(), 1, 2.0, 0.0, Some(0.0));
        assert!(result.is_err());
        let err_msg = result.unwrap_err().as_string().unwrap_or_default();
        assert!(err_msg.contains("already exists in feature"));
    }
    // ---- End of moved tests ----

    #[wasm_bindgen_test]
    fn test_add_point_to_active_feature_wasm() {
        let mut geco = Geco::new();
        geco.create_feature("TestFeat".to_string(), 1, 0, 10)
            .unwrap();
        let point_id = geco
            .add_point_to_active_feature("p1".to_string(), 0, 1.0, 2.0, Some(0.5))
            .unwrap();
        assert_eq!(point_id, "p1");

        let features_json = geco.get_renderable_features_json_at_frame(0);
        assert!(features_json.contains("\"name\":\"TestFeat\""));
        assert!(features_json.contains("\"x\":0.4364")); // Normalized x of (1,2,0.5)
    }

    #[wasm_bindgen_test]
    fn test_add_point_empty_id_generates_one() {
        let mut geco = Geco::new();
        geco.create_feature("GenIdFeat".to_string(), 1, 0, 10)
            .unwrap();
        let point_id = geco
            .add_point_to_active_feature("".to_string(), 0, 1.0, 0.0, None)
            .unwrap();
        assert!(point_id.starts_with("point-"));

        let features_json = geco.get_renderable_features_json_at_frame(0);
        assert!(features_json.contains(&point_id));
    }

    #[wasm_bindgen_test]
    fn test_add_keyframe_to_point_wasm() {
        let mut geco = Geco::new();
        let feature_id = geco
            .create_feature("KeyframeFeat".to_string(), 2, 0, 20)
            .unwrap();
        let point_id = geco
            .add_point_to_active_feature("ptKey".to_string(), 0, 1.0, 0.0, Some(0.0))
            .unwrap();

        geco.add_position_keyframe_to_point(
            feature_id.clone(),
            point_id.clone(),
            10,
            0.0,
            1.0,
            Some(0.0),
        )
        .unwrap();

        let features_json_frame5 = geco.get_renderable_features_json_at_frame(5);
        assert!(features_json_frame5.contains("\"x\":0.7071"));
        assert!(features_json_frame5.contains("\"y\":0.7071"));

        let features_json_frame10 = geco.get_renderable_features_json_at_frame(10);
        assert!(features_json_frame10.contains("\"y\":1.0"));
    }

    #[wasm_bindgen_test]
    fn test_get_renderable_features_json_at_frame_wasm() {
        let mut geco = Geco::new();
        geco.create_feature("F1".to_string(), 1, 0, 10).unwrap();
        geco.add_point_to_active_feature("p1_f1".to_string(), 0, 1.0, 0.0, None)
            .unwrap();

        geco.create_feature("F2".to_string(), 2, 5, 15).unwrap();
        geco.add_point_to_active_feature("p1_f2".to_string(), 5, 0.0, 1.0, None)
            .unwrap();

        let json_frame0 = geco.get_renderable_features_json_at_frame(0);
        assert!(json_frame0.contains("F1"));
        assert!(!json_frame0.contains("F2"));

        let json_frame7 = geco.get_renderable_features_json_at_frame(7);
        assert!(json_frame7.contains("F1"));
        assert!(json_frame7.contains("F2"));

        let json_frame12 = geco.get_renderable_features_json_at_frame(12);
        assert!(!json_frame12.contains("F1"));
        assert!(json_frame12.contains("F2"));

        let json_frame_out_of_bounds = geco.get_renderable_features_json_at_frame(100);
        assert_eq!(json_frame_out_of_bounds, "[]");
    }

    #[wasm_bindgen_test]
    fn test_protobuf_cycle_wasm() {
        let mut geco1 = Geco::new();
        geco1.set_animation_name("Proto Cycle".to_string());
        geco1.set_total_frames(30);
        let fid = geco1
            .create_feature("ProtoFeat".to_string(), 1, 0, 20)
            .unwrap();
        let pid = geco1
            .add_point_to_active_feature("p_proto".to_string(), 0, 1.0, 0.0, Some(0.0))
            .unwrap();
        geco1
            .add_position_keyframe_to_point(fid.clone(), pid.clone(), 10, 0.0, 1.0, Some(0.0))
            .unwrap();

        let bytes = geco1.get_animation_protobuf();
        assert!(!bytes.is_empty());

        let mut geco2 = Geco::new();
        let load_result = geco2.load_animation_protobuf(&bytes);
        assert!(
            load_result.is_ok(),
            "Protobuf loading failed: {:?}",
            load_result.err()
        );

        assert_eq!(geco2.get_animation_name(), "Proto Cycle");
        assert_eq!(geco2.get_total_frames(), 30);

        let features_json = geco2.get_renderable_features_json_at_frame(5);
        assert!(features_json.contains("ProtoFeat"));
        assert!(features_json.contains("\"x\":0.7071"));
    }

    #[wasm_bindgen_test]
    fn test_load_invalid_protobuf_wasm() {
        let mut geco = Geco::new();
        let invalid_data = vec![0, 1, 2, 3, 4, 5];
        let result = geco.load_animation_protobuf(&invalid_data);
        assert!(result.is_err());
        let err_msg = result.unwrap_err().as_string().unwrap_or_default();
        assert!(err_msg.contains("Failed to decode Protobuf"));
    }
}
