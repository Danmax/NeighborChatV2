-- Migration 002: Username Field
-- Date: 2026-01-30
-- Description: Adds unique username field with validation constraints

BEGIN;

-- Add username column
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_unique
ON user_profiles (LOWER(username));

-- Add format constraint
ALTER TABLE user_profiles
ADD CONSTRAINT username_format_check
CHECK (
  username IS NULL OR (
    LENGTH(username) >= 3 AND
    LENGTH(username) <= 30 AND
    username ~ '^[a-z0-9_]+$'
  )
);

-- Backfill existing users with generated usernames
UPDATE user_profiles
SET username = LOWER(
  REPLACE(COALESCE(display_name, 'user'), ' ', '_') || '_' || FLOOR(RANDOM() * 9999)::TEXT
)
WHERE username IS NULL;

COMMIT;

-- Verify migration
SELECT
  user_id,
  display_name,
  username
FROM user_profiles
LIMIT 5;

-- Check constraint
SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'user_profiles'
  AND constraint_name = 'username_format_check';
