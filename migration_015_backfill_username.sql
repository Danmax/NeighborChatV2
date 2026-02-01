-- Migration 015: Backfill username/display_name consolidation
-- Date: 2026-02-01
-- Description: Ensure username and display_name are synchronized

BEGIN;

-- If username is null, derive from display_name (safe format)
UPDATE public.user_profiles
SET username = lower(regexp_replace(display_name, '[^a-zA-Z0-9_]+', '_', 'g'))
WHERE username IS NULL
  AND display_name IS NOT NULL
  AND lower(regexp_replace(display_name, '[^a-zA-Z0-9_]+', '_', 'g')) ~ '^[a-z0-9_]{3,30}$';

-- If display_name is null, copy username
UPDATE public.user_profiles
SET display_name = username
WHERE display_name IS NULL AND username IS NOT NULL;

COMMIT;
