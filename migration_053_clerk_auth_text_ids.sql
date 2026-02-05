-- Migration 053: Clerk auth (text subject) support
-- Date: 2026-02-05
-- Description: Switch auth comparisons to text sub and convert user_id columns to text

BEGIN;

-- Helper: Clerk user id from JWT (text)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT auth.jwt() ->> 'sub';
$$;

-- Admin helpers
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_allowed boolean;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_id = v_user_id
          AND role = 'admin'
    ) INTO v_allowed;

    RETURN COALESCE(v_allowed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_event_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_allowed boolean;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_id = v_user_id
          AND role IN ('admin', 'event_manager')
    ) INTO v_allowed;

    RETURN COALESCE(v_allowed, false);
END;
$$;

-- Instance memberships (user_id)
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'instance_memberships'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.instance_memberships', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.instance_memberships
ALTER COLUMN user_id TYPE text USING user_id::text;

CREATE POLICY "View instance memberships"
ON public.instance_memberships FOR SELECT
TO authenticated
USING (
    instance_id IN (
        SELECT im.instance_id
        FROM public.instance_memberships im
        WHERE im.user_id = public.current_user_id()
    )
);

CREATE POLICY "Manage own membership"
ON public.instance_memberships FOR ALL
TO authenticated
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());

-- is_instance_member helper
CREATE OR REPLACE FUNCTION public.is_instance_member(p_instance_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.instance_memberships
        WHERE user_id = public.current_user_id()
          AND instance_id = p_instance_id
          AND status = 'active'
    );
END;
$$;

-- User profiles
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', r.polname);
    END LOOP;
END $$;

CREATE POLICY "Allow users to view their own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (public.current_user_id() = user_id);

CREATE POLICY "Allow users to create their own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (public.current_user_id() = user_id);

CREATE POLICY "Allow users to update their own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (public.current_user_id() = user_id)
WITH CHECK (public.current_user_id() = user_id);

CREATE POLICY "Allow users to delete their own profile"
ON public.user_profiles FOR DELETE
TO authenticated
USING (public.current_user_id() = user_id);

-- Saved contacts
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_contacts'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.saved_contacts', r.polname);
    END LOOP;
END $$;

CREATE POLICY "Users manage their own contacts"
ON public.saved_contacts FOR ALL
TO authenticated
USING (owner_id = public.current_user_id())
WITH CHECK (owner_id = public.current_user_id());

-- Messages (sender/recipient)
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.messages
ALTER COLUMN sender_id TYPE text USING sender_id::text,
ALTER COLUMN recipient_id TYPE text USING recipient_id::text;

CREATE POLICY "Users can view own messages"
ON public.messages FOR SELECT
TO authenticated
USING (public.current_user_id() = sender_id OR public.current_user_id() = recipient_id);

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (public.current_user_id() = sender_id);

CREATE POLICY "Recipients can mark messages read"
ON public.messages FOR UPDATE
TO authenticated
USING (public.current_user_id() = recipient_id)
WITH CHECK (public.current_user_id() = recipient_id);

-- Celebrations
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'celebrations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.celebrations', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.celebrations
ALTER COLUMN author_id TYPE text USING author_id::text;

CREATE POLICY "Anyone can view public celebrations"
ON public.celebrations FOR SELECT
TO authenticated
USING (visibility = 'public');

CREATE POLICY "Users can view their celebrations"
ON public.celebrations FOR SELECT
TO authenticated
USING (public.current_user_id() = author_id OR public.current_user_id() = recipient_id);

CREATE POLICY "Authenticated users can create celebrations"
ON public.celebrations FOR INSERT
TO authenticated
WITH CHECK (public.current_user_id() = author_id);

CREATE POLICY "Users can update their own celebrations"
ON public.celebrations FOR UPDATE
TO authenticated
USING (public.current_user_id() = author_id);

CREATE POLICY "Users can delete their own celebrations"
ON public.celebrations FOR DELETE
TO authenticated
USING (public.current_user_id() = author_id);

-- Community events
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'community_events'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.community_events', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.community_events
ALTER COLUMN created_by_id TYPE text USING created_by_id::text;

CREATE POLICY "Anyone can view public events"
ON public.community_events FOR SELECT
TO authenticated
USING (visibility = 'public');

CREATE POLICY "Users can view their own events"
ON public.community_events FOR SELECT
TO authenticated
USING (public.current_user_id() = created_by_id);

CREATE POLICY "Authenticated users can create events"
ON public.community_events FOR INSERT
TO authenticated
WITH CHECK (public.current_user_id() = created_by_id);

CREATE POLICY "Users can update their own events"
ON public.community_events FOR UPDATE
TO authenticated
USING (public.current_user_id() = created_by_id);

