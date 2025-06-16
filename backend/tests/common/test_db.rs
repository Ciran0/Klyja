// backend/tests/common/test_db.rs
use diesel::prelude::*;
use diesel::r2d2::{self, ConnectionManager, Pool};
use diesel::sql_query;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use std::env;

// Import the same migrations from your main app
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../migrations");

pub type TestDbPool = Pool<ConnectionManager<PgConnection>>;

/// Test database configuration
pub struct TestDb {
    pub pool: TestDbPool,
    db_name: String,
    _base_pool: TestDbPool, // Keep connection to postgres db for cleanup
}

impl TestDb {
    /// Creates a new test database with a unique name
    pub fn new() -> Self {
        // Get base database URL (should point to postgres database)
        let base_url = env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgres://user:password@localhost:5433/postgres".to_string());

        // Generate unique database name using timestamp and random number
        let db_name = format!(
            "klyja_test_{}_{}",
            chrono::Utc::now().timestamp_millis(),
            rand::random::<u32>()
        );

        // Create connection to postgres database for administrative tasks
        let manager = ConnectionManager::<PgConnection>::new(&base_url);
        let base_pool = r2d2::Pool::builder()
            .max_size(1)
            .build(manager)
            .expect("Failed to create base pool");

        // Create the test database
        {
            let mut conn = base_pool.get().expect("Failed to get base connection");
            let query = format!("CREATE DATABASE \"{}\"", db_name);
            sql_query(query)
                .execute(&mut conn)
                .expect("Failed to create test database");
        }

        // Create connection pool for the test database
        let test_db_url = base_url.rsplit_once('/').unwrap().0.to_string() + "/" + &db_name;
        let manager = ConnectionManager::<PgConnection>::new(&test_db_url);
        let pool = r2d2::Pool::builder()
            .max_size(5)
            .build(manager)
            .expect("Failed to create test pool");

        // Run migrations
        {
            let mut conn = pool.get().expect("Failed to get test connection");
            conn.run_pending_migrations(MIGRATIONS)
                .expect("Failed to run migrations");
        }

        TestDb {
            pool,
            db_name,
            _base_pool: base_pool,
        }
    }

    /// Get a connection from the test pool
    pub fn conn(&self) -> r2d2::PooledConnection<ConnectionManager<PgConnection>> {
        self.pool.get().expect("Failed to get test connection")
    }
}

impl Drop for TestDb {
    fn drop(&mut self) {
        // Close all connections to the test database
        // Note: In a real scenario, you might need to force disconnect active connections

        // Drop the test database
        if let Ok(mut conn) = self._base_pool.get() {
            // Terminate existing connections to the test database
            let terminate_query = format!(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
                 WHERE datname = '{}' AND pid <> pg_backend_pid()",
                self.db_name
            );
            let _ = sql_query(terminate_query).execute(&mut conn);

            // Drop the database
            let drop_query = format!("DROP DATABASE IF EXISTS \"{}\"", self.db_name);
            let _ = sql_query(drop_query).execute(&mut conn);
        }
    }
}

/// Creates test data for integration tests
pub mod fixtures {
    use backend::models::{Animation, NewAnimation};
    // Corrected imports based on the new structure (Feature, FeatureType, Point, etc.)
    use backend::protobuf_gen::{
        Feature, FeatureStructureSnapshot, FeatureType, MapAnimation, Point, PointAnimationPath,
        PositionKeyframe,
    };
    use diesel::prelude::*;
    use prost::Message;
    use std::collections::HashMap; // For feature properties

    pub fn create_test_animation_proto(name: &str) -> Vec<u8> {
        let initial_point_pos = Point {
            x: 1.0,
            y: 2.0,
            z: Some(3.0),
        };

        let point_animation_path = PointAnimationPath {
            point_id: "test-point-id".to_string(),
            keyframes: vec![PositionKeyframe {
                frame: 0,
                position: Some(initial_point_pos),
            }],
        };

        let feature_structure_snapshot = FeatureStructureSnapshot {
            frame: 0,
            ordered_point_ids: vec!["test-point-id".to_string()],
        };

        let test_feature = Feature {
            feature_id: "test-feature-id".to_string(),
            name: "Test Feature".to_string(),
            r#type: FeatureType::Polygon as i32, // Example: Polygon type
            appearance_frame: 0,
            disappearance_frame: 30,
            point_animation_paths: vec![point_animation_path],
            structure_snapshots: vec![feature_structure_snapshot],
            properties: HashMap::new(),
        };

        let animation = MapAnimation {
            animation_id: format!("test-{}", uuid::Uuid::new_v4()),
            name: name.to_string(),
            total_frames: 30,
            features: vec![test_feature], // Changed from polygons
        };

        animation.encode_to_vec()
    }

    pub fn insert_test_animation(conn: &mut PgConnection, name: &str) -> Animation {
        use backend::schema::animations;

        let new_animation = NewAnimation {
            name,
            protobuf_data: &create_test_animation_proto(name),
            user_id: None,
        };

        diesel::insert_into(animations::table)
            .values(&new_animation)
            .get_result::<Animation>(conn)
            .expect("Failed to insert test animation")
    }
}
