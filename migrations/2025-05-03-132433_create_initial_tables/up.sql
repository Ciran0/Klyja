--- klyja/migrations/YYYYMMDDHHMMSS_create_initial_tables/up.sql
CREATE TABLE animations (
    id SERIAL PRIMARY KEY,               -- Unique ID for each animation
    name VARCHAR(255) NOT NULL,        -- User-defined name
    protobuf_data BYTEA NOT NULL,        -- Stores the serialized Protobuf data
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- Timestamp when created
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()  -- Timestamp when last updated
);

-- Optional: Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Trigger to call the function before updates
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON animations
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Add other tables here if needed in the initial setup
