-- Migration 068: Add Spotify track to user profiles
-- Date: 2026-02-06
-- Description: Store a Spotify track URL and expose it in public_profiles view

BEGIN;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS spotify_track_url text;

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
    id AS user_id,
    clerk_user_id,
    display_name,
    username,
    avatar,
    bio,
    banner_color,
    banner_pattern,
    banner_image_url,
    interests,
    city,
    phone,
    birthday,
    created_at,
    spotify_track_url
FROM public.user_profiles;

COMMIT;

NOTIFY pgrst, 'reload schema';
