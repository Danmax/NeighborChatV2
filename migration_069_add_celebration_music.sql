-- Migration 069: Add music to celebrations
-- Date: 2026-02-06
-- Description: Store a Spotify URL for celebration music

BEGIN;

ALTER TABLE public.celebrations
ADD COLUMN IF NOT EXISTS music_url text;

COMMIT;

NOTIFY pgrst, 'reload schema';
