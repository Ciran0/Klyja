#![allow(unused_imports)]

#[cfg(test)]
mod feature_animation_tests {
    use crate::interpolate_point_position;
    use crate::protobuf_gen::{
        Feature, FeatureStructureSnapshot, FeatureType, MapAnimation, Point, PointAnimationPath,
        PositionKeyframe,
    };
    use crate::Geco;
    use crate::{RenderableFeatureJson, WasmVectorData};
    use nalgebra::Vector3;
    // wasm_bindgen::JsValue is not typically used directly in #[test] unless also cfg(target_arch="wasm32")

    fn create_test_geco() -> Geco {
        Geco::new()
    }

    // Add this test function to the `mod feature_animation_tests { ... }` block in geco/src/lib_test.rs

    // This test requires `serde_wasm_bindgen` in your [dev-dependencies]
    // cargo add --dev serde-wasm-bindgen
    // You also may need wasm-bindgen-test for deserializing JsValue in a test environment
    use wasm_bindgen_test::*;
    wasm_bindgen_test_configure!(run_in_browser); // Or use a node environment

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen_test]
    fn test_get_renderable_line_segments_at_frame() {
        let mut geco = create_test_geco();

        // Create a square polygon feature (4 points)
        geco.create_feature("Square".to_string(), 1, 0, 100)
            .unwrap(); // 1 = Polygon
        geco.add_point_to_active_feature("p1".to_string(), 0, 1.0, 0.0, Some(0.0))
            .unwrap(); // (1,0,0)
        geco.add_point_to_active_feature("p2".to_string(), 0, 0.0, 1.0, Some(0.0))
            .unwrap(); // (0,1,0)
        geco.add_point_to_active_feature("p3".to_string(), 0, -1.0, 0.0, Some(0.0))
            .unwrap(); // (-1,0,0)
        geco.add_point_to_active_feature("p4".to_string(), 0, 0.0, -1.0, Some(0.0))
            .unwrap(); // (0,-1,0)

        // Call the new function
        let result_js_value = geco.get_renderable_line_segments_at_frame(0).unwrap();
        let result_data: WasmVectorData = serde_wasm_bindgen::from_value(result_js_value).unwrap();

        // Assertions
        // A square polygon has 4 closing segments
        assert_eq!(
            result_data.segment_count, 4,
            "Should have 4 segments for a square polygon"
        );

        // Each segment has 2 points, each point has 3 coordinates (x,y,z)
        // 4 segments * 2 points/segment * 4 floats/point = 32 floats
        assert_eq!(
            result_data.vertex_data.len(),
            32,
            "Vertex data should have 32 floats"
        );

        // Check the coordinates of the first segment (p1 -> p2)
        // The points were normalized when added, so their coords remain (1,0,0), (0,1,0) etc.
        let expected_first_segment = vec![
            1.0, 0.0, 0.0, 1.0, // p1
            0.0, 1.0, 0.0, 1.0, // p2
        ];
        assert_eq!(
            &result_data.vertex_data[0..8],
            &expected_first_segment,
            "First segment data is incorrect"
        );

        // Check the coordinates of the last segment (p4 -> p1)
        let expected_last_segment = vec![
            0.0, -1.0, 0.0, 1.0, // p4
            1.0, 0.0, 0.0, 1.0, // p1
        ];
        assert_eq!(
            &result_data.vertex_data[24..32],
            &expected_last_segment,
            "Last segment data is incorrect"
        );
    }

    #[test]
    fn test_geco_new_state() {
        let geco = create_test_geco();
        assert_eq!(geco.get_animation_name(), "Untitled Animation");
        assert!(geco.animation_state.features.is_empty());
        assert_eq!(geco.get_total_frames(), 100); // Default total_frames
        assert!(geco.active_feature_id.is_none());
    }

    #[test]
    fn test_set_total_frames() {
        let mut geco = create_test_geco();
        geco.set_total_frames(150);
        assert_eq!(geco.get_total_frames(), 150);
        geco.set_total_frames(0); // Should not change if invalid
        assert_eq!(geco.get_total_frames(), 150);
        geco.set_total_frames(-10); // Should not change
        assert_eq!(geco.get_total_frames(), 150);
    }

    #[test]
    fn test_create_feature() {
        // This test checks successful creation
        let mut geco = create_test_geco();
        let feature_id_poly = geco
            .create_feature(
                "Test Polygon".to_string(),
                1, // Represents FeatureType::Polygon
                0,
                100,
            )
            .unwrap();

        let feature_id_line = geco
            .create_feature(
                "Test Polyline".to_string(),
                2, // Represents FeatureType::Polyline
                10,
                90,
            )
            .unwrap();

        assert_eq!(geco.animation_state.features.len(), 2);
        let poly_feature = geco
            .animation_state
            .features
            .iter()
            .find(|f| f.feature_id == feature_id_poly)
            .unwrap();
        assert_eq!(poly_feature.name, "Test Polygon");
        assert_eq!(poly_feature.r#type, FeatureType::Polygon as i32);
        assert_eq!(poly_feature.appearance_frame, 0);
        assert_eq!(poly_feature.disappearance_frame, 100);
        assert_eq!(geco.active_feature_id, Some(feature_id_line.clone())); // Last created is active

        let line_feature = geco
            .animation_state
            .features
            .iter()
            .find(|f| f.feature_id == feature_id_line)
            .unwrap();
        assert_eq!(line_feature.name, "Test Polyline");
        assert_eq!(line_feature.r#type, FeatureType::Polyline as i32);
    }

    // test_create_feature_invalid_type MOVED TO wasm_tests.rs

    #[test]
    fn test_add_point_to_active_feature_and_keyframe() {
        // This test checks successful additions
        let mut geco = create_test_geco();
        let feature_id = geco.create_feature("Poly".to_string(), 1, 0, 50).unwrap(); // Active feature

        // Add first point "p1" at frame 0
        let p1_id = geco
            .add_point_to_active_feature("p1".to_string(), 0, 1.0, 0.0, Some(0.0))
            .unwrap();

        // --- Assertions after adding p1 ---
        let feature_after_p1 = geco
            .animation_state
            .features
            .iter()
            .find(|f| f.feature_id == feature_id)
            .unwrap();

        // Check point paths
        assert_eq!(feature_after_p1.point_animation_paths.len(), 1);
        let path_p1 = feature_after_p1.point_animation_paths.first().unwrap();
        assert_eq!(path_p1.point_id, p1_id);
        assert_eq!(path_p1.keyframes.len(), 1);
        let keyframe_p1 = path_p1.keyframes.first().unwrap();
        assert_eq!(keyframe_p1.frame, 0);
        let pos_p1 = keyframe_p1.position.as_ref().unwrap();
        assert!((pos_p1.x - 1.0).abs() < 1e-6); // Assuming 1.0,0,0 is normalized to 1,0,0
        assert!((pos_p1.y - 0.0).abs() < 1e-6);
        assert!((pos_p1.z.unwrap_or_default() - 0.0).abs() < 1e-6);

        // Check structure snapshots after p1
        // Should have one snapshot at frame 0 (from create_feature, updated by add_point)
        assert_eq!(feature_after_p1.structure_snapshots.len(), 1);
        let snapshot_frame0_after_p1 = feature_after_p1
            .structure_snapshots
            .iter()
            .find(|s| s.frame == 0)
            .expect("Snapshot at frame 0 not found after adding p1");
        assert_eq!(
            snapshot_frame0_after_p1.ordered_point_ids,
            vec![p1_id.clone()]
        );

        // Add second point "p2" at frame 5
        let p2_id = geco
            .add_point_to_active_feature("p2".to_string(), 5, 0.0, 1.0, Some(0.0))
            .unwrap();

        // --- Assertions after adding p2 ---
        let feature_after_p2 = geco
            .animation_state
            .features
            .iter()
            .find(|f| f.feature_id == feature_id)
            .unwrap();

        // Check point paths
        assert_eq!(feature_after_p2.point_animation_paths.len(), 2);

        // Check structure snapshots after p2
        // Should now have two snapshots: frame 0 with [p1], and frame 5 with [p1, p2]
        assert_eq!(feature_after_p2.structure_snapshots.len(), 2);

        // Verify snapshot at frame 0 remains unchanged regarding its points
        let final_snapshot_frame0 = feature_after_p2
            .structure_snapshots
            .iter()
            .find(|s| s.frame == 0)
            .expect("Snapshot at frame 0 not found after adding p2");
        assert_eq!(final_snapshot_frame0.ordered_point_ids, vec![p1_id.clone()]);

        // Verify snapshot at frame 5 (this is what the original failing assertion likely intended to check)
        let snapshot_frame5 = feature_after_p2
            .structure_snapshots
            .iter()
            .find(|s| s.frame == 5)
            .expect("Snapshot at frame 5 not found after adding p2");
        assert_eq!(
            snapshot_frame5.ordered_point_ids,
            vec![p1_id.clone(), p2_id.clone()]
        );
    }
    // test_add_point_duplicate_id_in_feature MOVED TO wasm_tests.rs

    #[test]
    fn test_add_position_keyframe_to_point() {
        // This test checks successful keyframe addition
        let mut geco = create_test_geco();
        let feature_id = geco.create_feature("Line".to_string(), 2, 0, 10).unwrap();
        let point_id = geco
            .add_point_to_active_feature("p1".to_string(), 0, 1.0, 0.0, Some(0.0))
            .unwrap();

        geco.add_position_keyframe_to_point(
            feature_id.clone(),
            point_id.clone(),
            5,
            0.0,
            1.0,
            Some(0.0),
        )
        .unwrap();
        geco.add_position_keyframe_to_point(
            feature_id.clone(),
            point_id.clone(),
            2,
            0.0,
            0.0,
            Some(1.0),
        )
        .unwrap();

        let feature = geco.animation_state.features.first().unwrap();
        let path = feature.point_animation_paths.first().unwrap();
        assert_eq!(path.keyframes.len(), 3);
        assert_eq!(path.keyframes[0].frame, 0);
        let pos_kf0 = path.keyframes[0].position.as_ref().unwrap();
        assert!(
            (pos_kf0.x - 1.0).abs() < 1e-6
                && (pos_kf0.y).abs() < 1e-6
                && (pos_kf0.z.unwrap()).abs() < 1e-6
        );
        assert_eq!(path.keyframes[1].frame, 2);
        let pos_kf1 = path.keyframes[1].position.as_ref().unwrap();
        assert!(
            (pos_kf1.x).abs() < 1e-6
                && (pos_kf1.y).abs() < 1e-6
                && (pos_kf1.z.unwrap() - 1.0).abs() < 1e-6
        );
        assert_eq!(path.keyframes[2].frame, 5);
        let pos_kf2 = path.keyframes[2].position.as_ref().unwrap();
        assert!(
            (pos_kf2.x).abs() < 1e-6
                && (pos_kf2.y - 1.0).abs() < 1e-6
                && (pos_kf2.z.unwrap()).abs() < 1e-6
        );
    }

    #[test]
    fn test_interpolate_point_position_slerp_logic() {
        let kf1_pos = Point {
            x: 1.0,
            y: 0.0,
            z: Some(0.0),
        };
        let kf2_pos = Point {
            x: 0.0,
            y: 1.0,
            z: Some(0.0),
        };
        let path = PointAnimationPath {
            point_id: "slerp_test_p".to_string(),
            keyframes: vec![
                PositionKeyframe {
                    frame: 0,
                    position: Some(kf1_pos.clone()),
                },
                PositionKeyframe {
                    frame: 10,
                    position: Some(kf2_pos.clone()),
                },
            ],
        };
        let pos_mid = interpolate_point_position(&path, 5).unwrap();
        assert!((pos_mid.x - 0.7071).abs() < 1e-4);
        assert!((pos_mid.y - 0.7071).abs() < 1e-4);
        assert!(pos_mid.z.unwrap().abs() < 1e-4);
        let mag_mid = (pos_mid.x.powi(2) + pos_mid.y.powi(2) + pos_mid.z.unwrap().powi(2)).sqrt();
        assert!((mag_mid - 1.0).abs() < 1e-5);
        let pos_start = interpolate_point_position(&path, 0).unwrap();
        assert!((pos_start.x - 1.0).abs() < 1e-6);
        let pos_end = interpolate_point_position(&path, 10).unwrap();
        assert!((pos_end.y - 1.0).abs() < 1e-6);
        let pos_before = interpolate_point_position(&path, -5).unwrap();
        assert!((pos_before.x - 1.0).abs() < 1e-6);
        let pos_after = interpolate_point_position(&path, 15).unwrap();
        assert!((pos_after.y - 1.0).abs() < 1e-6);
        let path_identical = PointAnimationPath {
            point_id: "identical_kf".to_string(),
            keyframes: vec![
                PositionKeyframe {
                    frame: 0,
                    position: Some(kf1_pos.clone()),
                },
                PositionKeyframe {
                    frame: 10,
                    position: Some(kf1_pos.clone()),
                },
            ],
        };
        let pos_identical_mid = interpolate_point_position(&path_identical, 5).unwrap();
        assert!((pos_identical_mid.x - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_interpolate_point_position_single_keyframe() {
        let path = PointAnimationPath {
            point_id: "single_kf_p".to_string(),
            keyframes: vec![PositionKeyframe {
                frame: 5,
                position: Some(Point {
                    x: 1.0,
                    y: 2.0,
                    z: Some(3.0),
                }),
            }],
        };
        let pos = interpolate_point_position(&path, 5).unwrap();
        assert_eq!(pos.x, 1.0);
        let pos_before = interpolate_point_position(&path, 0).unwrap();
        assert_eq!(pos_before.x, 1.0);
        let pos_after = interpolate_point_position(&path, 10).unwrap();
        assert_eq!(pos_after.x, 1.0);
    }

    #[test]
    fn test_interpolate_point_position_no_keyframes() {
        let path = PointAnimationPath {
            point_id: "no_kf_p".to_string(),
            keyframes: vec![],
        };
        assert!(interpolate_point_position(&path, 5).is_none());
    }

    #[test]
    fn test_get_renderable_features_json_at_frame_detailed() {
        let mut geco = create_test_geco();
        geco.set_total_frames(20);
        let fid1 = geco.create_feature("Poly1".to_string(), 1, 0, 10).unwrap();
        let p1_fid1 = geco
            .add_point_to_active_feature("p1".to_string(), 0, 1.0, 0.0, Some(0.0))
            .unwrap();
        let p2_fid1 = geco
            .add_point_to_active_feature("p2".to_string(), 0, 0.0, 1.0, Some(0.0))
            .unwrap();
        geco.add_position_keyframe_to_point(
            fid1.clone(),
            p1_fid1.clone(),
            10,
            -1.0,
            0.0,
            Some(0.0),
        )
        .unwrap();
        geco.add_position_keyframe_to_point(fid1.clone(), p2_fid1.clone(), 5, 0.0, -1.0, Some(0.0))
            .unwrap();
        let fid2 = geco.create_feature("Line1".to_string(), 2, 5, 15).unwrap();
        let p1_fid2 = geco
            .add_point_to_active_feature("p1".to_string(), 5, 0.0, 0.0, Some(1.0))
            .unwrap();
        geco.add_position_keyframe_to_point(
            fid2.clone(),
            p1_fid2.clone(),
            15,
            0.0,
            0.0,
            Some(-1.0),
        )
        .unwrap();

        let json_frame0 = geco.get_renderable_features_json_at_frame(0);
        let data_frame0: Vec<RenderableFeatureJson> = serde_json::from_str(&json_frame0).unwrap();
        assert_eq!(data_frame0.len(), 1);
        assert_eq!(data_frame0[0].name, "Poly1");
        assert_eq!(data_frame0[0].points.len(), 2);
        assert!((data_frame0[0].points[0].x - 1.0).abs() < 1e-5);
        assert!((data_frame0[0].points[1].y - 1.0).abs() < 1e-5);

        let json_frame5 = geco.get_renderable_features_json_at_frame(5);
        let data_frame5: Vec<RenderableFeatureJson> = serde_json::from_str(&json_frame5).unwrap();
        assert_eq!(data_frame5.len(), 2);
        let poly1_f5 = data_frame5.iter().find(|f| f.name == "Poly1").unwrap();
        let line1_f5 = data_frame5.iter().find(|f| f.name == "Line1").unwrap();
        assert_eq!(poly1_f5.points.len(), 2);
        assert!((poly1_f5.points[0].x - 0.0).abs() < 1e-5);
        assert!((poly1_f5.points[1].y - -1.0).abs() < 1e-5);
        assert_eq!(line1_f5.points.len(), 1);
        assert!((line1_f5.points[0].z.unwrap() - 1.0).abs() < 1e-5);

        let json_frame12 = geco.get_renderable_features_json_at_frame(12);
        let data_frame12: Vec<RenderableFeatureJson> = serde_json::from_str(&json_frame12).unwrap();
        assert_eq!(data_frame12.len(), 1);
        assert_eq!(data_frame12[0].name, "Line1");
        assert!((data_frame12[0].points[0].z.unwrap() - -0.5877).abs() < 1e-4);

        let json_frame20 = geco.get_renderable_features_json_at_frame(20);
        assert_eq!(json_frame20, "[]");
    }

    #[test]
    fn test_protobuf_serialization_deserialization_full_feature_cycle() {
        let mut geco1 = create_test_geco();
        geco1.set_animation_name("Full Cycle Test".to_string());
        geco1.set_total_frames(50);
        let fid = geco1
            .create_feature("AnimatedFeature".to_string(), 1, 10, 40)
            .unwrap();
        let p1id = geco1
            .add_point_to_active_feature("pt_a".to_string(), 10, 1.0, 0.0, Some(0.0))
            .unwrap();
        let p2id = geco1
            .add_point_to_active_feature("pt_b".to_string(), 15, 0.0, 1.0, Some(0.0))
            .unwrap();
        geco1
            .add_position_keyframe_to_point(fid.clone(), p1id.clone(), 20, 0.0, 0.0, Some(1.0))
            .unwrap();
        geco1
            .add_position_keyframe_to_point(fid.clone(), p1id.clone(), 30, -1.0, 0.0, Some(0.0))
            .unwrap();
        geco1
            .add_position_keyframe_to_point(fid.clone(), p2id.clone(), 25, 0.0, -1.0, Some(0.0))
            .unwrap();

        let bytes = geco1.get_animation_protobuf();
        assert!(!bytes.is_empty());
        let mut geco2 = Geco::new();
        geco2.load_animation_protobuf(&bytes).unwrap();
        assert_eq!(geco2.get_animation_name(), "Full Cycle Test");
        assert_eq!(geco2.get_total_frames(), 50);
        assert_eq!(geco2.animation_state.features.len(), 1);
        let feature = geco2.animation_state.features.first().unwrap();
        assert_eq!(feature.name, "AnimatedFeature");
        assert_eq!(feature.appearance_frame, 10);
        assert_eq!(feature.disappearance_frame, 40);
        assert_eq!(feature.point_animation_paths.len(), 2);

        let json_frame15 = geco2.get_renderable_features_json_at_frame(15);
        let data_f15: Vec<RenderableFeatureJson> = serde_json::from_str(&json_frame15).unwrap();
        assert_eq!(data_f15.len(), 1);
        assert_eq!(data_f15[0].points.len(), 2);
        assert!((data_f15[0].points[0].x - 0.7071).abs() < 1e-4);
        assert!((data_f15[0].points[1].y - 1.0).abs() < 1e-4);

        let json_frame35 = geco2.get_renderable_features_json_at_frame(35);
        let data_f35: Vec<RenderableFeatureJson> = serde_json::from_str(&json_frame35).unwrap();
        assert_eq!(data_f35.len(), 1);
        assert_eq!(data_f35[0].points.len(), 2);
        assert!((data_f35[0].points[0].x - -1.0).abs() < 1e-4);
        assert!((data_f35[0].points[1].y - -1.0).abs() < 1e-4);
    }
}
