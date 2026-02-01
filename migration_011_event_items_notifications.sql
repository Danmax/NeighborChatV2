-- Migration 011: Event items + notifications helpers
-- Date: 2026-02-01
-- Description: Add SECURITY DEFINER RPCs for potluck items and event notifications

BEGIN;

CREATE OR REPLACE FUNCTION public.add_event_item(
    p_event_id TEXT,
    p_name TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_event record;
    v_items jsonb;
    v_new_item jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id, created_by_id, event_data
    INTO v_event
    FROM public.community_events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.created_by_id <> v_user_id THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'Item name required';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);
    v_new_item := jsonb_build_object(
        'id', 'item_' || extract(epoch from now())::bigint::text,
        'name', p_name,
        'status', 'open',
        'claimed_by_id', null,
        'claimed_by_name', null
    );

    v_items := v_items || jsonb_build_array(v_new_item);

    UPDATE public.community_events
    SET event_data = jsonb_set(COALESCE(event_data, '{}'::jsonb), '{items}', v_items, true)
    WHERE id = p_event_id;

    RETURN v_items;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_event_item(
    p_event_id TEXT,
    p_item_id TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_event record;
    v_items jsonb;
    v_new_items jsonb := '[]'::jsonb;
    v_item jsonb;
    v_found boolean := false;
    v_claimed_by text;
    v_profile record;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id, event_data
    INTO v_event
    FROM public.community_events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    SELECT display_name
    INTO v_profile
    FROM public.public_profiles
    WHERE user_id = v_user_id::text
    LIMIT 1;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        IF (v_item->>'id') = p_item_id THEN
            v_found := true;
            v_claimed_by := v_item->>'claimed_by_id';

            IF v_claimed_by IS NULL OR v_claimed_by = '' THEN
                v_item := jsonb_set(v_item, '{status}', to_jsonb('claimed'::text), true);
                v_item := jsonb_set(v_item, '{claimed_by_id}', to_jsonb(v_user_id::text), true);
                v_item := jsonb_set(v_item, '{claimed_by_name}', to_jsonb(COALESCE(v_profile.display_name, 'Neighbor')), true);
            ELSIF v_claimed_by = v_user_id::text THEN
                v_item := v_item - 'claimed_by_id' - 'claimed_by_name';
                v_item := jsonb_set(v_item, '{status}', to_jsonb('open'::text), true);
            ELSE
                RAISE EXCEPTION 'Item already claimed';
            END IF;
        END IF;

        v_new_items := v_new_items || jsonb_build_array(v_item);
    END LOOP;

    IF NOT v_found THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    UPDATE public.community_events
    SET event_data = jsonb_set(COALESCE(event_data, '{}'::jsonb), '{items}', v_new_items, true)
    WHERE id = p_event_id;

    RETURN v_new_items;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_event_item(
    p_event_id TEXT,
    p_item_id TEXT,
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_event record;
    v_items jsonb;
    v_new_items jsonb := '[]'::jsonb;
    v_item jsonb;
    v_found boolean := false;
    v_profile record;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id, created_by_id, event_data
    INTO v_event
    FROM public.community_events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.created_by_id <> v_user_id THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    SELECT display_name
    INTO v_profile
    FROM public.public_profiles
    WHERE user_id = p_user_id::text
    LIMIT 1;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        IF (v_item->>'id') = p_item_id THEN
            v_found := true;
            v_item := jsonb_set(v_item, '{status}', to_jsonb('assigned'::text), true);
            v_item := jsonb_set(v_item, '{claimed_by_id}', to_jsonb(p_user_id::text), true);
            v_item := jsonb_set(v_item, '{claimed_by_name}', to_jsonb(COALESCE(v_profile.display_name, 'Neighbor')), true);
        END IF;

        v_new_items := v_new_items || jsonb_build_array(v_item);
    END LOOP;

    IF NOT v_found THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    UPDATE public.community_events
    SET event_data = jsonb_set(COALESCE(event_data, '{}'::jsonb), '{items}', v_new_items, true)
    WHERE id = p_event_id;

    RETURN v_new_items;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_event_notification(
    p_event_id TEXT,
    p_message TEXT,
    p_user_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_event record;
    v_targets uuid[];
    v_count integer := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_message IS NULL OR btrim(p_message) = '' THEN
        RAISE EXCEPTION 'Message required';
    END IF;

    SELECT id, name, created_by_id
    INTO v_event
    FROM public.community_events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.created_by_id <> v_user_id THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    IF p_user_ids IS NULL THEN
        SELECT array_agg(membership_id::uuid)
        INTO v_targets
        FROM public.event_participants
        WHERE event_id = p_event_id;
    ELSE
        v_targets := p_user_ids;
    END IF;

    IF v_targets IS NULL OR array_length(v_targets, 1) IS NULL THEN
        RETURN 0;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    SELECT
        unnest(v_targets),
        'event_update',
        'Event Update: ' || v_event.name,
        p_message,
        jsonb_build_object('event_id', v_event.id)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

ALTER FUNCTION public.add_event_item(TEXT, TEXT)
SET search_path = public, pg_temp;

ALTER FUNCTION public.claim_event_item(TEXT, TEXT)
SET search_path = public, pg_temp;

ALTER FUNCTION public.assign_event_item(TEXT, TEXT, uuid)
SET search_path = public, pg_temp;

ALTER FUNCTION public.send_event_notification(TEXT, TEXT, uuid[])
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.add_event_item(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.claim_event_item(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.assign_event_item(TEXT, TEXT, uuid) FROM public;
REVOKE ALL ON FUNCTION public.send_event_notification(TEXT, TEXT, uuid[]) FROM public;

GRANT EXECUTE ON FUNCTION public.add_event_item(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_item(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_event_item(TEXT, TEXT, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_event_notification(TEXT, TEXT, uuid[]) TO authenticated;

COMMIT;
