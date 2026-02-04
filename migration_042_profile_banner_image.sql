-- Migration 042: Profile banner image support
-- Date: 2026-02-04
-- Description: Add banner_image_url to user_profiles + storage policies

BEGIN;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS banner_image_url text;

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_barrier = true) AS
SELECT
    user_id,
    COALESCE(username, display_name) AS display_name,
    username,
    avatar,
    bio,
    banner_color,
    banner_pattern,
    banner_image_url,
    CASE WHEN show_interests THEN interests ELSE '[]'::jsonb END AS interests,
    CASE WHEN show_city THEN city ELSE NULL END AS city,
    CASE WHEN show_phone THEN phone ELSE NULL END AS phone,
    CASE WHEN show_birthday THEN birthday ELSE NULL END AS birthday,
    created_at
FROM public.user_profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Storage bucket for banner images
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-banners', 'profile-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public banner access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload banner image" ON storage.objects;
DROP POLICY IF EXISTS "Users can update banner image" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete banner image" ON storage.objects;

CREATE POLICY "Public banner access"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-banners');

CREATE POLICY "Users can upload banner image"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'profile-banners'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Users can update banner image"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'profile-banners'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Users can delete banner image"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'profile-banners'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);

COMMIT;
