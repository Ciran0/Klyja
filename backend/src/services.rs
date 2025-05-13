// klyja/backend/src/services.rs

use crate::{
    models::{Animation, NewAnimation}, // We'll need these for DB interaction
    protobuf_gen::MapAnimation,        // For decoding
    schema,                            // For Diesel query building
    DbPool,                            // The database pool type from main.rs
};
use axum::{
    body::Bytes,
    http::StatusCode, // We'll use this for the temporary error type
};
use diesel::prelude::*;
use prost::Message; // For decoding protobuf

// We can group our service functions, conceptually, using a struct.
// It doesn't need to hold any data for now.
pub struct AnimationService;

impl AnimationService {
    pub async fn save_animation_logic(
        pool: &DbPool, // Renamed parameter for clarity from 'body' in handler
        animation_data_bytes: Bytes,
    ) -> Result<(), (StatusCode, String)> {
        tracing::info!(
            "SERVICE: Processing save_animation_logic with {} bytes",
            animation_data_bytes.len()
        );

        // 1. Validate by trying to decode the Protobuf data
        let map_animation = MapAnimation::decode(animation_data_bytes.clone()) // Use the passed Bytes
            .map_err(|e| {
                tracing::error!("SERVICE: Protobuf decoding failed: {}", e);
                (
                    StatusCode::BAD_REQUEST,
                    format!("Invalid Protobuf data: {}", e),
                )
            })?;

        // 2. Get a database connection
        //    Diesel operations are blocking, so they should be run in a way that doesn't block the async executor.
        //    tokio::task::block_in_place is suitable for short blocking operations.
        //    For longer operations, tokio::task::spawn_blocking is preferred.
        let mut conn = tokio::task::block_in_place(|| pool.get()).map_err(|e| {
            tracing::error!("SERVICE: Failed to get DB connection: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Database connection error".to_string(), // More specific message
            )
        })?;

        // 3. Prepare data for insertion
        let animation_name = map_animation.name.as_str(); // map_animation is from decoding
        let new_animation_payload = NewAnimation {
            // Renamed variable for clarity
            name: animation_name,
            protobuf_data: &animation_data_bytes, // Use the original raw bytes slice passed to this function
        };

        // 4. Insert into database using Diesel
        tokio::task::block_in_place(move || {
            // `conn` and `new_animation_payload` are moved into this closure
            diesel::insert_into(schema::animations::table)
                .values(&new_animation_payload) // Use the new variable name
                .execute(&mut conn)
        })
        .map_err(|e| {
            tracing::error!("SERVICE: Database insert failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to save animation to database".to_string(), // More specific message
            )
        })?;

        tracing::info!(
            "SERVICE: Animation '{}' saved successfully.",
            animation_name
        );
        Ok(()) // Return Ok(()) on success
    }

    // This function will contain the business logic for loading an animation.
    // It takes the database pool and the animation_id.
    // For now, it will return Ok(Animation) on success, or an Err with StatusCode and String on failure.
    pub async fn load_animation_logic(
        pool: &DbPool,
        animation_id_to_load: i32,
    ) -> Result<Animation, (StatusCode, String)> {
        // Returns Ok(Animation)
        tracing::info!(
            "SERVICE: Processing load_animation_logic for ID: {}",
            animation_id_to_load
        );

        // 1. Get a database connection
        let mut conn = tokio::task::block_in_place(|| pool.get()).map_err(|e| {
            tracing::error!("SERVICE: Failed to get DB connection: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Database connection error".to_string(),
            )
        })?;

        // 2. Query the database using Diesel
        use crate::schema::animations::dsl::*; // Import Diesel DSL for this specific query

        let loaded_animation = tokio::task::block_in_place(move || {
            // `conn` and `animation_id_to_load` are moved
            animations
                .find(animation_id_to_load) // Use the passed ID
                .select(Animation::as_select())
                .first::<Animation>(&mut conn) // Specify type for .first()
        })
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                tracing::warn!(
                    "SERVICE: Animation with ID {} not found",
                    animation_id_to_load
                );
                (
                    StatusCode::NOT_FOUND,
                    format!("Animation ID {} not found", animation_id_to_load),
                )
            }
            _ => {
                tracing::error!("SERVICE: Database query failed: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to load animation from database".to_string(),
                )
            }
        })?;

        tracing::info!(
            "SERVICE: Animation '{}' (ID: {}) loaded successfully.",
            loaded_animation.name,
            animation_id_to_load
        );
        Ok(loaded_animation) // Return the loaded Animation struct on success
    }
}
