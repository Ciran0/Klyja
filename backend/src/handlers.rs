// klyja/backend/src/handlers.rs
use crate::{
    //    models::{Animation, NewAnimation},
    //    protobuf_gen::MapAnimation,
    //    schema,
    services::AnimationService,
    DbPool,
}; // Use crate:: for DbPool etc. defined in main.rs
use axum::{
    body::Bytes, // Use Bytes extractor for raw body
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    //    Json, // If you want to return JSON confirmation later
};
//use diesel::prelude::*;
//use prost::Message; // For decoding protobuf

/// Save a new animation.
///
/// The request body should be the raw binary Protobuf data representing the MapAnimation.
#[utoipa::path(
    post,
    path = "/api/save_animation",
    tag = "Animations", // Group this endpoint under an "Animations" tag
    request_body(
        content = bytes, // Using `bytes` special type for utoipa for raw binary
        description = "Binary Protobuf data for the MapAnimation",
        content_type = "application/octet-stream"
    ),
    responses(
        (status = 201, description = "Animation saved successfully"),
        (status = 400, description = "Invalid Protobuf data provided", body = String), // Example error response
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn save_animation_handler(
    State(pool): State<DbPool>, // Extract pool from state
    body: Bytes,                // Extract raw request body
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Return simple status or error
    tracing::info!("Received save request with {} bytes", body.len());
    // Call the business logic function from the service layer
    // Pass the pool and the body (which is our animation_data_bytes)
    AnimationService::save_animation_logic(&pool, body).await?; // The '?' will propagate the Err((StatusCode, String)) if one occurs

    Ok(StatusCode::CREATED) // 201 Created is appropriate
}

/// Load an existing animation by its ID.
///
/// Returns the raw binary Protobuf data for the MapAnimation.
#[utoipa::path(
    get,
    path = "/api/load_animation/{id}",
    tag = "Animations",
    params(
        ("id" = i32, Path, description = "ID of the animation to load", example = 1)
    ),
    responses(
        (status = 200, description = "Animation loaded successfully", body = bytes, content_type = "application/octet-stream"),
        (status = 404, description = "Animation not found", body = String),
        (status = 500, description = "Internal server error", body = String)
    )
)]
pub async fn load_animation_handler(
    State(pool): State<DbPool>,
    Path(animation_id): Path<i32>, // Extract ID from path
) -> Result<impl IntoResponse, (StatusCode, String)> {
    tracing::info!(
        "HANDLER: Received load request for animation ID: {}",
        animation_id
    );

    // Call the business logic function from the service layer
    let loaded_animation = AnimationService::load_animation_logic(&pool, animation_id).await?; // Propagates Err if one occurs

    tracing::info!(
        "HANDLER: Animation '{}' (ID: {}) loaded successfully by service.",
        loaded_animation.name,
        animation_id
    );

    // The rest of the handler is for HTTP response formatting, which stays here.
    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/octet-stream"),
    );

    Ok((headers, loaded_animation.protobuf_data)) // Return headers and Vec<u8> body
}
/// Health check endpoint.
///
/// Returns a simple "Healthy!" message if the server is running.
#[utoipa::path(
    get,
    path = "/api/health",
    tag = "System",
    responses(
        (status = 200, description = "Server is healthy", body = String, example = json!("Healthy!"))
    )
)]
pub async fn health_check_handler() -> (StatusCode, String) {
    (StatusCode::OK, "Healthy!".to_string())
}
