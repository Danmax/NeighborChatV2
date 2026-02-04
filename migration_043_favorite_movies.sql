-- Migration 043: Favorite movies (TMDB)
-- Date: 2026-02-04
-- Description: Store user favorite movies with RLS

BEGIN;

CREATE TABLE IF NOT EXISTS public.favorite_movies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    movie_id text NOT NULL,
    source text NOT NULL DEFAULT 'tmdb',
    title text NOT NULL,
    poster_url text,
    year integer,
    created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS favorite_movies_unique
ON public.favorite_movies(user_id, source, movie_id);

CREATE INDEX IF NOT EXISTS favorite_movies_user_idx
ON public.favorite_movies(user_id, created_at DESC);

ALTER TABLE public.favorite_movies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorite_movies_select_own" ON public.favorite_movies;
DROP POLICY IF EXISTS "favorite_movies_insert_own" ON public.favorite_movies;
DROP POLICY IF EXISTS "favorite_movies_delete_own" ON public.favorite_movies;

CREATE POLICY "favorite_movies_select_own"
ON public.favorite_movies FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "favorite_movies_insert_own"
ON public.favorite_movies FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "favorite_movies_delete_own"
ON public.favorite_movies FOR DELETE
TO authenticated
USING (user_id = auth.uid());

COMMIT;
