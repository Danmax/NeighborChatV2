-- Migration 062: Clerk RLS policies (UUID user_profiles.id)
-- Date: 2026-02-06
-- Description: Re-enable RLS and add Clerk UUID-based policies after user ref normalization

BEGIN;

-- Helper: platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid uuid;
    v_allowed boolean;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RETURN false;
    END IF;

    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = v_user_uuid
          AND role = 'admin'
    ) INTO v_allowed;

    RETURN COALESCE(v_allowed, false);
END;
$$;

-- Helper: event access manager
CREATE OR REPLACE FUNCTION public.can_manage_event_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid uuid;
    v_allowed boolean;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RETURN false;
    END IF;

    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = v_user_uuid
          AND role IN ('admin', 'event_manager')
    ) INTO v_allowed;

    RETURN COALESCE(v_allowed, false);
END;
$$;

-- Helper: event chat access
CREATE OR REPLACE FUNCTION public.can_access_event_chat(p_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid uuid;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.community_events e
        WHERE e.id = p_event_id
          AND e.created_by_id = v_user_uuid
    ) THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.event_participants ep
        JOIN public.instance_memberships im ON im.id = ep.membership_id
        WHERE ep.event_id = p_event_id
          AND im.user_id = v_user_uuid
          AND im.status = 'active'
          AND ep.approval_status IN ('approved', 'pending')
    );
END;
$$;

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celebrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_exchange_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_exchange_wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_exchange_wishlist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_manager_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe)
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- user_profiles (Clerk self)
CREATE POLICY user_profiles_select_self
ON public.user_profiles FOR SELECT
TO authenticated
USING (clerk_user_id = public.current_user_id());

CREATE POLICY user_profiles_insert_self
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (clerk_user_id = public.current_user_id());

CREATE POLICY user_profiles_update_self
ON public.user_profiles FOR UPDATE
TO authenticated
USING (clerk_user_id = public.current_user_id())
WITH CHECK (clerk_user_id = public.current_user_id());

CREATE POLICY user_profiles_delete_self
ON public.user_profiles FOR DELETE
TO authenticated
USING (clerk_user_id = public.current_user_id());

-- instance_memberships (own)
CREATE POLICY instance_memberships_select_self
ON public.instance_memberships FOR SELECT
TO authenticated
USING (user_id = public.current_user_uuid());

CREATE POLICY instance_memberships_modify_self
ON public.instance_memberships FOR ALL
TO authenticated
USING (user_id = public.current_user_uuid())
WITH CHECK (user_id = public.current_user_uuid());

-- celebrations (public read, own write)
CREATE POLICY celebrations_select_public
ON public.celebrations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY celebrations_insert_own
ON public.celebrations FOR INSERT
TO authenticated
WITH CHECK (author_id = public.current_user_uuid());

CREATE POLICY celebrations_update_own
ON public.celebrations FOR UPDATE
TO authenticated
USING (author_id = public.current_user_uuid())
WITH CHECK (author_id = public.current_user_uuid());

CREATE POLICY celebrations_delete_own
ON public.celebrations FOR DELETE
TO authenticated
USING (author_id = public.current_user_uuid());

-- messages
CREATE POLICY messages_select_own
ON public.messages FOR SELECT
TO authenticated
USING (sender_id = public.current_user_uuid() OR recipient_id = public.current_user_uuid());

CREATE POLICY messages_insert_own
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = public.current_user_uuid());

CREATE POLICY messages_update_recipient
ON public.messages FOR UPDATE
TO authenticated
USING (recipient_id = public.current_user_uuid())
WITH CHECK (recipient_id = public.current_user_uuid());

-- message_reactions
CREATE POLICY message_reactions_select_own
ON public.message_reactions FOR SELECT
TO authenticated
USING (user_id = public.current_user_uuid());

