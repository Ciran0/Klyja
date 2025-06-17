-- Remove the foreign key constraint from the animations table
ALTER TABLE animations DROP CONSTRAINT IF EXISTS fk_user;

-- Remove the user_id column from the animations table
ALTER TABLE animations DROP COLUMN IF EXISTS user_id;

-- Drop the sessions and users tables
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
