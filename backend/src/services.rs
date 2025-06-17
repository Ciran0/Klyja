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
    // Modified to accept a user ID
    pub async fn save_animation_logic(
        pool: &DbPool,
        animation_data_bytes: Bytes,
        user_id: i32, // Added user_id parameter
    ) -> Result<i32, AppError> {
        tracing::info!(
            "SERVICE: User {} processing save_animation_logic with {} bytes",
            user_id,
            animation_data_bytes.len()
        );

        let map_animation = MapAnimation::decode(animation_data_bytes.clone())?;
        let pool_clone = pool.clone();
        let name_for_blocking_task = map_animation.name.clone();
        let data_for_blocking = animation_data_bytes.clone();

        let saved_animation_id = tokio::task::spawn_blocking(move || {
            let mut conn = pool_clone.get()?;
            let new_animation_payload = NewAnimation {
                name: &name_for_blocking_task,
                protobuf_data: &data_for_blocking,
                user_id: Some(user_id), // Set the user_id
            };

            diesel::insert_into(schema::animations::table)
                .values(&new_animation_payload)
                .returning(Animation::as_returning())
                .get_result::<Animation>(&mut conn)
                .map(|anim| anim.id)
                .map_err(AppError::from) // Use From trait for error conversion
        })
        .await??; // ?? unwraps JoinError then Result

        tracing::info!(
            "SERVICE: Animation '{}' saved successfully with ID {}.",
            map_animation.name,
            saved_animation_id
        );
        Ok(saved_animation_id)
    }

    // Modified to accept a user ID for authorization
    pub async fn load_animation_logic(
        pool: &DbPool,
        animation_id_to_load: i32,
        user_id: i32, // Added user_id for authorization check
    ) -> Result<Animation, AppError> {
        tracing::info!(
            "SERVICE: User {} processing load_animation_logic for ID: {}",
            user_id,
            animation_id_to_load
        );

        let pool_clone = pool.clone();

        let loaded_animation =
            tokio::task::spawn_blocking(move || -> Result<Animation, AppError> {
                let mut conn = pool_clone.get()?;
                use crate::schema::animations::dsl::{self, animations}; // Import dsl and the table

                let query_result = animations
                    .filter(dsl::id.eq(animation_id_to_load)) // Condition 1: ID must match
                    .filter(dsl::user_id.eq(user_id)) // Condition 2: User ID must match
                    .select(Animation::as_select())
                    .first::<Animation>(&mut conn)
                    .map_err(|e| match e {
                        diesel::result::Error::NotFound => AppError::NotFound(format!(
                            "Animation with ID {} not found or access denied.",
                            animation_id_to_load
                        )),
                        _ => AppError::from(e),
                    })?;

                Ok(query_result)
            })
            .await??;

        tracing::info!(
            "SERVICE: Animation '{}' (ID: {}) loaded successfully by user {}.",
            loaded_animation.name,
            animation_id_to_load,
            user_id
        );
        Ok(loaded_animation)
    }
}
