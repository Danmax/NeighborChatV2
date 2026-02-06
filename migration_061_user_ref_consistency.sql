-- Migration 061: Normalize user references to user_profiles.id (Clerk UUID)
-- Date: 2026-02-06
-- Description: Convert text user refs to uuid, add missing FKs, drop legacy user_profiles.user_id, repoint instance_memberships

BEGIN;

-- Drop policies that depend on columns being altered
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'celebrations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.celebrations', r.policyname);
    END LOOP;

    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_manager_requests'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_manager_requests', r.policyname);
    END LOOP;

    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_contacts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.saved_contacts', r.policyname);
    END LOOP;

    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', r.policyname);
    END LOOP;
END $$;

-- Drop views depending on legacy columns
DROP VIEW IF EXISTS public.public_profiles;

-- 1) Convert text user reference columns to uuid (map by clerk_user_id or legacy user_id)
-- celebrations.recipient_id (text -> uuid)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'celebrations'
          AND column_name = 'recipient_id'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE public.celebrations ADD COLUMN recipient_id_uuid uuid;
        UPDATE public.celebrations c
        SET recipient_id_uuid = up.id
        FROM public.user_profiles up
        WHERE up.clerk_user_id = c.recipient_id
           OR up.user_id = c.recipient_id;
        ALTER TABLE public.celebrations DROP COLUMN recipient_id;
        ALTER TABLE public.celebrations RENAME COLUMN recipient_id_uuid TO recipient_id;
    END IF;
END $$;

-- event_manager_requests.user_id (text -> uuid)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'event_manager_requests'
          AND column_name = 'user_id'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE public.event_manager_requests ADD COLUMN user_id_uuid uuid;
        UPDATE public.event_manager_requests r
        SET user_id_uuid = up.id
        FROM public.user_profiles up
        WHERE up.clerk_user_id = r.user_id
           OR up.user_id = r.user_id;
        ALTER TABLE public.event_manager_requests DROP COLUMN user_id;
        ALTER TABLE public.event_manager_requests RENAME COLUMN user_id_uuid TO user_id;
    END IF;
END $$;

-- saved_contacts.owner_id (text -> uuid)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saved_contacts'
          AND column_name = 'owner_id'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE public.saved_contacts ADD COLUMN owner_id_uuid uuid;
        UPDATE public.saved_contacts sc
        SET owner_id_uuid = up.id
        FROM public.user_profiles up
        WHERE up.clerk_user_id = sc.owner_id
           OR up.user_id = sc.owner_id;
        ALTER TABLE public.saved_contacts DROP COLUMN owner_id;
        ALTER TABLE public.saved_contacts RENAME COLUMN owner_id_uuid TO owner_id;
    END IF;
END $$;

-- saved_contacts.contact_user_id (text -> uuid)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saved_contacts'
          AND column_name = 'contact_user_id'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE public.saved_contacts ADD COLUMN contact_user_id_uuid uuid;
        UPDATE public.saved_contacts sc
        SET contact_user_id_uuid = up.id
        FROM public.user_profiles up
        WHERE up.clerk_user_id = sc.contact_user_id
           OR up.user_id = sc.contact_user_id;
        ALTER TABLE public.saved_contacts DROP COLUMN contact_user_id;
        ALTER TABLE public.saved_contacts RENAME COLUMN contact_user_id_uuid TO contact_user_id;
    END IF;
END $$;

-- 3) Drop legacy user_profiles.user_id (text)
ALTER TABLE public.user_profiles
DROP COLUMN IF EXISTS user_id;

-- Recreate public_profiles view using user_profiles.id
CREATE VIEW public.public_profiles AS
SELECT
    id AS user_id,
    display_name,
    username,
    avatar,
    bio,
    banner_color,
    banner_pattern,
    banner_image_url,
    interests,
    city,
    phone,
    birthday,
    created_at
FROM public.user_profiles;

-- 4) Repoint instance_memberships.user_id to user_profiles(id)
ALTER TABLE public.instance_memberships
DROP CONSTRAINT IF EXISTS instance_memberships_user_id_fkey;

ALTER TABLE public.instance_memberships
ADD CONSTRAINT instance_memberships_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