CREATE POLICY message_reactions_insert_own
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY message_reactions_delete_own
ON public.message_reactions FOR DELETE
TO authenticated
USING (user_id = public.current_user_uuid());

-- saved_contacts
CREATE POLICY saved_contacts_manage_own
ON public.saved_contacts FOR ALL
TO authenticated
USING (owner_id = public.current_user_uuid())
WITH CHECK (owner_id = public.current_user_uuid());

-- notifications
CREATE POLICY notifications_select_own
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = public.current_user_uuid());

CREATE POLICY notifications_insert_own
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY notifications_update_own
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = public.current_user_uuid())
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY notifications_delete_own
ON public.notifications FOR DELETE
TO authenticated
USING (user_id = public.current_user_uuid());

-- feedback
CREATE POLICY feedback_select_own_or_admin
ON public.feedback FOR SELECT
TO authenticated
USING (user_id = public.current_user_uuid() OR public.is_platform_admin());

CREATE POLICY feedback_insert_own
ON public.feedback FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY feedback_admin_update
ON public.feedback FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- event chat
CREATE POLICY event_chat_select
ON public.event_chat_messages FOR SELECT
TO authenticated
USING (public.can_access_event_chat(event_id));

CREATE POLICY event_chat_insert
ON public.event_chat_messages FOR INSERT
TO authenticated
WITH CHECK (
    user_id = public.current_user_uuid()
    AND public.can_access_event_chat(event_id)
);

CREATE POLICY event_chat_update_own
ON public.event_chat_messages FOR UPDATE
TO authenticated
USING (user_id = public.current_user_uuid())
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY event_chat_delete_own
ON public.event_chat_messages FOR DELETE
TO authenticated
USING (user_id = public.current_user_uuid());

-- community events
CREATE POLICY community_events_select_public
ON public.community_events FOR SELECT
TO authenticated
USING (visibility = 'public' OR created_by_id = public.current_user_uuid());

CREATE POLICY community_events_insert_own
ON public.community_events FOR INSERT
TO authenticated
WITH CHECK (created_by_id = public.current_user_uuid());

CREATE POLICY community_events_update_own
ON public.community_events FOR UPDATE
TO authenticated
USING (created_by_id = public.current_user_uuid())
WITH CHECK (created_by_id = public.current_user_uuid());

CREATE POLICY community_events_delete_own
ON public.community_events FOR DELETE
TO authenticated
USING (created_by_id = public.current_user_uuid());

-- event participants
CREATE POLICY event_participants_select
ON public.event_participants FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = event_participants.event_id
          AND (e.visibility = 'public' OR e.created_by_id = public.current_user_uuid())
    )
);

CREATE POLICY event_participants_insert_self
ON public.event_participants FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.instance_memberships im
        WHERE im.id = event_participants.membership_id
          AND im.user_id = public.current_user_uuid()
    )
);

CREATE POLICY event_participants_delete_self
ON public.event_participants FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.instance_memberships im
        WHERE im.id = event_participants.membership_id
          AND im.user_id = public.current_user_uuid()
    )
);

-- gift exchange
CREATE POLICY gift_wishlist_select
ON public.gift_exchange_wishlist_items FOR SELECT
TO authenticated
USING (
    user_id = public.current_user_uuid()
    OR EXISTS (
        SELECT 1 FROM public.gift_exchange_matches m
        WHERE m.event_id = gift_exchange_wishlist_items.event_id
          AND m.giver_user_id = public.current_user_uuid()
          AND m.receiver_user_id = gift_exchange_wishlist_items.user_id
    )
    OR EXISTS (
        SELECT 1 FROM public.gift_exchange_matches m
        WHERE m.event_id = gift_exchange_wishlist_items.event_id
          AND m.receiver_user_id = public.current_user_uuid()
          AND m.giver_user_id = gift_exchange_wishlist_items.user_id
    )
    OR EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_wishlist_items.event_id
          AND e.created_by_id = public.current_user_uuid()
    )
);

