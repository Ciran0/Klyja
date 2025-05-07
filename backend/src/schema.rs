// @generated automatically by Diesel CLI.

diesel::table! {
    animations (id) {
        id -> Int4,
        #[max_length = 255]
        name -> Varchar,
        protobuf_data -> Bytea,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}