-- 2) Add missing user-related foreign keys
ALTER TABLE public.celebrations
DROP CONSTRAINT IF EXISTS celebrations_author_id_fkey;
ALTER TABLE public.celebrations
ADD CONSTRAINT celebrations_author_id_fkey
FOREIGN KEY (author_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.celebrations
DROP CONSTRAINT IF EXISTS celebrations_recipient_id_fkey;
ALTER TABLE public.celebrations
ADD CONSTRAINT celebrations_recipient_id_fkey
FOREIGN KEY (recipient_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey
FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;
ALTER TABLE public.messages
ADD CONSTRAINT messages_recipient_id_fkey
FOREIGN KEY (recipient_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.message_reactions
DROP CONSTRAINT IF EXISTS message_reactions_user_id_fkey;
ALTER TABLE public.message_reactions
ADD CONSTRAINT message_reactions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.feedback
DROP CONSTRAINT IF EXISTS feedback_user_id_fkey;
ALTER TABLE public.feedback
ADD CONSTRAINT feedback_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.favorite_movies
DROP CONSTRAINT IF EXISTS favorite_movies_user_id_fkey;
ALTER TABLE public.favorite_movies
ADD CONSTRAINT favorite_movies_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.rate_limits
DROP CONSTRAINT IF EXISTS rate_limits_user_id_fkey;
ALTER TABLE public.rate_limits
ADD CONSTRAINT rate_limits_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.event_chat_messages
DROP CONSTRAINT IF EXISTS event_chat_messages_user_id_fkey;
ALTER TABLE public.event_chat_messages
ADD CONSTRAINT event_chat_messages_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.event_manager_requests
DROP CONSTRAINT IF EXISTS event_manager_requests_user_id_fkey;
ALTER TABLE public.event_manager_requests
ADD CONSTRAINT event_manager_requests_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.event_manager_requests
DROP CONSTRAINT IF EXISTS event_manager_requests_reviewed_by_fkey;
ALTER TABLE public.event_manager_requests
ADD CONSTRAINT event_manager_requests_reviewed_by_fkey
FOREIGN KEY (reviewed_by) REFERENCES public.user_profiles(id);

ALTER TABLE public.saved_contacts
DROP CONSTRAINT IF EXISTS saved_contacts_owner_id_fkey;
ALTER TABLE public.saved_contacts
ADD CONSTRAINT saved_contacts_owner_id_fkey
FOREIGN KEY (owner_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.saved_contacts
DROP CONSTRAINT IF EXISTS saved_contacts_contact_user_id_fkey;
ALTER TABLE public.saved_contacts
ADD CONSTRAINT saved_contacts_contact_user_id_fkey
FOREIGN KEY (contact_user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.gift_exchange_matches
DROP CONSTRAINT IF EXISTS gift_exchange_matches_giver_user_id_fkey;
ALTER TABLE public.gift_exchange_matches
ADD CONSTRAINT gift_exchange_matches_giver_user_id_fkey
FOREIGN KEY (giver_user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.gift_exchange_matches
DROP CONSTRAINT IF EXISTS gift_exchange_matches_receiver_user_id_fkey;
ALTER TABLE public.gift_exchange_matches
ADD CONSTRAINT gift_exchange_matches_receiver_user_id_fkey
FOREIGN KEY (receiver_user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.gift_exchange_wishlist_items
DROP CONSTRAINT IF EXISTS gift_exchange_wishlist_items_user_id_fkey;
ALTER TABLE public.gift_exchange_wishlist_items
ADD CONSTRAINT gift_exchange_wishlist_items_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.gift_exchange_wishlist_templates
DROP CONSTRAINT IF EXISTS gift_exchange_wishlist_templates_user_id_fkey;
ALTER TABLE public.gift_exchange_wishlist_templates
ADD CONSTRAINT gift_exchange_wishlist_templates_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.app_settings
DROP CONSTRAINT IF EXISTS app_settings_updated_by_fkey;
ALTER TABLE public.app_settings
ADD CONSTRAINT app_settings_updated_by_fkey
FOREIGN KEY (updated_by) REFERENCES public.user_profiles(id);

COMMIT;
