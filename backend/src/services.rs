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

/// A service struct for handling business logic related to animations.
/// This layer is responsible for interacting with the database and processing data,
/// keeping the handler logic clean and focused on HTTP concerns.
pub struct AnimationService;

impl AnimationService {
    /// Handles the logic for saving a new animation or updating an existing one.
    ///
    /// # Arguments
    /// * `pool` - The database connection pool.
    /// * `animation_data_bytes` - The raw Protobuf bytes of the animation data.
    /// * `user_id` - The ID of the authenticated user saving the animation.
    ///
    /// # Returns
    /// A `Result` containing the ID of the saved animation if successful, or an `AppError`.
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

        // First, decode the protobuf data to get the animation name.
        let map_animation = MapAnimation::decode(animation_data_bytes.clone())?;
        let pool_clone = pool.clone();
        let name_for_blocking_task = map_animation.name.clone();
        let data_for_blocking = animation_data_bytes.clone();

        // Use `tokio::task::spawn_blocking` to run the synchronous Diesel database code
        // on a dedicated thread pool. This is crucial to prevent blocking the async
        // Axum runtime, which would hurt server performance.
        let saved_animation_id = tokio::task::spawn_blocking(move || {
            // Get a connection from the pool.
            let mut conn = pool_clone.get()?;
            let new_animation_payload = NewAnimation {
                name: &name_for_blocking_task,
                protobuf_data: &data_for_blocking,
                user_id: Some(user_id), // Associate the animation with the user.
            };

            // Insert the new animation record into the database.
            diesel::insert_into(schema::animations::table)
                .values(&new_animation_payload)
                .returning(Animation::as_returning())
                .get_result::<Animation>(&mut conn)
                .map(|anim| anim.id)
                .map_err(AppError::from) // Convert Diesel errors into our custom AppError.
        })
        .await??; // The `??` unwraps the JoinError from spawn_blocking, then the Result from the closure.

        tracing::info!(
            "SERVICE: Animation '{}' saved successfully with ID {}.",
            map_animation.name,
            saved_animation_id
        );
        Ok(saved_animation_id)
    }

    /// Handles the logic for loading an animation, ensuring the user is authorized.
    ///
    /// # Arguments
    /// * `pool` - The database connection pool.
    /// * `animation_id_to_load` - The ID of the animation to load.
    /// * `user_id` - The ID of the authenticated user requesting the animation.
    ///
    /// # Returns
    /// A `Result` containing the full `Animation` model if found and authorized, or an `AppError`.
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

        // As with saving, we use spawn_blocking for the synchronous database query.
        let loaded_animation =
            tokio::task::spawn_blocking(move || -> Result<Animation, AppError> {
                let mut conn = pool_clone.get()?;
                use crate::schema::animations::dsl::{self, animations};

                // This query is security-critical. It ensures that an animation is only returned if:
                // 1. The animation ID matches.
                // 2. The `user_id` on the animation record matches the ID of the authenticated user.
                // This prevents one user from being able to load another user's animations.
                let query_result = animations
                    .filter(dsl::id.eq(animation_id_to_load)) // Condition 1: ID must match
                    .filter(dsl::user_id.eq(user_id)) // Condition 2: User ID must match
                    .select(Animation::as_select())
                    .first::<Animation>(&mut conn)
                    .map_err(|e| match e {
                        // Return a clear "Not Found" error if no record matches BOTH conditions.
                        // This prevents leaking information about whether an animation ID exists
                        // if the user doesn't have access to it.
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
