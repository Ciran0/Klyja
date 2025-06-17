use crate::{auth::AuthenticatedUser, errors::AppError, services::AnimationService, DbPool};
use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
pub struct SuccessfulSaveResponsePayload {
    pub id: i32,
    pub message: String,
}

/// Save a new animation. User must be authenticated.
/// The request body should be the raw binary Protobuf data for the MapAnimation.
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
    user: AuthenticatedUser, // This extractor ensures the user is logged in
    body: Bytes,
) -> Result<impl IntoResponse, AppError> {
    let user_id = user.0.id; // Get user ID from the authenticated user
    tracing::debug!(
        "HANDLER: User {} received save request with {} bytes",
        user_id,
        body.len()
    );

    // Pass the user_id to the service layer
    let saved_animation_id = AnimationService::save_animation_logic(&pool, body, user_id).await?;

    tracing::info!(
        "HANDLER: Animation save for user {} processed successfully. ID: {}",
        user_id,
        saved_animation_id
    );

    let response_payload = SuccessfulSaveResponsePayload {
        id: saved_animation_id,
        message: "Animation saved successfully".to_string(),
    };

    Ok((StatusCode::CREATED, Json(response_payload)))
}

/// Load an existing animation by its ID. User must be authenticated and own the animation.
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
    user: AuthenticatedUser, // Authenticate the user
    Path(animation_id): Path<i32>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = user.0.id;
    tracing::info!(
        "HANDLER: User {} received load request for animation ID: {}",
        user_id,
        animation_id
    );

    // Pass user_id to service for authorization check
    let loaded_animation =
        AnimationService::load_animation_logic(&pool, animation_id, user_id).await?;

    tracing::info!(
        "HANDLER: Animation '{}' (ID: {}) loaded successfully by user {}.",
        loaded_animation.name,
        animation_id,
        user_id,
    );

    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/octet-stream"),
    );

    Ok((headers, loaded_animation.protobuf_data))
}

/// Health check endpoint.
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
