-- klyja/migrations/YYYYMMDDHHMMSS_create_initial_tables/down.sql
DROP TRIGGER IF EXISTS set_timestamp ON animations;
DROP FUNCTION IF EXISTS trigger_set_timestamp();
DROP TABLE animations;
-- Drop other tables created in up.sql
