// klyja/backend/src/lib.rs

// Include Generated Protobuf Code
pub mod protobuf_gen {
    include!(concat!(env!("OUT_DIR"), "/klyja.map_animation.v1.rs"));
}

pub mod db;
pub mod errors;
pub mod handlers;
pub mod models;
pub mod schema; // Will be generated by diesel print-schema
pub mod services;

// Define a type alias for the connection pool
pub type DbPool = r2d2::Pool<diesel::r2d2::ConnectionManager<diesel::PgConnection>>;

// We'll add some basic unit tests here
#[cfg(test)]
mod tests {
    use crate::errors::AppError;
    use crate::models::Animation;
    use crate::protobuf_gen::MapAnimation;
    use diesel::result::Error as DieselError;
    use prost::DecodeError;

    #[test]
    fn test_app_error_from_diesel_error() {
        let diesel_error = DieselError::NotFound;
        let app_error = AppError::from(diesel_error);
        
        match app_error {
            AppError::NotFound(_) => {}, // This is what we expect
            _ => panic!("Expected NotFound error"),
        }
        
        let other_error = DieselError::RollbackTransaction;
        let app_error = AppError::from(other_error);
        
        match app_error {
            AppError::DatabaseQuery(_) => {}, // This is what we expect for non-NotFound errors
            _ => panic!("Expected DatabaseQuery error"),
        }
    }
    
    #[test]
    fn test_app_error_from_decode_error() {
        let decode_error = DecodeError::new("Test decode error");
        let app_error = AppError::from(decode_error);
        
        match app_error {
            AppError::ProtobufDecode(_) => {}, // This is expected
            _ => panic!("Expected ProtobufDecode error"),
        }
    }
    
    #[test]
    fn test_animation_serialization() {
        let now = chrono::Local::now().naive_local();
        let animation = Animation {
            id: 1,
            name: "Test Animation".to_string(),
            protobuf_data: vec![1, 2, 3, 4],
            created_at: now,
            updated_at: now,
        };
        
        let json = serde_json::to_string(&animation).expect("Failed to serialize Animation");
        
        assert!(json.contains("\"id\":1"));
        assert!(json.contains("\"name\":\"Test Animation\""));
        assert!(!json.contains("protobuf_data")); // Skipped in serialization
    }
    
    #[test]
    fn test_map_animation_default() {
        let animation = MapAnimation::default();
        
        assert_eq!(animation.name, "");
        assert!(animation.polygons.is_empty());
        assert_eq!(animation.total_frames, 0);
    }
}