-- Migration 044: Movie API cache table
-- Date: 2026-02-04
-- Description: Cache TMDB responses server-side to reduce API calls

BEGIN;

CREATE TABLE IF NOT EXISTS public.movie_cache (
    cache_key text PRIMARY KEY,
    data jsonb NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS movie_cache_expires_idx
ON public.movie_cache(expires_at);

ALTER TABLE public.movie_cache ENABLE ROW LEVEL SECURITY;

COMMIT;
