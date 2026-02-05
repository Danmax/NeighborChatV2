-- Migration 055: Storage policies for Clerk (auth.jwt sub)
-- Date: 2026-02-05
-- Description: Replace auth.uid() with auth.jwt()->>'sub' in storage policies

BEGIN;

-- Avatars
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

-- Game assets
DROP POLICY IF EXISTS "Auth users can update game assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete game assets" ON storage.objects;

CREATE POLICY "Auth users can update game assets"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'game-assets'
    AND auth.role() = 'authenticated'
    AND owner = (auth.jwt()->>'sub')
);

CREATE POLICY "Auth users can delete game assets"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'game-assets'
    AND auth.role() = 'authenticated'
    AND owner = (auth.jwt()->>'sub')
);

-- Event images
DROP POLICY IF EXISTS "Auth users can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete event images" ON storage.objects;

CREATE POLICY "Auth users can update event images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'event-images'
    AND auth.role() = 'authenticated'
    AND owner = (auth.jwt()->>'sub')
);

CREATE POLICY "Auth users can delete event images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'event-images'
    AND auth.role() = 'authenticated'
    AND owner = (auth.jwt()->>'sub')
);

-- Knowledge attachments
DROP POLICY IF EXISTS "Auth users can update knowledge attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete knowledge attachments" ON storage.objects;

CREATE POLICY "Auth users can update knowledge attachments"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'knowledge-attachments'
    AND auth.role() = 'authenticated'
    AND owner = (auth.jwt()->>'sub')
);

CREATE POLICY "Auth users can delete knowledge attachments"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'knowledge-attachments'
    AND auth.role() = 'authenticated'
    AND owner = (auth.jwt()->>'sub')
);

-- Sponsor logos
DROP POLICY IF EXISTS "Auth users can update sponsor logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete sponsor logos" ON storage.objects;

CREATE POLICY "Auth users can update sponsor logos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'sponsor-logos'
    AND auth.role() = 'authenticated'
    AND owner = (auth.jwt()->>'sub')
);

CREATE POLICY "Auth users can delete sponsor logos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'sponsor-logos'
    AND auth.role() = 'authenticated'
    AND owner = (auth.jwt()->>'sub')
);

-- Chat attachments
DROP POLICY IF EXISTS "Auth users can delete chat attachments" ON storage.objects;

CREATE POLICY "Auth users can delete chat attachments"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'chat-attachments'
    AND auth.role() = 'authenticated'
    AND owner = (auth.jwt()->>'sub')
);

-- Profile banners
DROP POLICY IF EXISTS "Users can upload banner image" ON storage.objects;
DROP POLICY IF EXISTS "Users can update banner image" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete banner image" ON storage.objects;

CREATE POLICY "Users can upload banner image"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'profile-banners'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

CREATE POLICY "Users can update banner image"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'profile-banners'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

CREATE POLICY "Users can delete banner image"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'profile-banners'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

-- Celebration images
DROP POLICY IF EXISTS "Users can upload celebration images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update celebration images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete celebration images" ON storage.objects;

CREATE POLICY "Users can upload celebration images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'celebration-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

CREATE POLICY "Users can update celebration images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'celebration-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

CREATE POLICY "Users can delete celebration images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'celebration-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

COMMIT;

NOTIFY pgrst, 'reload schema';
