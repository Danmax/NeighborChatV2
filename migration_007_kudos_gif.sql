-- Migration 007: Kudos board GIF support
-- Date: 2026-02-01
-- Description: Adds gif_url to celebrations for kudos board posts

BEGIN;

ALTER TABLE public.celebrations
ADD COLUMN IF NOT EXISTS gif_url TEXT;

COMMIT;
