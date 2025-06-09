// klyja/geco/tests/wasm_tests.rs

#[cfg(target_arch = "wasm32")]
mod wasm_tests {
    use geco::Geco;
    use geco::TestAnimationState;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

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
        assert!(geco.get_active_feature_id().is_some());
        assert_eq!(geco.get_active_feature_id().as_ref().unwrap(), &feature_id1);

        let feature_id2 = geco.create_feature("MyLine".to_string(), 2, 5, 15).unwrap();
        assert_eq!(geco.get_active_feature_id().as_ref().unwrap(), &feature_id2);

        // Use the test helper to check the state
        let state_js = geco.get_state_for_testing().unwrap();
        let state: TestAnimationState = serde_wasm_bindgen::from_value(state_js).unwrap();

        // Assert against the structured data
        assert_eq!(state.features.len(), 2);
        assert_eq!(state.features[0].name, "MyPoly");
        assert_eq!(state.features[1].name, "MyLine");
        assert_eq!(state.active_feature_id, Some(feature_id2));
    }

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
        let mut geco = Geco::new();
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

    #[wasm_bindgen_test]
    fn test_add_point_to_active_feature_wasm() {
        let mut geco = Geco::new();
        geco.create_feature("TestFeat".to_string(), 1, 0, 10)
            .unwrap();
        let point_id = geco
            .add_point_to_active_feature("p1".to_string(), 0, 1.0, 2.0, Some(0.5))
            .unwrap();
        assert_eq!(point_id, "p1");

        let state: TestAnimationState =
            serde_wasm_bindgen::from_value(geco.get_state_for_testing().unwrap()).unwrap();

        assert_eq!(state.features.len(), 1, "There should be one feature.");
        assert_eq!(state.features[0].name, "TestFeat");
        assert_eq!(
            state.features[0].point_count, 1,
            "The feature should have one point."
        );
        assert_eq!(
            state.features[0].keyframe_count, 1,
            "The new point should have one keyframe."
        );
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

        let state: TestAnimationState =
            serde_wasm_bindgen::from_value(geco.get_state_for_testing().unwrap()).unwrap();

        assert_eq!(state.features.len(), 1);
        assert_eq!(state.features[0].name, "GenIdFeat");
        assert_eq!(state.features[0].point_count, 1);
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

        let initial_state: TestAnimationState =
            serde_wasm_bindgen::from_value(geco.get_state_for_testing().unwrap()).unwrap();
        assert_eq!(initial_state.features[0].keyframe_count, 1);

        geco.add_position_keyframe_to_point(
            feature_id.clone(),
            point_id.clone(),
            10,
            0.0,
            1.0,
            Some(0.0),
        )
        .unwrap();

        let final_state: TestAnimationState =
            serde_wasm_bindgen::from_value(geco.get_state_for_testing().unwrap()).unwrap();
        assert_eq!(
            final_state.features[0].keyframe_count, 2,
            "A keyframe should have been added."
        );
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

        let state: TestAnimationState =
            serde_wasm_bindgen::from_value(geco2.get_state_for_testing().unwrap()).unwrap();

        assert_eq!(state.name, "Proto Cycle");
        assert_eq!(state.total_frames, 30);
        assert_eq!(
            state.features.len(),
            1,
            "Should have one feature after loading."
        );
        assert_eq!(state.features[0].name, "ProtoFeat");
        assert_eq!(
            state.features[0].point_count, 1,
            "Feature should have one point."
        );
        assert_eq!(
            state.features[0].keyframe_count, 2,
            "Point should have two keyframes."
        );
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
