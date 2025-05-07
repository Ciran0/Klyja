// klyja/backend/src/models.rs
//use crate::schema::animations; // Import the table definition
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize}; // Might need Serialize for responses later

// Struct for reading data FROM the database (maps to the table structure)
#[derive(Queryable, Selectable, Debug, Serialize)] // Added Serialize
#[diesel(table_name = crate::schema::animations)]
#[diesel(check_for_backend(diesel::pg::Pg))] // Specify PostgreSQL backend
pub struct Animation {
    pub id: i32,
    pub name: String,
    #[serde(skip_serializing)] // Avoid sending raw bytes in typical JSON responses
    pub protobuf_data: Vec<u8>, // Matches BYTEA column
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Struct for inserting data INTO the database
#[derive(Insertable, Debug, Deserialize)] // Added Deserialize if creating from JSON later
#[diesel(table_name = crate::schema::animations)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct NewAnimation<'a> {
    // Use lifetime for borrowed data (&str, &[u8])
    pub name: &'a str,
    pub protobuf_data: &'a [u8],
    // id, created_at, updated_at are handled by the database
}

// Optional: Struct for updating data (if needed later)
// #[derive(AsChangeset, Debug, Deserialize)]
// #[diesel(table_name = crate::schema::animations)]
// pub struct UpdateAnimation<'a> {
//     pub name: Option<&'a str>,
//     pub protobuf_data: Option<&'a [u8]>,
//     // updated_at is handled by trigger
// }
