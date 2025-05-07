// klyja/backend/src/handlers.rs
use crate::{
    models::{Animation, NewAnimation},
    protobuf_gen::MapAnimation,
    schema, DbPool,
}; // Use crate:: for DbPool etc. defined in main.rs
use axum::{
    body::Bytes, // Use Bytes extractor for raw body
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    //    Json, // If you want to return JSON confirmation later
};
use diesel::prelude::*;
use prost::Message; // For decoding protobuf

/// Handler to save animation data received as Protobuf bytes
pub async fn save_animation_handler(
    State(pool): State<DbPool>, // Extract pool from state
    body: Bytes,                // Extract raw request body
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Return simple status or error
    tracing::info!("Received save request with {} bytes", body.len());

    // 1. Validate by trying to decode the Protobuf data
    let map_animation = MapAnimation::decode(body.clone()) // Clone body as decode consumes it
        .map_err(|e| {
            tracing::error!("Protobuf decoding failed: {}", e);
            (
                StatusCode::BAD_REQUEST,
                format!("Invalid Protobuf data: {}", e),
            )
        })?;

    // 2. Get a database connection
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error".to_string(),
        )
    })?;

    // 3. Prepare data for insertion
    // Use the decoded name or a default; use the original raw bytes for storage
    let animation_name = map_animation.name.as_str();
    let new_animation = NewAnimation {
        name: animation_name,
        protobuf_data: &body, // Use the original raw bytes slice
    };

    // 4. Insert into database using Diesel
    diesel::insert_into(schema::animations::table)
        .values(&new_animation)
        .execute(&mut conn) // Use &mut *conn if conn is PooledConnection
        .map_err(|e| {
            tracing::error!("Database insert failed: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to save animation".to_string(),
            )
        })?;

    tracing::info!("Animation '{}' saved successfully.", animation_name);
    // Return success status code
    Ok(StatusCode::CREATED) // 201 Created is appropriate
}

/// Handler to load animation data as Protobuf bytes by ID
pub async fn load_animation_handler(
    State(pool): State<DbPool>,    // Extract pool
    Path(animation_id): Path<i32>, // Extract ID from path /api/load_animation/:id
) -> Result<impl IntoResponse, (StatusCode, String)> {
    tracing::info!("Received load request for animation ID: {}", animation_id);

    // 1. Get a database connection
    let mut conn = pool.get().map_err(|e| {
        tracing::error!("Failed to get DB connection: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error".to_string(),
        )
    })?;

    // 2. Query the database using Diesel
    use crate::schema::animations::dsl::*; // Import DSL for filtering, etc.

    let animation = animations // Query the 'animations' table
        .find(animation_id) // Find by primary key
        .select(Animation::as_select()) // Select all columns mapped to the Animation struct
        .first(&mut conn) // Execute and expect one result
        .map_err(|e| match e {
            diesel::result::Error::NotFound => {
                tracing::warn!("Animation with ID {} not found", animation_id);
                (
                    StatusCode::NOT_FOUND,
                    format!("Animation ID {} not found", animation_id),
                )
            }
            _ => {
                tracing::error!("Database query failed: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to load animation".to_string(),
                )
            }
        })?;

    tracing::info!(
        "Animation '{}' (ID: {}) loaded successfully.",
        animation.name,
        animation_id
    );

    // 3. Prepare response headers
    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/octet-stream"),
    );
    // Optional: Add filename header?
    // headers.insert("Content-Disposition", HeaderValue::from_str(&format!("attachment; filename=\"{}.bin\"", animation.name)).unwrap());

    // 4. Return the raw Protobuf bytes with the correct content type
    Ok((headers, animation.protobuf_data)) // Return headers and Vec<u8> body
}
