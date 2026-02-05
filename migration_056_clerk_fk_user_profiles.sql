-- Migration 056: Switch auth.users FKs to public.user_profiles (Clerk hybrid)
-- Date: 2026-02-05
-- Description: Point author/creator FKs to user_profiles(id) for Clerk UUIDs

BEGIN;

-- Celebrations: author_id -> public.user_profiles(id)
ALTER TABLE public.celebrations
DROP CONSTRAINT IF EXISTS celebrations_author_id_fkey;

ALTER TABLE public.celebrations
ADD CONSTRAINT celebrations_author_id_fkey
FOREIGN KEY (author_id) REFERENCES public.user_profiles(id);

-- Community events: created_by_id -> public.user_profiles(id)
ALTER TABLE public.community_events
DROP CONSTRAINT IF EXISTS community_events_created_by_id_fkey;

ALTER TABLE public.community_events
ADD CONSTRAINT community_events_created_by_id_fkey
FOREIGN KEY (created_by_id) REFERENCES public.user_profiles(id);

COMMIT;