CREATE POLICY "Users can delete their own events"
ON public.community_events FOR DELETE
TO authenticated
USING (public.current_user_id() = created_by_id);

-- Event participants (membership-based)
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_participants'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_participants', r.polname);
    END LOOP;
END $$;

CREATE POLICY "View event participants"
ON public.event_participants FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.community_events e
        WHERE e.id = event_participants.event_id
          AND (e.visibility = 'public' OR e.created_by_id = public.current_user_id())
    )
);

CREATE POLICY "Users RSVP to events"
ON public.event_participants FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.instance_memberships im
        WHERE im.id = event_participants.membership_id
          AND im.user_id = public.current_user_id()
    )
);

CREATE POLICY "Users remove RSVP"
ON public.event_participants FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.instance_memberships im
        WHERE im.id = event_participants.membership_id
          AND im.user_id = public.current_user_id()
    )
);

-- Notifications
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.notifications
ALTER COLUMN user_id TYPE text USING user_id::text;

CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = public.current_user_id());

CREATE POLICY "notifications_insert_own"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "notifications_update_own"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "notifications_delete_own"
ON public.notifications FOR DELETE
TO authenticated
USING (user_id = public.current_user_id());

-- Favorite movies
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'favorite_movies'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.favorite_movies', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.favorite_movies
ALTER COLUMN user_id TYPE text USING user_id::text;

CREATE POLICY "favorite_movies_select_own"
ON public.favorite_movies FOR SELECT
TO authenticated
USING (user_id = public.current_user_id());

CREATE POLICY "favorite_movies_insert_own"
ON public.favorite_movies FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "favorite_movies_delete_own"
ON public.favorite_movies FOR DELETE
TO authenticated
USING (user_id = public.current_user_id());

-- Feedback
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.feedback', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.feedback
ALTER COLUMN user_id TYPE text USING user_id::text;

CREATE POLICY "feedback_select_own"
ON public.feedback FOR SELECT
TO authenticated
USING (user_id = public.current_user_id() OR public.is_platform_admin());

CREATE POLICY "feedback_insert_own"
ON public.feedback FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "feedback_admin_update"
ON public.feedback FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Event chat messages
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_chat_messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_chat_messages', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.event_chat_messages
ALTER COLUMN user_id TYPE text USING user_id::text;

CREATE OR REPLACE FUNCTION public.can_access_event_chat(p_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.community_events e
        WHERE e.id = p_event_id
          AND e.created_by_id = v_user_id
    ) THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.event_participants ep
        JOIN public.instance_memberships im
            ON im.id = ep.membership_id
        WHERE ep.event_id = p_event_id
          AND im.user_id = v_user_id
          AND im.status = 'active'
          AND ep.approval_status IN ('approved', 'pending')
    );
END;
$$;

CREATE POLICY "event_chat_select"
ON public.event_chat_messages FOR SELECT
TO authenticated
USING (public.can_access_event_chat(event_id));

CREATE POLICY "event_chat_insert"
ON public.event_chat_messages FOR INSERT
TO authenticated
WITH CHECK (
    user_id = public.current_user_id()
    AND public.can_access_event_chat(event_id)
);

CREATE POLICY "event_chat_update_own"
ON public.event_chat_messages FOR UPDATE
TO authenticated
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "event_chat_delete_own"
ON public.event_chat_messages FOR DELETE
TO authenticated
USING (user_id = public.current_user_id());

