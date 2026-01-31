-- Migration 001: Onboarding and User Tracking Fields
-- Date: 2026-01-30
-- Description: Adds fields to track onboarding completion, first login, and guest user migrations

BEGIN;

-- Add new columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_from_guest BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS previous_guest_id TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set existing users as onboarded (assume they're already using the app)
UPDATE user_profiles
SET onboarding_completed = TRUE,
    first_login_at = COALESCE(first_login_at, created_at, NOW())
WHERE onboarding_completed IS NULL OR onboarding_completed = FALSE;

-- Create index for faster onboarding status lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding
ON user_profiles(user_id, onboarding_completed);

-- Create index for guest tracking
CREATE INDEX IF NOT EXISTS idx_user_profiles_guest
ON user_profiles(previous_guest_id)
WHERE previous_guest_id IS NOT NULL;

-- Trigger to set first_login_at automatically on insert
CREATE OR REPLACE FUNCTION set_first_login()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.first_login_at IS NULL THEN
    NEW.first_login_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_first_login
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_first_login();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to check if email exists (for preventing duplicate signups)
CREATE OR REPLACE FUNCTION check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = email_to_check
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and anonymous
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO anon;

COMMIT;

-- Verify migration
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('onboarding_completed', 'first_login_at', 'created_from_guest', 'previous_guest_id', 'updated_at')
ORDER BY column_name;
