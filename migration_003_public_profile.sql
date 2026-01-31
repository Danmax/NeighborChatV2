-- Migration 003: Public Profile Fields and Privacy Settings
-- This migration adds fields for public profiles, bio, banner customization, and privacy controls

-- Add public profile fields
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS banner_color VARCHAR(7) DEFAULT '#4CAF50',
ADD COLUMN IF NOT EXISTS banner_pattern VARCHAR(50) DEFAULT 'solid',
ADD COLUMN IF NOT EXISTS show_city BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_interests BOOLEAN DEFAULT true;

-- Add constraints
ALTER TABLE user_profiles
ADD CONSTRAINT bio_length_check CHECK (bio IS NULL OR length(bio) <= 200),
ADD CONSTRAINT banner_color_check CHECK (banner_color ~ '^#[0-9A-Fa-f]{6}$');

-- Create index for faster profile lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username_lookup
ON user_profiles (username)
WHERE username IS NOT NULL;

-- Create RLS policy for viewing public profiles (if RLS is enabled)
-- This allows authenticated users to view other users' profiles
DO $$
BEGIN
    -- Check if RLS is enabled
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND rowsecurity = true
    ) THEN
        -- Create policy if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'user_profiles'
            AND policyname = 'Public profiles viewable by authenticated users'
        ) THEN
            EXECUTE 'CREATE POLICY "Public profiles viewable by authenticated users"
                ON user_profiles FOR SELECT
                TO authenticated
                USING (true)';
        END IF;
    END IF;
END $$;

-- Set default values for existing users
UPDATE user_profiles
SET
    banner_color = COALESCE(banner_color, '#4CAF50'),
    banner_pattern = COALESCE(banner_pattern, 'solid'),
    show_city = COALESCE(show_city, true),
    show_phone = COALESCE(show_phone, false),
    show_email = COALESCE(show_email, false),
    show_birthday = COALESCE(show_birthday, false),
    show_interests = COALESCE(show_interests, true)
WHERE banner_color IS NULL
   OR banner_pattern IS NULL
   OR show_city IS NULL
   OR show_phone IS NULL
   OR show_email IS NULL
   OR show_birthday IS NULL
   OR show_interests IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.bio IS 'User bio (max 200 characters) shown on public profile';
COMMENT ON COLUMN user_profiles.banner_color IS 'Hex color code for profile banner background';
COMMENT ON COLUMN user_profiles.banner_pattern IS 'Pattern style for profile banner (solid, dots, stripes, grid, sparkle)';
COMMENT ON COLUMN user_profiles.show_city IS 'Privacy: Show city on public profile';
COMMENT ON COLUMN user_profiles.show_phone IS 'Privacy: Show phone on public profile';
COMMENT ON COLUMN user_profiles.show_email IS 'Privacy: Show email on public profile';
COMMENT ON COLUMN user_profiles.show_birthday IS 'Privacy: Show birthday on public profile';
COMMENT ON COLUMN user_profiles.show_interests IS 'Privacy: Show interests on public profile';
