-- Migration 021: Event RPCs accept TEXT event ids
-- Date: 2026-02-01
-- Description: Fix enhanced event RPCs to work with text-based community_events.id

BEGIN;

-- 1. ADD_EVENT_ITEM_V2 with TEXT event id
CREATE OR REPLACE FUNCTION public.add_event_item_v2(
    p_event_id TEXT,
    p_name TEXT,
    p_category TEXT DEFAULT 'other',
    p_needed_qty INTEGER DEFAULT 1,
    p_slots INTEGER DEFAULT 1,
    p_allow_recipe BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_items JSONB;
    v_new_item JSONB;
    v_item_id TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.created_by_id != v_user_id THEN
        IF NOT COALESCE((v_event.settings->>'potluck_allow_new_items')::boolean, true) THEN
            RAISE EXCEPTION 'Adding items is disabled for this event';
        END IF;
    END IF;

    v_item_id := 'item_' || gen_random_uuid()::text;

    v_new_item := jsonb_build_object(
        'id', v_item_id,
        'name', p_name,
        'category', p_category,
        'needed_qty', p_needed_qty,
        'slots', p_slots,
        'allow_recipe', p_allow_recipe,
        'recipe_id', null,
        'claims', '[]'::jsonb,
        'created_by', v_user_id,
        'created_at', now()
    );

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);
    v_items := v_items || v_new_item;

    UPDATE public.community_events
    SET event_data = jsonb_set(
        COALESCE(event_data, '{}'::jsonb),
        '{items}',
        v_items
    ),
    updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'item', v_new_item
    );
END;
$$;

-- 2. CLAIM_EVENT_ITEM_V2 with TEXT event id
CREATE OR REPLACE FUNCTION public.claim_event_item_v2(
    p_event_id TEXT,
    p_item_id TEXT,
    p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_name TEXT;
    v_event RECORD;
    v_items JSONB;
    v_item JSONB;
    v_item_index INTEGER;
    v_claims JSONB;
    v_total_claimed INTEGER;
    v_available INTEGER;
    v_new_claim JSONB;
    v_claim_id TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT COALESCE(display_name, username, 'User') INTO v_user_name
    FROM public.user_profiles WHERE user_id = v_user_id;

    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    SELECT i-1 INTO v_item_index
    FROM jsonb_array_elements(v_items) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_item_id;

    IF v_item_index IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    v_item := v_items->v_item_index;
    v_claims := COALESCE(v_item->'claims', '[]'::jsonb);

    SELECT COALESCE(SUM((claim->>'quantity_claimed')::integer), 0)
    INTO v_total_claimed
    FROM jsonb_array_elements(v_claims) AS claim;

    v_available := COALESCE((v_item->>'slots')::integer, 1) - v_total_claimed;

    IF p_quantity > v_available THEN
        RAISE EXCEPTION 'Not enough slots available (% available)', v_available;
    END IF;

    v_claim_id := 'claim_' || gen_random_uuid()::text;
    v_new_claim := jsonb_build_object(
        'id', v_claim_id,
        'user_id', v_user_id,
        'user_name', v_user_name,
        'quantity_claimed', p_quantity,
        'status', 'claimed',
        'created_at', now()
    );

    v_claims := v_claims || v_new_claim;
    v_item := jsonb_set(v_item, '{claims}', v_claims);
    v_items := jsonb_set(v_items, ARRAY[v_item_index::text], v_item);

    UPDATE public.community_events
    SET event_data = jsonb_set(
        COALESCE(event_data, '{}'::jsonb),
        '{items}',
        v_items
    ),
    updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'claim', v_new_claim
    );
END;
$$;

