-- Migration 046: Gift exchange (wishlists, templates, matches, messages)
-- Date: 2026-02-04
-- Description: Add gift exchange tables and RPCs

BEGIN;

CREATE TABLE IF NOT EXISTS public.gift_exchange_wishlist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    url text,
    price_range text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_exchange_wishlist_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    url text,
    price_range text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_exchange_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
    giver_user_id uuid NOT NULL,
    receiver_user_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'approved',
    created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gift_exchange_matches_unique
ON public.gift_exchange_matches(event_id, giver_user_id);

ALTER TABLE public.gift_exchange_wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_exchange_wishlist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_exchange_matches ENABLE ROW LEVEL SECURITY;

-- Wishlist item policies
DROP POLICY IF EXISTS "gift_wishlist_select" ON public.gift_exchange_wishlist_items;
DROP POLICY IF EXISTS "gift_wishlist_insert" ON public.gift_exchange_wishlist_items;
DROP POLICY IF EXISTS "gift_wishlist_update" ON public.gift_exchange_wishlist_items;
DROP POLICY IF EXISTS "gift_wishlist_delete" ON public.gift_exchange_wishlist_items;

CREATE POLICY "gift_wishlist_select"
ON public.gift_exchange_wishlist_items FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.gift_exchange_matches m
        WHERE m.event_id = gift_exchange_wishlist_items.event_id
          AND m.giver_user_id = auth.uid()
          AND m.receiver_user_id = gift_exchange_wishlist_items.user_id
    )
    OR EXISTS (
        SELECT 1 FROM public.gift_exchange_matches m
        WHERE m.event_id = gift_exchange_wishlist_items.event_id
          AND m.receiver_user_id = auth.uid()
          AND m.giver_user_id = gift_exchange_wishlist_items.user_id
    )
    OR EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_wishlist_items.event_id
          AND e.created_by_id::text = auth.uid()::text
    )
);

CREATE POLICY "gift_wishlist_insert"
ON public.gift_exchange_wishlist_items FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "gift_wishlist_update"
ON public.gift_exchange_wishlist_items FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "gift_wishlist_delete"
ON public.gift_exchange_wishlist_items FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Template policies
DROP POLICY IF EXISTS "gift_template_select" ON public.gift_exchange_wishlist_templates;
DROP POLICY IF EXISTS "gift_template_insert" ON public.gift_exchange_wishlist_templates;
DROP POLICY IF EXISTS "gift_template_update" ON public.gift_exchange_wishlist_templates;
DROP POLICY IF EXISTS "gift_template_delete" ON public.gift_exchange_wishlist_templates;

CREATE POLICY "gift_template_select"
ON public.gift_exchange_wishlist_templates FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "gift_template_insert"
ON public.gift_exchange_wishlist_templates FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "gift_template_update"
ON public.gift_exchange_wishlist_templates FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "gift_template_delete"
ON public.gift_exchange_wishlist_templates FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Match policies (organizer only for insert/update; matched users can read)
DROP POLICY IF EXISTS "gift_matches_select" ON public.gift_exchange_matches;
DROP POLICY IF EXISTS "gift_matches_insert" ON public.gift_exchange_matches;
DROP POLICY IF EXISTS "gift_matches_update" ON public.gift_exchange_matches;

CREATE POLICY "gift_matches_select"
ON public.gift_exchange_matches FOR SELECT
TO authenticated
USING (
    giver_user_id = auth.uid()
    OR receiver_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id::text = auth.uid()::text
    )
);

CREATE POLICY "gift_matches_insert"
ON public.gift_exchange_matches FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id::text = auth.uid()::text
    )
);

CREATE POLICY "gift_matches_update"
ON public.gift_exchange_matches FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id::text = auth.uid()::text
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = gift_exchange_matches.event_id
          AND e.created_by_id::text = auth.uid()::text
    )
);

CREATE OR REPLACE FUNCTION public.generate_gift_exchange_matches(
    p_event_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_users uuid[];
    v_count integer := 0;
    v_len integer;
    v_i integer;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = p_event_id
          AND e.created_by_id::text = v_user_id::text
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
    p_giver_user_id uuid,
    p_receiver_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.community_events e
        WHERE e.id = p_event_id
          AND e.created_by_id::text = v_user_id::text
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
    p_receiver_id uuid,
    p_kind text,
    p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_match boolean := false;
    v_msg record;
BEGIN
    v_user_id := auth.uid();
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
          AND e.created_by_id::text = v_user_id::text
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

ALTER FUNCTION public.generate_gift_exchange_matches(text)
SET search_path = public, pg_temp;
ALTER FUNCTION public.assign_gift_exchange_match(text, uuid, uuid)
SET search_path = public, pg_temp;
ALTER FUNCTION public.send_gift_exchange_message(text, uuid, text, text)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.generate_gift_exchange_matches(text) FROM public;
REVOKE ALL ON FUNCTION public.assign_gift_exchange_match(text, uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.send_gift_exchange_message(text, uuid, text, text) FROM public;

GRANT EXECUTE ON FUNCTION public.generate_gift_exchange_matches(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_gift_exchange_match(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_gift_exchange_message(text, uuid, text, text) TO authenticated;

COMMIT;
