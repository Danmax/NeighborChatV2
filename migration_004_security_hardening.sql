-- Migration 004: Security hardening for profiles, contacts, messages, and audit tables
-- Date: 2026-01-31
-- Description: Lock down public access, add public_profiles view, and add messages policies

BEGIN;

-- =====================================================
-- Public profiles view (limited fields + privacy flags)
-- =====================================================
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true) AS
SELECT
    user_id,
    display_name,
    username,
    avatar,
    bio,
    banner_color,
    banner_pattern,
    CASE WHEN show_interests THEN interests ELSE '[]'::jsonb END AS interests,
    CASE WHEN show_city THEN city ELSE NULL END AS city,
    CASE WHEN show_phone THEN phone ELSE NULL END AS phone,
    CASE WHEN show_birthday THEN birthday ELSE NULL END AS birthday,
    created_at
FROM public.user_profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- =====================================================
-- user_profiles: remove public allow-all policies
-- =====================================================
DROP POLICY IF EXISTS "Allow public read access" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow public insert" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow public update" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow public delete" ON public.user_profiles;

-- Ensure RLS enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Owner-only access for authenticated users
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow users to create their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow users to delete their own profile" ON public.user_profiles;

CREATE POLICY "Allow users to view their own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (auth.uid()::text = user_id);

CREATE POLICY "Allow users to create their own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Allow users to update their own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Allow users to delete their own profile"
ON public.user_profiles FOR DELETE
TO authenticated
USING (auth.uid()::text = user_id);

-- =====================================================
-- saved_contacts: remove public allow-all, add owner-only
-- =====================================================
DROP POLICY IF EXISTS "Allow public read access" ON public.saved_contacts;
DROP POLICY IF EXISTS "Allow public insert" ON public.saved_contacts;
DROP POLICY IF EXISTS "Allow public update" ON public.saved_contacts;
DROP POLICY IF EXISTS "Allow public delete" ON public.saved_contacts;

ALTER TABLE public.saved_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own contacts"
ON public.saved_contacts FOR ALL
TO authenticated
USING (owner_id = auth.uid()::text)
WITH CHECK (owner_id = auth.uid()::text);

-- Add favorite flag if missing
ALTER TABLE public.saved_contacts
ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT false;

-- =====================================================
-- messages: RLS policies for 1:1 stored messages
-- =====================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their received messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their sent messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;

CREATE POLICY "Users can view own messages"
ON public.messages FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can mark messages read"
ON public.messages FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

-- =====================================================
-- audit_logs and rate_limits: enable RLS + revoke access
-- =====================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_logs FROM anon, authenticated;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- =====================================================
-- SECURITY DEFINER function hardening
-- =====================================================
ALTER FUNCTION public.is_instance_member(TEXT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.is_instance_member(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.is_instance_member(TEXT) TO authenticated;

COMMIT;