-- 3. UNCLAIM_EVENT_ITEM with TEXT event id
CREATE OR REPLACE FUNCTION public.unclaim_event_item(
    p_event_id TEXT,
    p_item_id TEXT,
    p_claim_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_items JSONB;
    v_item JSONB;
    v_item_index INTEGER;
    v_claims JSONB;
    v_claim JSONB;
    v_new_claims JSONB := '[]'::jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    SELECT i-1 INTO v_item_index
    FROM jsonb_array_elements(v_items) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_item_id;

    IF v_item_index IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    v_item := v_items->v_item_index;
    v_claims := COALESCE(v_item->'claims', '[]'::jsonb);

    FOR v_claim IN SELECT * FROM jsonb_array_elements(v_claims)
    LOOP
        IF v_claim->>'id' = p_claim_id THEN
            IF v_claim->>'user_id' != v_user_id::text AND v_event.created_by_id != v_user_id THEN
                RAISE EXCEPTION 'Not authorized to remove this claim';
            END IF;
        ELSE
            v_new_claims := v_new_claims || v_claim;
        END IF;
    END LOOP;

    v_item := jsonb_set(v_item, '{claims}', v_new_claims);
    v_items := jsonb_set(v_items, ARRAY[v_item_index::text], v_item);

    UPDATE public.community_events
    SET event_data = jsonb_set(
        COALESCE(event_data, '{}'::jsonb),
        '{items}',
        v_items
    ),
    updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. INVITE_SPEAKER with TEXT event id
CREATE OR REPLACE FUNCTION public.invite_speaker(
    p_event_id TEXT,
    p_speaker_id UUID,
    p_talk_title TEXT,
    p_talk_abstract TEXT DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_speaker RECORD;
    v_invites JSONB;
    v_new_invite JSONB;
    v_invite_id TEXT;
    v_order INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND created_by_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    SELECT * INTO v_speaker FROM public.speakers WHERE id = p_speaker_id;
    IF v_speaker IS NULL THEN
        RAISE EXCEPTION 'Speaker not found';
    END IF;

    v_invites := COALESCE(v_event.event_data->'speaker_invites', '[]'::jsonb);

    SELECT COALESCE(MAX((inv->>'order')::integer), 0) + 1 INTO v_order
    FROM jsonb_array_elements(v_invites) AS inv;

    v_invite_id := 'invite_' || gen_random_uuid()::text;
    v_new_invite := jsonb_build_object(
        'id', v_invite_id,
        'speaker_id', p_speaker_id,
        'speaker_name', v_speaker.name,
        'invite_status', 'pending',
        'talk_title', p_talk_title,
        'talk_abstract', p_talk_abstract,
        'duration_minutes', p_duration_minutes,
        'order', v_order,
        'created_at', now()
    );

    v_invites := v_invites || v_new_invite;

    UPDATE public.community_events
    SET event_data = jsonb_set(
        COALESCE(event_data, '{}'::jsonb),
        '{speaker_invites}',
        v_invites
    ),
    updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object('success', true, 'invite', v_new_invite);
END;
$$;

-- 5. UPDATE_SPEAKER_INVITE_STATUS with TEXT event id
CREATE OR REPLACE FUNCTION public.update_speaker_invite_status(
    p_event_id TEXT,
    p_invite_id TEXT,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_invites JSONB;
    v_invite JSONB;
    v_invite_index INTEGER;
    v_speaker_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_status NOT IN ('accepted', 'declined', 'pending') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    v_invites := COALESCE(v_event.event_data->'speaker_invites', '[]'::jsonb);

    SELECT i-1 INTO v_invite_index
    FROM jsonb_array_elements(v_invites) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_invite_id;

    IF v_invite_index IS NULL THEN
        RAISE EXCEPTION 'Invite not found';
    END IF;

    v_invite := v_invites->v_invite_index;
    v_speaker_id := (v_invite->>'speaker_id')::uuid;

    IF v_event.created_by_id != v_user_id THEN
        IF NOT EXISTS (SELECT 1 FROM public.speakers WHERE id = v_speaker_id AND created_by_id = v_user_id) THEN
            RAISE EXCEPTION 'Not authorized';
        END IF;
    END IF;

    v_invite := jsonb_set(v_invite, '{invite_status}', to_jsonb(p_status));
    v_invites := jsonb_set(v_invites, ARRAY[v_invite_index::text], v_invite);

    UPDATE public.community_events
    SET event_data = jsonb_set(
        COALESCE(event_data, '{}'::jsonb),
        '{speaker_invites}',
        v_invites
    ),
    updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_event_item_v2(TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_item_v2(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unclaim_event_item(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_speaker(TEXT, UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_speaker_invite_status(TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
