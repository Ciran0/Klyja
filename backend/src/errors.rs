// klyja/backend/src/errors.rs
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error; // Using thiserror for cleaner error definitions
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
pub struct ErrorResponsePayload {
    #[schema(example = "Resource not found")]
    error: String,
}

// Our custom service error enum, now using `thiserror`
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Protobuf decode error: {0}")]
    ProtobufDecode(#[from] prost::DecodeError),

    #[error("Database connection pool error: {0}")]
    DatabasePool(#[from] ::r2d2::Error),

    #[error("Database query error: {0}")]
    DatabaseQuery(#[from] diesel::result::Error),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    // --- NEW ERROR VARIANTS ---
    #[error("Unauthorized")]
    Unauthorized,

    #[error("Reqwest error: {0}")]
    Reqwest(#[from] reqwest::Error),

    #[error("Task join error: {0}")]
    Join(#[from] tokio::task::JoinError),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status_code, message) = match &self {
            AppError::ProtobufDecode(err) => (StatusCode::BAD_REQUEST, err.to_string()),
            AppError::DatabasePool(err) => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            AppError::DatabaseQuery(err) => (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),

            // --- NEW MAPPINGS ---
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()),
            AppError::Reqwest(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("External request failed: {}", err),
            ),
            AppError::Join(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Internal task error: {}", err),
            ),
        };

        // Log the full error for debugging
        tracing::error!("SERVICE ERROR: {:?}", self);

        let body = Json(ErrorResponsePayload { error: message });
        (status_code, body).into_response()
    }
}
