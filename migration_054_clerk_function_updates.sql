-- Migration 054: Clerk auth function updates
-- Date: 2026-02-05
-- Description: Update RPCs to use current_user_id() (text) and drop uuid overloads

BEGIN;

-- Drop policies that depend on obsolete uuid-based helper, then drop function
DROP POLICY IF EXISTS "View instance members" ON public.instance_memberships;
DROP FUNCTION IF EXISTS public.is_instance_member_uid(uuid, text);

-- Celebration reactions
CREATE OR REPLACE FUNCTION public.add_celebration_reaction(
    p_celebration_id TEXT,
    p_emoji TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_reactions jsonb;
    v_updated jsonb := '{}'::jsonb;
    v_value jsonb;
    v_arr jsonb;
    v_user_text text;
    v_has_reacted boolean := false;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_emoji IS NULL OR btrim(p_emoji) = '' THEN
        RAISE EXCEPTION 'Emoji required';
    END IF;

    SELECT reactions
    INTO v_reactions
    FROM public.celebrations
    WHERE id = p_celebration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Celebration not found';
    END IF;

    v_reactions := COALESCE(v_reactions, '{}'::jsonb);
    v_user_text := v_user_id::text;

    FOR v_value IN SELECT * FROM jsonb_each(v_reactions)
    LOOP
        v_arr := COALESCE(v_value.value, '[]'::jsonb);

        IF v_value.key = p_emoji THEN
            IF v_arr ? v_user_text THEN
                v_has_reacted := true;
                v_arr := (SELECT jsonb_agg(value) FROM jsonb_array_elements_text(v_arr) WHERE value <> v_user_text);
            END IF;
        ELSE
            IF v_arr ? v_user_text THEN
                v_arr := (SELECT jsonb_agg(value) FROM jsonb_array_elements_text(v_arr) WHERE value <> v_user_text);
            END IF;
        END IF;

        IF v_arr IS NULL THEN
            v_arr := '[]'::jsonb;
        END IF;

        v_updated := jsonb_set(v_updated, ARRAY[v_value.key], v_arr, true);
    END LOOP;

    IF NOT v_has_reacted THEN
        v_arr := COALESCE(v_updated -> p_emoji, '[]'::jsonb) || to_jsonb(v_user_text);
        v_updated := jsonb_set(v_updated, ARRAY[p_emoji], v_arr, true);
    END IF;

    UPDATE public.celebrations
    SET reactions = v_updated
    WHERE id = p_celebration_id;

    RETURN v_updated;
END;
$$;

-- RSVP
CREATE OR REPLACE FUNCTION public.rsvp_event_v2(
    p_event_id TEXT,
    p_rsvp_status TEXT DEFAULT 'going',
    p_guest_count INTEGER DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_membership_id TEXT;
    v_event RECORD;
    v_participant_count INTEGER;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id INTO v_membership_id
    FROM public.instance_memberships
    WHERE user_id = v_user_id AND status = 'active'
    LIMIT 1;

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'No active membership';
    END IF;

    IF p_rsvp_status NOT IN ('going', 'maybe', 'not_going') THEN
        RAISE EXCEPTION 'Invalid RSVP status';
    END IF;

    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.status = 'closed' THEN
        RAISE EXCEPTION 'Event is closed';
    END IF;

    IF p_rsvp_status = 'going' AND v_event.capacity IS NOT NULL THEN
        SELECT COUNT(*) INTO v_participant_count
        FROM public.event_participants
        WHERE event_id = p_event_id
        AND rsvp_status = 'going'
        AND membership_id != v_membership_id;

        IF v_participant_count >= v_event.capacity THEN
            RAISE EXCEPTION 'Event is at capacity';
        END IF;
    END IF;

    INSERT INTO public.event_participants (
        event_id, membership_id, rsvp_status, guest_count, notes, approval_status
    ) VALUES (
        p_event_id, v_membership_id, p_rsvp_status, p_guest_count, p_notes,
        CASE WHEN v_event.join_policy = 'approval' THEN 'pending' ELSE 'approved' END
    )
    ON CONFLICT (event_id, membership_id) DO UPDATE
    SET rsvp_status = EXCLUDED.rsvp_status,
        guest_count = EXCLUDED.guest_count,
        notes = COALESCE(EXCLUDED.notes, public.event_participants.notes),
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'rsvp_status', p_rsvp_status,
        'requires_approval', v_event.join_policy = 'approval'
    );
END;
$$;

-- Event item RPCs (basic)
DROP FUNCTION IF EXISTS public.assign_event_item(TEXT, TEXT, uuid);
DROP FUNCTION IF EXISTS public.send_event_notification(TEXT, TEXT, uuid[]);

CREATE OR REPLACE FUNCTION public.add_event_item(
    p_event_id TEXT,
    p_name TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_event record;
    v_items jsonb;
    v_new_item jsonb;
BEGIN
    v_user_id := public.current_user_id();
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_event record;
    v_items jsonb;
    v_new_items jsonb := '[]'::jsonb;
    v_item jsonb;
    v_found boolean := false;
    v_claimed_by text;
    v_profile record;
BEGIN
    v_user_id := public.current_user_id();
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
    WHERE user_id = v_user_id
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
    p_user_id TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_event record;
    v_items jsonb;
    v_new_items jsonb := '[]'::jsonb;
    v_item jsonb;
    v_found boolean := false;
    v_profile record;
BEGIN
    v_user_id := public.current_user_id();
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

CREATE OR REPLACE FUNCTION public.remove_event_item(
    p_event_id TEXT,
    p_item_id TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_event record;
    v_items jsonb;
    v_new_items jsonb := '[]'::jsonb;
    v_item jsonb;
    v_found boolean := false;
BEGIN
    v_user_id := public.current_user_id();
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

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        IF (v_item->>'id') = p_item_id THEN
            v_found := true;
        ELSE
            v_new_items := v_new_items || jsonb_build_array(v_item);
        END IF;
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
    p_user_ids TEXT[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id text;
    v_event record;
    v_targets text[];
    v_count integer := 0;
BEGIN
    v_user_id := public.current_user_id();
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
        SELECT array_agg(DISTINCT im.user_id)
        INTO v_targets
        FROM public.event_participants ep
        JOIN public.instance_memberships im
            ON im.id = ep.membership_id
        WHERE ep.event_id = p_event_id;
    ELSE
        SELECT array_agg(DISTINCT im.user_id)
        INTO v_targets
        FROM public.instance_memberships im
        WHERE im.id = ANY(p_user_ids);
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

-- Event item RPCs (enhanced v2)
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id TEXT;
    v_event RECORD;
    v_items JSONB;
    v_new_item JSONB;
    v_item_id TEXT;
BEGIN
    v_user_id := public.current_user_id();
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

CREATE OR REPLACE FUNCTION public.claim_event_item_v2(
    p_event_id TEXT,
    p_item_id TEXT,
    p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id TEXT;
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
    v_user_id := public.current_user_id();
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

CREATE OR REPLACE FUNCTION public.unclaim_event_item(
    p_event_id TEXT,
    p_item_id TEXT,
    p_claim_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id TEXT;
    v_event RECORD;
    v_items JSONB;
    v_item JSONB;
    v_item_index INTEGER;
    v_claims JSONB;
    v_claim JSONB;
    v_new_claims JSONB := '[]'::jsonb;
BEGIN
    v_user_id := public.current_user_id();
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

-- Speaker invites (text ids)
DROP FUNCTION IF EXISTS public.invite_speaker(TEXT, UUID, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.update_speaker_invite_status(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invite_speaker(
    p_event_id TEXT,
    p_speaker_id TEXT,
    p_talk_title TEXT,
    p_talk_abstract TEXT DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id TEXT;
    v_event RECORD;
    v_speaker RECORD;
    v_invites JSONB;
    v_new_invite JSONB;
    v_invite_id TEXT;
    v_order INTEGER;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.created_by_id <> v_user_id THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    SELECT * INTO v_speaker FROM public.speakers WHERE id::text = p_speaker_id;
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

CREATE OR REPLACE FUNCTION public.update_speaker_invite_status(
    p_event_id TEXT,
    p_invite_id TEXT,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id TEXT;
    v_event RECORD;
    v_invites JSONB;
    v_invite JSONB;
    v_invite_index INTEGER;
    v_speaker_id TEXT;
BEGIN
    v_user_id := public.current_user_id();
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
    v_speaker_id := v_invite->>'speaker_id';

    IF v_event.created_by_id <> v_user_id THEN
        IF NOT EXISTS (SELECT 1 FROM public.speakers WHERE id::text = v_speaker_id AND created_by_id = v_user_id) THEN
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

-- Invite speaker by email
CREATE OR REPLACE FUNCTION public.invite_speaker_by_email(
    p_event_id TEXT,
    p_email TEXT,
    p_name TEXT,
    p_talk_title TEXT,
    p_talk_abstract TEXT DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id TEXT;
    v_event RECORD;
    v_speaker RECORD;
    v_invites JSONB;
    v_new_invite JSONB;
    v_invite_id TEXT;
    v_order INTEGER;
BEGIN
    v_user_id := public.current_user_id();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_email IS NULL OR btrim(p_email) = '' THEN
        RAISE EXCEPTION 'Email required';
    END IF;

    IF p_name IS NULL OR btrim(p_name) = '' THEN
        RAISE EXCEPTION 'Name required';
    END IF;

    IF p_talk_title IS NULL OR btrim(p_talk_title) = '' THEN
        RAISE EXCEPTION 'Talk title required';
    END IF;

    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.created_by_id <> v_user_id THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    SELECT * INTO v_speaker
    FROM public.speakers
    WHERE created_by_id = v_user_id
      AND lower(email) = lower(p_email)
    LIMIT 1;

    IF v_speaker IS NULL THEN
        INSERT INTO public.speakers (
            created_by_id,
            name,
            email,
            is_public
        )
        VALUES (
            v_user_id,
            p_name,
            p_email,
            false
        )
        RETURNING * INTO v_speaker;
    END IF;

    v_invites := COALESCE(v_event.event_data->'speaker_invites', '[]'::jsonb);

    SELECT COALESCE(MAX((inv->>'order')::integer), 0) + 1 INTO v_order
    FROM jsonb_array_elements(v_invites) AS inv;

    v_invite_id := 'invite_' || gen_random_uuid()::text;
    v_new_invite := jsonb_build_object(
        'id', v_invite_id,
        'speaker_id', v_speaker.id::text,
        'speaker_name', v_speaker.name,
        'speaker_email', v_speaker.email,
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

-- Event manager requests (reviewed_by as text)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'event_manager_requests'
          AND column_name = 'reviewed_by'
          AND data_type <> 'text'
    ) THEN
        ALTER TABLE public.event_manager_requests
        ALTER COLUMN reviewed_by TYPE text USING reviewed_by::text;
    END IF;
END $$;

DROP POLICY IF EXISTS "event_manager_requests_read_own" ON public.event_manager_requests;
DROP POLICY IF EXISTS "event_manager_requests_insert_own" ON public.event_manager_requests;
DROP POLICY IF EXISTS "event_manager_requests_admin_update" ON public.event_manager_requests;

CREATE POLICY "event_manager_requests_read_own"
ON public.event_manager_requests FOR SELECT
TO authenticated
USING (user_id::text = public.current_user_id() OR public.can_manage_event_access());

CREATE POLICY "event_manager_requests_insert_own"
ON public.event_manager_requests FOR INSERT
TO authenticated
WITH CHECK (user_id::text = public.current_user_id());

CREATE POLICY "event_manager_requests_admin_update"
ON public.event_manager_requests FOR UPDATE
TO authenticated
USING (public.can_manage_event_access())
WITH CHECK (public.can_manage_event_access());

CREATE OR REPLACE FUNCTION public.review_event_manager_request(
    p_request_id TEXT,
    p_status TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request RECORD;
BEGIN
    IF NOT public.can_manage_event_access() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    SELECT * INTO v_request
    FROM public.event_manager_requests
    WHERE id::text = p_request_id;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    UPDATE public.event_manager_requests
    SET status = p_status,
        reviewed_by = public.current_user_id(),
        reviewed_at = now()
    WHERE id = v_request.id;

    IF p_status = 'approved' THEN
        UPDATE public.user_profiles
        SET role = 'event_manager'
        WHERE user_id = v_request.user_id;
    END IF;

    RETURN true;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
