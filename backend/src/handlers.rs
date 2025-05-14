// klyja/backend/src/handlers.rs
use crate::{
    errors::{AppError, ErrorResponsePayload, SuccessfulSaveResponsePayload},
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
    Json, // If you want to return JSON confirmation later
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
        (status = 201, description = "Animation saved successfully", body = crate::errors::SuccessfulSaveResponsePayload),
        (status = 400, description = "Invalid data format or bad request", body = crate::errors::ErrorResponsePayload),
        (status = 500, description = "Internal server error", body = crate::errors::ErrorResponsePayload)
    )
)]

pub async fn save_animation_handler(
    State(pool): State<DbPool>,
    body: Bytes,
) -> Result<impl IntoResponse, AppError> {
    // The suggestion used tracing_unwrap, but standard tracing is fine.
    // Ensure you have `tracing` in your Cargo.toml and `use tracing;` if not already global.
    tracing::debug!("HANDLER: Received save request with {} bytes", body.len()); // Changed to debug, info is also fine

    // Call the service, which now returns Result<i32, AppError>
    let saved_animation_id = AnimationService::save_animation_logic(&pool, body).await?;

    tracing::info!(
        // Kept info level here for successful operation
        "HANDLER: Animation save processed successfully by service. ID: {}",
        saved_animation_id
    );

    // Construct the success response payload
    let response_payload = SuccessfulSaveResponsePayload {
        id: saved_animation_id,
        message: "Animation saved successfully".to_string(),
    };

    // MODIFIED: Return 201 Created status with the JSON payload
    // (StatusCode, Json(payload)) is a common way to do this in Axum.
    Ok((StatusCode::CREATED, Json(response_payload)))
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
) -> Result<impl IntoResponse, AppError> {
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
