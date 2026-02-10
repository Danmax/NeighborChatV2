-- Migration 081: Add timezone to user_profiles
-- Date: 2026-02-10
-- Description: Enables saving preferred timezone from profile settings

BEGIN;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS timezone text;

UPDATE public.user_profiles
SET timezone = 'America/New_York'
WHERE timezone IS NULL;

COMMIT;