CREATE OR REPLACE FUNCTION public.add_event_chat_message(
    p_event_id text,
    p_body text,
    p_message_type text DEFAULT 'text',
    p_gif_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_membership_id text;
    v_inserted record;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_body IS NULL OR btrim(p_body) = '' THEN
        RAISE EXCEPTION 'Message required';
    END IF;

    IF NOT public.can_access_event_chat(p_event_id) THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    SELECT id INTO v_membership_id
    FROM public.instance_memberships
    WHERE user_id = v_user_id
      AND status = 'active'
    LIMIT 1;

    INSERT INTO public.event_chat_messages (
        event_id,
        user_id,
        membership_id,
        body,
        message_type,
        metadata
    )
    VALUES (
        p_event_id,
        v_user_id,
        v_membership_id,
        p_body,
        COALESCE(p_message_type, 'text'),
        CASE
            WHEN p_gif_url IS NOT NULL AND btrim(p_gif_url) <> ''
                THEN jsonb_build_object('gif_url', p_gif_url)
            ELSE '{}'::jsonb
        END
    )
    RETURNING * INTO v_inserted;

    RETURN to_jsonb(v_inserted);
END;
$$;

-- Message reactions
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_reactions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.message_reactions', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.message_reactions
ALTER COLUMN user_id TYPE text USING user_id::text;

CREATE POLICY "message_reactions_select_own"
ON public.message_reactions FOR SELECT
TO authenticated
USING (user_id = public.current_user_id());

CREATE POLICY "message_reactions_insert_own"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "message_reactions_delete_own"
ON public.message_reactions FOR DELETE
TO authenticated
USING (user_id = public.current_user_id());

CREATE OR REPLACE FUNCTION public.add_message_reaction(
    p_message_id uuid,
    p_emoji text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_existing record;
    v_row record;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_emoji IS NULL OR btrim(p_emoji) = '' THEN
        RAISE EXCEPTION 'Emoji required';
    END IF;

    SELECT * INTO v_existing
    FROM public.message_reactions
    WHERE message_id = p_message_id
      AND user_id = v_user_id
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
        IF v_existing.emoji = p_emoji THEN
            DELETE FROM public.message_reactions WHERE id = v_existing.id;
            RETURN jsonb_build_object('removed', true);
        END IF;

        UPDATE public.message_reactions
        SET emoji = p_emoji
        WHERE id = v_existing.id
        RETURNING * INTO v_row;
        RETURN to_jsonb(v_row);
    END IF;

    INSERT INTO public.message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, v_user_id, p_emoji)
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
END;
$$;

-- Recipes
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'recipes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.recipes', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.recipes
ALTER COLUMN created_by_id TYPE text USING created_by_id::text;

CREATE POLICY "Recipes are public or own"
ON public.recipes FOR SELECT
TO authenticated
USING (
    visibility = 'public'
    OR created_by_id = public.current_user_id()
);

CREATE POLICY "Recipes insert own"
ON public.recipes FOR INSERT
TO authenticated
WITH CHECK (created_by_id = public.current_user_id());

CREATE POLICY "Recipes update own"
ON public.recipes FOR UPDATE
TO authenticated
USING (created_by_id = public.current_user_id())
WITH CHECK (created_by_id = public.current_user_id());

CREATE POLICY "Recipes delete own"
ON public.recipes FOR DELETE
TO authenticated
USING (created_by_id = public.current_user_id());

-- Speakers
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'speakers'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.speakers', r.polname);
    END LOOP;
END $$;

ALTER TABLE public.speakers
ALTER COLUMN created_by_id TYPE text USING created_by_id::text;

CREATE POLICY "Speakers are public or own"
ON public.speakers FOR SELECT
TO authenticated
USING (
    visibility = 'public'
    OR created_by_id = public.current_user_id()
);

CREATE POLICY "Speakers insert own"
ON public.speakers FOR INSERT
TO authenticated
WITH CHECK (created_by_id = public.current_user_id());

CREATE POLICY "Speakers update own"
ON public.speakers FOR UPDATE
TO authenticated
USING (created_by_id = public.current_user_id())
WITH CHECK (created_by_id = public.current_user_id());

CREATE POLICY "Speakers delete own"
ON public.speakers FOR DELETE
TO authenticated
USING (created_by_id = public.current_user_id());

-- Gift exchange tables
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename IN (
        'gift_exchange_wishlist_items',
        'gift_exchange_wishlist_templates',
        'gift_exchange_matches'
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.polname, r.tablename);
    END LOOP;
END $$;

ALTER TABLE public.gift_exchange_wishlist_items
ALTER COLUMN user_id TYPE text USING user_id::text;

ALTER TABLE public.gift_exchange_wishlist_templates
ALTER COLUMN user_id TYPE text USING user_id::text;

ALTER TABLE public.gift_exchange_matches
ALTER COLUMN giver_user_id TYPE text USING giver_user_id::text,
ALTER COLUMN receiver_user_id TYPE text USING receiver_user_id::text;

CREATE POLICY "gift_wishlist_select"
ON public.gift_exchange_wishlist_items FOR SELECT
TO authenticated
USING (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1 FROM public.gift_exchange_matches m
        WHERE m.event_id = gift_exchange_wishlist_items.event_id
          AND m.giver_user_id = public.current_user_id()
          AND m.receiver_user_id = gift_exchange_wishlist_items.user_id
    )
    OR EXISTS (
        SELECT 1 FROM public.gift_exchange_matches m
        WHERE m.event_id = gift_exchange_wishlist_items.event_id
          AND m.receiver_user_id = public.current_user_id()
          AND m.giver_user_id = gift_exchange_wishlist_items.user_id
    )
    OR EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_wishlist_items.event_id
          AND e.created_by_id = public.current_user_id()
    )
);

CREATE POLICY "gift_wishlist_insert"
ON public.gift_exchange_wishlist_items FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "gift_wishlist_update"
ON public.gift_exchange_wishlist_items FOR UPDATE
TO authenticated
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "gift_wishlist_delete"
ON public.gift_exchange_wishlist_items FOR DELETE
TO authenticated
USING (user_id = public.current_user_id());

