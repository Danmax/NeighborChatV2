-- Migration 045: Allow authenticated users to view favorite movies
-- Date: 2026-02-04
-- Description: Enable shared viewing of favorites for profiles

BEGIN;

DROP POLICY IF EXISTS "favorite_movies_select_own" ON public.favorite_movies;

CREATE POLICY "favorite_movies_select_authenticated"
ON public.favorite_movies FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

COMMIT;
