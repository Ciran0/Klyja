#![allow(unused_imports)]

#[cfg(test)]
mod feature_animation_tests {
    use crate::interpolate_point_position;
    use crate::protobuf_gen::{
        Feature, FeatureStructureSnapshot, FeatureType, MapAnimation, Point, PointAnimationPath,
        PositionKeyframe,
    };
    use crate::Geco;

    fn create_test_geco() -> Geco {
        Geco::new()
    }

    #[test]
    fn test_geco_new_state() {
        let geco = create_test_geco();
        assert_eq!(geco.get_animation_name(), "Untitled Animation");
        assert!(geco.animation_state.features.is_empty());
        assert_eq!(geco.get_total_frames(), 100); // Default total_frames
    }

    #[test]
    fn test_create_feature() {
        let mut geco = create_test_geco();
        let feature_id = geco
            .create_feature(
                "Test Feature".to_string(),
                1, // Represents FeatureType::Polygon
                0,
                100,
            )
            .unwrap();

        assert_eq!(geco.animation_state.features.len(), 1);
        let feature = geco.animation_state.features.first().unwrap();
        assert_eq!(feature.feature_id, feature_id);
        assert_eq!(feature.name, "Test Feature");
        assert_eq!(feature.r#type, 1);
        assert_eq!(feature.appearance_frame, 0);
        assert_eq!(feature.disappearance_frame, 100);
        assert_eq!(geco.active_feature_id, Some(feature_id));
    }

    #[test]
    fn test_add_point_and_initial_keyframe() {
        let mut geco = create_test_geco();
        let feature_id = geco.create_feature("Poly".to_string(), 1, 0, 50).unwrap();
        let point_id = geco
            .add_point_to_active_feature("p1".to_string(), 0, 1.0, 2.0, Some(3.0))
            .unwrap();

        let feature = geco.animation_state.features.first().unwrap();
        assert_eq!(feature.point_animation_paths.len(), 1);
        let path = feature.point_animation_paths.first().unwrap();
        assert_eq!(path.point_id, point_id);
        assert_eq!(path.keyframes.len(), 1);
        let keyframe = path.keyframes.first().unwrap();
        assert_eq!(keyframe.frame, 0);
        assert_eq!(
            keyframe.position,
            Some(Point {
                x: 1.0,
                y: 2.0,
                z: Some(3.0)
            })
        );

        // Check initial structure snapshot
        assert_eq!(feature.structure_snapshots.len(), 1);
        let snapshot = feature.structure_snapshots.first().unwrap();
        assert_eq!(snapshot.frame, 0); // Assuming appearance_frame was 0
        assert_eq!(snapshot.ordered_point_ids, vec![point_id]);
    }

    #[test]
    fn test_add_multiple_keyframes_to_point() {
        let mut geco = create_test_geco();
        let feature_id = geco.create_feature("Line".to_string(), 2, 0, 10).unwrap();
        let point_id = geco
            .add_point_to_active_feature("p1".to_string(), 0, 0.0, 0.0, Some(0.0))
            .unwrap();

        geco.add_position_keyframe_to_point(
            feature_id.clone(),
            point_id.clone(),
            5,
            5.0,
            5.0,
            Some(0.0),
        )
        .unwrap();
        geco.add_position_keyframe_to_point(
            feature_id.clone(),
            point_id.clone(),
            2,
            2.0,
            2.0,
            Some(0.0),
        )
        .unwrap(); // Add out of order

        let feature = geco.animation_state.features.first().unwrap();
        let path = feature.point_animation_paths.first().unwrap();
        assert_eq!(path.keyframes.len(), 3);
        assert_eq!(path.keyframes[0].frame, 0); // Check sorting
        assert_eq!(path.keyframes[1].frame, 2);
        assert_eq!(path.keyframes[2].frame, 5);
    }

    #[test]
    fn test_interpolate_point_position_logic() {
        let path = PointAnimationPath {
            point_id: "test_p".to_string(),
            keyframes: vec![
                PositionKeyframe {
                    frame: 0,
                    position: Some(Point {
                        x: 0.0,
                        y: 0.0,
                        z: Some(0.0),
                    }),
                },
                PositionKeyframe {
                    frame: 10,
                    position: Some(Point {
                        x: 10.0,
                        y: 20.0,
                        z: Some(10.0),
                    }),
                },
            ],
        };

        // Before first keyframe
        let pos_before = interpolate_point_position(&path, -5).unwrap();
        assert_eq!(pos_before.x, 0.0);

        // At first keyframe
        let pos_kf1 = interpolate_point_position(&path, 0).unwrap();
        assert_eq!(pos_kf1.x, 0.0);

        // Between keyframes
        let pos_mid = interpolate_point_position(&path, 5).unwrap();
        assert_eq!(pos_mid.x, 5.0);
        assert_eq!(pos_mid.y, 10.0);
        assert_eq!(pos_mid.z, Some(5.0));

        // At second keyframe
        let pos_kf2 = interpolate_point_position(&path, 10).unwrap();
        assert_eq!(pos_kf2.x, 10.0);

        // After last keyframe
        let pos_after = interpolate_point_position(&path, 15).unwrap();
        assert_eq!(pos_after.x, 10.0);
    }

    #[test]
    fn test_get_renderable_features_json_at_frame_basic() {
        let mut geco = create_test_geco();
        let fid = geco
            .create_feature("TestPoly".to_string(), 1, 0, 100)
            .unwrap();
        let p1_id = geco
            .add_point_to_active_feature("p1".to_string(), 0, 0.0, 0.0, Some(0.0))
            .unwrap();
        let _p2_id = geco
            .add_point_to_active_feature("p2".to_string(), 0, 10.0, 0.0, Some(0.0))
            .unwrap();

        geco.add_position_keyframe_to_point(fid.clone(), p1_id.clone(), 10, 10.0, 10.0, Some(0.0))
            .unwrap();

        // Frame 0
        let json_frame0 = geco.get_renderable_features_json_at_frame(0);
        // TODO: Add actual JSON parsing and assertion here. For now, just check it's not empty.
        // Example: let parsed: Vec<RenderableFeatureJson> = serde_json::from_str(&json_frame0).unwrap();
        // assert_eq!(parsed.len(), 1); etc.
        assert!(json_frame0.contains("\"name\":\"TestPoly")); // Basic check
        assert!(json_frame0.contains("\"feature_id\":"));
        assert!(json_frame0.contains("\"x\":0.0")); // p1 at frame 0

        // Frame 5 (p1 should be halfway)
        let json_frame5 = geco.get_renderable_features_json_at_frame(5);
        assert!(json_frame5.contains("\"x\":5.0")); // p1.x interpolated
        assert!(json_frame5.contains("\"y\":5.0")); // p1.y interpolated

        // Frame 10 (p1 at its second keyframe)
        let json_frame10 = geco.get_renderable_features_json_at_frame(10);
        assert!(json_frame10.contains("\"x\":10.0"));
        assert!(json_frame10.contains("\"y\":10.0"));

        // Frame 101 (feature should be inactive)
        let json_frame101 = geco.get_renderable_features_json_at_frame(101);
        assert_eq!(json_frame101, "[]");
    }

    #[test]
    fn test_protobuf_serialization_with_features() {
        let mut geco1 = create_test_geco();
        geco1.set_animation_name("Feature Test Animation".to_string());
        geco1.set_total_frames(20);
        let fid = geco1
            .create_feature("MyFeature".to_string(), 2, 5, 15)
            .unwrap();
        let p1id = geco1
            .add_point_to_active_feature("p1".to_string(), 5, 1.0, 1.0, None)
            .unwrap();
        geco1
            .add_position_keyframe_to_point(fid.clone(), p1id.clone(), 10, 5.0, 5.0, None)
            .unwrap();

        let bytes = geco1.get_animation_protobuf();
        assert!(!bytes.is_empty());

        let mut geco2 = Geco::new();
        geco2.load_animation_protobuf(&bytes).unwrap();

        assert_eq!(geco2.get_animation_name(), "Feature Test Animation");
        assert_eq!(geco2.get_total_frames(), 20);
        assert_eq!(geco2.animation_state.features.len(), 1);
        let feature = geco2.animation_state.features.first().unwrap();
        assert_eq!(feature.name, "MyFeature");
        assert_eq!(feature.point_animation_paths.len(), 1);
        // Further checks on deserialized data...
        let json_frame7 = geco2.get_renderable_features_json_at_frame(7); // Mid-animation for p1
        assert!(json_frame7.contains("\"name\":\"MyFeature"));
    }
}
