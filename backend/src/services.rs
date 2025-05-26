// backend/src/services.rs
use crate::{
    errors::AppError,
    models::{Animation, NewAnimation},
    protobuf_gen::MapAnimation,
    schema, DbPool,
};
use axum::body::Bytes;
use diesel::prelude::*;
use prost::Message;

pub struct AnimationService;

impl AnimationService {
    pub async fn save_animation_logic(
        pool: &DbPool, // Keep as reference
        animation_data_bytes: Bytes,
    ) -> Result<i32, AppError> {
        tracing::info!(
            "SERVICE: Processing save_animation_logic with {} bytes",
            animation_data_bytes.len()
        );

        let map_animation = MapAnimation::decode(animation_data_bytes.clone())?;

        // Clone the pool and other necessary data to move into the blocking task
        let pool_clone = pool.clone();
        let name_for_blocking_task = map_animation.name.clone(); // Renamed for clarity
        let data_for_blocking = animation_data_bytes.clone();

        let saved_animation_id = tokio::task::spawn_blocking(move || {
            let mut conn = pool_clone.get().map_err(AppError::DatabasePool)?;
            let new_animation_payload = NewAnimation {
                name: &name_for_blocking_task, // Use the string cloned for the task
                protobuf_data: &data_for_blocking,
            };

            diesel::insert_into(schema::animations::table)
                .values(&new_animation_payload)
                .get_result::<Animation>(&mut conn)
                .map_err(AppError::DatabaseQuery)
                .map(|anim| anim.id)
        })
        .await
        .map_err(|join_err| {
            AppError::Internal(format!("Tokio spawn_blocking join error: {}", join_err))
        })??;

        tracing::info!(
            "SERVICE: Animation '{}' saved successfully with ID {}.",
            map_animation.name, // Use the original map_animation.name for logging here
            saved_animation_id
        );
        Ok(saved_animation_id)
    }

    pub async fn load_animation_logic(
        pool: &DbPool,
        animation_id_to_load: i32,
    ) -> Result<Animation, AppError> {
        tracing::info!(
            "SERVICE: Processing load_animation_logic for ID: {}",
            animation_id_to_load
        );

        let pool_clone = pool.clone();

        let loaded_animation = tokio::task::spawn_blocking(move || {
            let mut conn = pool_clone.get().map_err(AppError::DatabasePool)?; // Get conn and map r2d2 error
            use crate::schema::animations::dsl::*;

            let query_result: Result<Animation, diesel::result::Error> = animations
                .find(animation_id_to_load)
                .select(Animation::as_select())
                .first::<Animation>(&mut conn);

            // Explicitly convert diesel::result::Error to AppError using your From trait impl
            query_result.map_err(AppError::from)
        })
        .await // Wait for the blocking task
        .map_err(|join_err| {
            AppError::Internal(format!("Tokio spawn_blocking join error: {}", join_err))
        })??; // First ? for JoinError, second ? for AppError from the closure

        tracing::info!(
            "SERVICE: Animation '{}' (ID: {}) loaded successfully.",
            loaded_animation.name,
            animation_id_to_load
        );
        Ok(loaded_animation)
    }
}
