// klyja/backend/src/models.rs
//use crate::schema::animations; // Import the table definition
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize}; // Might need Serialize for responses later
use utoipa::ToSchema;

// Struct for reading data FROM the database (maps to the table structure)
#[derive(Queryable, Selectable, Debug, Serialize, ToSchema)]
#[diesel(table_name = crate::schema::animations)]
#[diesel(check_for_backend(diesel::pg::Pg))]
#[schema(example = json!({ // Example for the schema (requires serde_json in scope for json!)
    "id": 1,
    "name": "My Cool Animation",
    // protobuf_data is skipped in serialization so not shown in example
    "created_at": "2024-05-07T12:30:00", // Example timestamp
    "updated_at": "2024-05-07T12:35:00"
}))]

pub struct Animation {
    #[schema(example = 101)]
    pub id: i32,
    #[schema(example = "Fireball")]
    pub name: String,
    #[serde(skip_serializing)] // Avoid sending raw bytes in typical JSON responses
    #[schema(hidden = true)]
    pub protobuf_data: Vec<u8>, // Matches BYTEA column
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Struct for inserting data INTO the database
#[derive(Insertable, Debug, Deserialize)]
#[diesel(table_name = crate::schema::animations)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct NewAnimation<'a> {
    // Use lifetime for borrowed data (&str, &[u8])
    pub name: &'a str,
    pub protobuf_data: &'a [u8],
    // id, created_at, updated_at are handled by the database
}

#[derive(Queryable, Selectable, Identifiable, Debug, Serialize, ToSchema)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub id: i32,
    pub provider: String,
    pub provider_id: String,
    pub email: String,
    pub display_name: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::users)]
pub struct NewUser<'a> {
    pub provider: &'a str,
    pub provider_id: &'a str,
    pub email: &'a str,
    pub display_name: &'a str,
}

#[derive(Queryable, Identifiable, Associations, Debug)]
#[diesel(belongs_to(User))]
#[diesel(table_name = crate::schema::sessions)]
#[diesel(primary_key(session_token))]
pub struct Session {
    pub session_token: String,
    pub user_id: i32,
    pub expires_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::sessions)]
pub struct NewSession {
    pub session_token: String,
    pub user_id: i32,
    pub expires_at: NaiveDateTime,
}