CREATE POLICY "gift_template_select"
ON public.gift_exchange_wishlist_templates FOR SELECT
TO authenticated
USING (user_id = public.current_user_id());

CREATE POLICY "gift_template_insert"
ON public.gift_exchange_wishlist_templates FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "gift_template_update"
ON public.gift_exchange_wishlist_templates FOR UPDATE
TO authenticated
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "gift_template_delete"
ON public.gift_exchange_wishlist_templates FOR DELETE
TO authenticated
USING (user_id = public.current_user_id());

CREATE POLICY "gift_matches_select"
ON public.gift_exchange_matches FOR SELECT
TO authenticated
USING (
    giver_user_id = public.current_user_id()
    OR receiver_user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id = public.current_user_id()
    )
);

CREATE POLICY "gift_matches_insert"
ON public.gift_exchange_matches FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id = public.current_user_id()
    )
);

CREATE POLICY "gift_matches_update"
ON public.gift_exchange_matches FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id = public.current_user_id()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id = public.current_user_id()
    )
);

CREATE OR REPLACE FUNCTION public.generate_gift_exchange_matches(
    p_event_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_users text[];
    v_count integer := 0;
    v_len integer;
    v_i integer;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = p_event_id
          AND e.created_by_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    SELECT array_agg(DISTINCT im.user_id ORDER BY random())
    INTO v_users
    FROM public.event_participants ep
    JOIN public.instance_memberships im
        ON im.id = ep.membership_id
    WHERE ep.event_id = p_event_id
      AND ep.approval_status IN ('approved', 'pending')
      AND im.status = 'active';

    v_len := COALESCE(array_length(v_users, 1), 0);
    IF v_len < 2 THEN
        RAISE EXCEPTION 'Need at least 2 participants';
    END IF;

    DELETE FROM public.gift_exchange_matches WHERE event_id = p_event_id;

    FOR v_i IN 1..v_len LOOP
        INSERT INTO public.gift_exchange_matches(event_id, giver_user_id, receiver_user_id, status)
        VALUES (
            p_event_id,
            v_users[v_i],
            v_users[CASE WHEN v_i = v_len THEN 1 ELSE v_i + 1 END],
            'approved'
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_gift_exchange_match(
    p_event_id text,
    p_giver_user_id text,
    p_receiver_user_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = p_event_id
          AND e.created_by_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    INSERT INTO public.gift_exchange_matches(event_id, giver_user_id, receiver_user_id, status)
    VALUES (p_event_id, p_giver_user_id, p_receiver_user_id, 'approved')
    ON CONFLICT (event_id, giver_user_id)
    DO UPDATE SET receiver_user_id = excluded.receiver_user_id, status = 'approved';

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_gift_exchange_message(
    p_event_id text,
    p_receiver_id text,
    p_kind text,
    p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_match boolean := false;
    v_msg record;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_kind NOT IN ('postcard', 'gift', 'favor') THEN
        RAISE EXCEPTION 'Invalid message type';
    END IF;

    v_match := EXISTS (
        SELECT 1 FROM public.gift_exchange_matches m
        WHERE m.event_id = p_event_id
          AND m.giver_user_id = v_user_id
          AND m.receiver_user_id = p_receiver_id
    ) OR EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = p_event_id
          AND e.created_by_id = v_user_id
    );

    IF NOT v_match THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    INSERT INTO public.messages (sender_id, recipient_id, message_type, body, read, metadata)
    VALUES (
        v_user_id,
        p_receiver_id,
        'direct',
        p_body,
        false,
        jsonb_build_object('event_id', p_event_id, 'gift_exchange_type', p_kind)
    )
    RETURNING * INTO v_msg;

    RETURN to_jsonb(v_msg);
END;
$$;

-- Game sessions policies (depends on instance_memberships.user_id)
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_sessions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.game_sessions', r.polname);
    END LOOP;
END $$;

CREATE POLICY "game_sessions_select_members"
ON public.game_sessions FOR SELECT
TO authenticated
USING (is_instance_member(instance_id));

CREATE POLICY "game_sessions_insert_members"
ON public.game_sessions FOR INSERT
TO authenticated
WITH CHECK (
    is_instance_member(instance_id)
    AND host_membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_id()
          AND status = 'active'
          AND instance_id = game_sessions.instance_id
    )
);

CREATE POLICY "game_sessions_update_host"
ON public.game_sessions FOR UPDATE
TO authenticated
USING (
    host_membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_id()
          AND status = 'active'
          AND instance_id = game_sessions.instance_id
    )
)
WITH CHECK (
    host_membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_id()
          AND status = 'active'
          AND instance_id = game_sessions.instance_id
    )
);

COMMIT;

NOTIFY pgrst, 'reload schema';