CREATE POLICY gift_wishlist_insert
ON public.gift_exchange_wishlist_items FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY gift_wishlist_update
ON public.gift_exchange_wishlist_items FOR UPDATE
TO authenticated
USING (user_id = public.current_user_uuid())
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY gift_wishlist_delete
ON public.gift_exchange_wishlist_items FOR DELETE
TO authenticated
USING (user_id = public.current_user_uuid());

CREATE POLICY gift_template_select
ON public.gift_exchange_wishlist_templates FOR SELECT
TO authenticated
USING (user_id = public.current_user_uuid());

CREATE POLICY gift_template_insert
ON public.gift_exchange_wishlist_templates FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY gift_template_update
ON public.gift_exchange_wishlist_templates FOR UPDATE
TO authenticated
USING (user_id = public.current_user_uuid())
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY gift_template_delete
ON public.gift_exchange_wishlist_templates FOR DELETE
TO authenticated
USING (user_id = public.current_user_uuid());

CREATE POLICY gift_matches_select
ON public.gift_exchange_matches FOR SELECT
TO authenticated
USING (
    giver_user_id = public.current_user_uuid()
    OR receiver_user_id = public.current_user_uuid()
    OR EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id = public.current_user_uuid()
    )
);

CREATE POLICY gift_matches_insert
ON public.gift_exchange_matches FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id = public.current_user_uuid()
    )
);

CREATE POLICY gift_matches_update
ON public.gift_exchange_matches FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id = public.current_user_uuid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id = public.current_user_uuid()
    )
);

-- recipes
CREATE POLICY recipes_select_public_or_own
ON public.recipes FOR SELECT
TO authenticated
USING (is_public = true OR created_by_id = public.current_user_uuid());

CREATE POLICY recipes_insert_own
ON public.recipes FOR INSERT
TO authenticated
WITH CHECK (created_by_id = public.current_user_uuid());

CREATE POLICY recipes_update_own
ON public.recipes FOR UPDATE
TO authenticated
USING (created_by_id = public.current_user_uuid())
WITH CHECK (created_by_id = public.current_user_uuid());

CREATE POLICY recipes_delete_own
ON public.recipes FOR DELETE
TO authenticated
USING (created_by_id = public.current_user_uuid());

-- speakers
CREATE POLICY speakers_select_public_or_own
ON public.speakers FOR SELECT
TO authenticated
USING (is_public = true OR created_by_id = public.current_user_uuid());

CREATE POLICY speakers_insert_own
ON public.speakers FOR INSERT
TO authenticated
WITH CHECK (created_by_id = public.current_user_uuid());

CREATE POLICY speakers_update_own
ON public.speakers FOR UPDATE
TO authenticated
USING (created_by_id = public.current_user_uuid())
WITH CHECK (created_by_id = public.current_user_uuid());

CREATE POLICY speakers_delete_own
ON public.speakers FOR DELETE
TO authenticated
USING (created_by_id = public.current_user_uuid());

-- favorite movies
CREATE POLICY favorite_movies_select_own
ON public.favorite_movies FOR SELECT
TO authenticated
USING (user_id = public.current_user_uuid());

CREATE POLICY favorite_movies_insert_own
ON public.favorite_movies FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY favorite_movies_delete_own
ON public.favorite_movies FOR DELETE
TO authenticated
USING (user_id = public.current_user_uuid());

-- event_manager_requests
CREATE POLICY event_manager_requests_select
ON public.event_manager_requests FOR SELECT
TO authenticated
USING (user_id = public.current_user_uuid() OR public.is_platform_admin());

CREATE POLICY event_manager_requests_insert
ON public.event_manager_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY event_manager_requests_update_admin
ON public.event_manager_requests FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- app_settings (admin only updates)
CREATE POLICY app_settings_select
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY app_settings_modify_admin
ON public.app_settings FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

COMMIT;
