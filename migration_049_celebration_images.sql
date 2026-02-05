-- Migration 049: Celebration image uploads
-- Date: 2026-02-04
-- Description: Add image_url to celebrations and storage bucket/policies

BEGIN;

ALTER TABLE public.celebrations
ADD COLUMN IF NOT EXISTS image_url text;

-- Storage bucket for celebration images
INSERT INTO storage.buckets (id, name, public)
VALUES ('celebration-images', 'celebration-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public celebration images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload celebration images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update celebration images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete celebration images" ON storage.objects;

CREATE POLICY "Public celebration images"
ON storage.objects FOR SELECT
USING (bucket_id = 'celebration-images');

CREATE POLICY "Users can upload celebration images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'celebration-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Users can update celebration images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'celebration-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Users can delete celebration images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'celebration-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);

COMMIT;
