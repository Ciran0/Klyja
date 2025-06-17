// @generated automatically by Diesel CLI.

diesel::table! {
    animations (id) {
        id -> Int4,
        #[max_length = 255]
        name -> Varchar,
        protobuf_data -> Bytea,
        created_at -> Timestamp,
        updated_at -> Timestamp,
        user_id -> Nullable<Int4>,
    }
}

diesel::table! {
    sessions (session_token) {
        session_token -> Text,
        user_id -> Int4,
        expires_at -> Timestamp,
        created_at -> Timestamp,
    }
}

diesel::table! {
    users (id) {
        id -> Int4,
        #[max_length = 50]
        provider -> Varchar,
        #[max_length = 255]
        provider_id -> Varchar,
        #[max_length = 255]
        email -> Varchar,
        #[max_length = 255]
        display_name -> Varchar,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::joinable!(animations -> users (user_id));
diesel::joinable!(sessions -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(animations, sessions, users,);
