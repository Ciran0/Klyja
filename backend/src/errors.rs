// klyja/backend/src/errors.rs
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json, // For creating JSON response bodies
};
//use diesel::r2d2;
use serde::Serialize; // For the error response struct for JSON
use thiserror::Error; // For cleaner error definitions
use utoipa::ToSchema; // For OpenAPI documentation

// This struct will define the shape of our JSON error responses.
#[derive(Serialize, ToSchema)]
pub struct ErrorResponsePayload {
    #[schema(example = "Resource not found")] // Example for OpenAPI
    error: String,
}

// Our custom service error enum
#[derive(Debug)] // Allow printing for logs
pub enum AppError {
    // For errors originating from protobuf decoding
    ProtobufDecode(prost::DecodeError),
    // For errors originating from database connection pool
    DatabasePool(::r2d2::Error),
    // For errors originating from Diesel operations (queries, inserts, etc.)
    DatabaseQuery(diesel::result::Error),
    // For when a requested resource is not found (more specific than just a general DB error)
    NotFound(String),
    // For other client-side errors, e.g. invalid input not caught by protobuf
    #[allow(dead_code)]
    BadRequest(String),
    // For internal server errors that don't fit other categories
    Internal(String),
}

// How AppError converts into an HTTP response for Axum
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status_code, message) = match self {
            AppError::ProtobufDecode(err) => {
                tracing::error!("SERVICE ERROR - ProtobufDecode: {}", err);
                (
                    StatusCode::BAD_REQUEST,
                    format!("Invalid data format: {}", err),
                )
            }
            AppError::DatabasePool(err) => {
                tracing::error!("SERVICE ERROR - DatabasePool: {}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Error connecting to database".to_string(),
                )
            }
            AppError::DatabaseQuery(err) => {
                tracing::error!("SERVICE ERROR - DatabaseQuery: {}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "A database error occurred".to_string(),
                )
            }
            AppError::NotFound(msg) => {
                tracing::warn!("SERVICE ERROR - NotFound: {}", msg);
                (StatusCode::NOT_FOUND, msg)
            }
            AppError::BadRequest(msg) => {
                tracing::warn!("SERVICE ERROR - BadRequest: {}", msg);
                (StatusCode::BAD_REQUEST, msg)
            }
            AppError::Internal(msg) => {
                tracing::error!("SERVICE ERROR - Internal: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, msg)
            }
        };

        // Create a JSON response body
        let body = Json(ErrorResponsePayload { error: message });
        (status_code, body).into_response()
    }
}

// Helper: Convert prost::DecodeError into AppError
// This allows us to use `?` with functions returning prost::DecodeError
// within service functions that return Result<_, AppError>
impl From<prost::DecodeError> for AppError {
    fn from(err: prost::DecodeError) -> Self {
        AppError::ProtobufDecode(err)
    }
}

// Helper: Convert r2d2::Error into AppError
impl From<::r2d2::Error> for AppError {
    fn from(err: ::r2d2::Error) -> Self {
        AppError::DatabasePool(err)
    }
}

// Helper: Convert diesel::result::Error into AppError
impl From<diesel::result::Error> for AppError {
    fn from(err: diesel::result::Error) -> Self {
        match err {
            diesel::result::Error::NotFound => {
                // You can put a generic message here or customize it if needed,
                // though the IntoResponse logic will likely provide the final user-facing message.
                AppError::NotFound(
                    "The requested resource was not found in the database.".to_string(),
                )
            }
            _ => AppError::DatabaseQuery(err), // Other Diesel errors map to DatabaseQuery
        }
    }
}

#[derive(Serialize, ToSchema)]
pub struct SuccessfulSaveResponsePayload {
    #[schema(example = 1)] // Example for OpenAPI documentation
    pub id: i32,
    #[schema(example = "Animation saved successfully")] // Example for OpenAPI
    pub message: String,
}
