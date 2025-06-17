-- Create a table to store user information.
-- We'll identify users by their ID from the OAuth provider (e.g., Google's 'sub' or GitHub's user ID).
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,          -- e.g., 'google', 'github'
    provider_id VARCHAR(255) NOT NULL,      -- The user's unique ID from the provider
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    -- A user is unique based on the combination of the provider and their ID on that provider.
    UNIQUE (provider, provider_id)
);

-- Apply the updated_at trigger to the new users table.
SELECT diesel_manage_updated_at('users');

-- Create a table to store user session tokens.
-- This is more secure and scalable than using JWTs stored entirely on the client for this use case.
CREATE TABLE sessions (
    session_token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add a user_id foreign key to the animations table.
-- This links each animation to a user.
ALTER TABLE animations
ADD COLUMN user_id INTEGER;

-- Make the user_id column a foreign key that references the users table.
-- It's set to NULLABLE for now so we don't break existing data, but new animations
-- will require it.
ALTER TABLE animations
ADD CONSTRAINT fk_user
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE CASCADE; -- If a user is deleted, their animations are also deleted.

-- We should make the column NOT NULL after migrating existing data if any.
-- For a fresh setup, you could make it `NOT NULL` from the start.
-- ALTER TABLE animations ALTER COLUMN user_id SET NOT NULL;
