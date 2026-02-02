-- Migration 020: Enhanced Event RPC Functions
-- SECURITY DEFINER functions with search_path hardening

-- ============================================
-- 1. RSVP_EVENT_V2 - Enhanced RSVP with status/guests
-- ============================================

CREATE OR REPLACE FUNCTION public.rsvp_event_v2(
    p_event_id UUID,
    p_rsvp_status TEXT DEFAULT 'going',
    p_guest_count INTEGER DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_existing RECORD;
    v_participant_count INTEGER;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Validate rsvp_status
    IF p_rsvp_status NOT IN ('going', 'maybe', 'not_going') THEN
        RAISE EXCEPTION 'Invalid RSVP status';
    END IF;

    -- Get event details
    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- Check if event is closed
    IF v_event.status = 'closed' THEN
        RAISE EXCEPTION 'Event is closed';
    END IF;

    -- Check capacity for 'going' RSVPs
    IF p_rsvp_status = 'going' AND v_event.capacity IS NOT NULL THEN
        SELECT COUNT(*) INTO v_participant_count
        FROM public.event_participants
        WHERE event_id = p_event_id
        AND rsvp_status = 'going'
        AND user_id != v_user_id;

        IF v_participant_count >= v_event.capacity THEN
            RAISE EXCEPTION 'Event is at capacity';
        END IF;
    END IF;

    -- Check for existing participation
    SELECT * INTO v_existing
    FROM public.event_participants
    WHERE event_id = p_event_id AND user_id = v_user_id;

    IF v_existing IS NOT NULL THEN
        -- Update existing RSVP
        UPDATE public.event_participants
        SET rsvp_status = p_rsvp_status,
            guest_count = p_guest_count,
            notes = COALESCE(p_notes, notes),
            updated_at = now()
        WHERE event_id = p_event_id AND user_id = v_user_id;
    ELSE
        -- Create new participation
        INSERT INTO public.event_participants (
            event_id, user_id, rsvp_status, guest_count, notes,
            approval_status
        ) VALUES (
            p_event_id, v_user_id, p_rsvp_status, p_guest_count, p_notes,
            CASE WHEN v_event.join_policy = 'approval' THEN 'pending' ELSE 'approved' END
        );
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'rsvp_status', p_rsvp_status,
        'requires_approval', v_event.join_policy = 'approval'
    );

    RETURN v_result;
END;
$$;

-- ============================================
-- 2. APPROVE_RSVP - For approval-required events
-- ============================================

CREATE OR REPLACE FUNCTION public.approve_rsvp(
    p_event_id UUID,
    p_participant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user is event organizer
    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND organizer_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    -- Update approval status
    UPDATE public.event_participants
    SET approval_status = 'approved', updated_at = now()
    WHERE event_id = p_event_id AND user_id = p_participant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 3. REJECT_RSVP - Reject a pending RSVP
-- ============================================

CREATE OR REPLACE FUNCTION public.reject_rsvp(
    p_event_id UUID,
    p_participant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user is event organizer
    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND organizer_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    -- Update approval status
    UPDATE public.event_participants
    SET approval_status = 'rejected', updated_at = now()
    WHERE event_id = p_event_id AND user_id = p_participant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 4. CHECK_IN_PARTICIPANT - Mark checked in
-- ============================================

CREATE OR REPLACE FUNCTION public.check_in_participant(
    p_event_id UUID,
    p_participant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify user is event organizer
    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND organizer_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    -- Mark participant as checked in
    UPDATE public.event_participants
    SET checked_in = true, updated_at = now()
    WHERE event_id = p_event_id AND user_id = p_participant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 5. ADD_EVENT_ITEM_V2 - Enhanced item creation
-- ============================================

CREATE OR REPLACE FUNCTION public.add_event_item_v2(
    p_event_id UUID,
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

    -- Get event and verify access
    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- Check if user is organizer or if event allows new items
    IF v_event.organizer_id != v_user_id THEN
        -- Check settings for potluck_allow_new_items
        IF NOT COALESCE((v_event.settings->>'potluck_allow_new_items')::boolean, true) THEN
            RAISE EXCEPTION 'Adding items is disabled for this event';
        END IF;
    END IF;

    -- Generate item ID
    v_item_id := 'item_' || gen_random_uuid()::text;

    -- Create item object
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

    -- Get existing items or empty array
    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    -- Append new item
    v_items := v_items || v_new_item;

    -- Update event
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

-- ============================================
-- 6. CLAIM_EVENT_ITEM_V2 - Partial claims support
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_event_item_v2(
    p_event_id UUID,
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

    -- Get user name
    SELECT COALESCE(display_name, username, 'User') INTO v_user_name
    FROM public.user_profiles WHERE user_id = v_user_id;

    -- Get event
    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- Find item in event_data.items
    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    -- Find item index
    SELECT i-1 INTO v_item_index
    FROM jsonb_array_elements(v_items) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_item_id;

    IF v_item_index IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    v_item := v_items->v_item_index;
    v_claims := COALESCE(v_item->'claims', '[]'::jsonb);

    -- Calculate total claimed
    SELECT COALESCE(SUM((claim->>'quantity_claimed')::integer), 0)
    INTO v_total_claimed
    FROM jsonb_array_elements(v_claims) AS claim;

    v_available := COALESCE((v_item->>'slots')::integer, 1) - v_total_claimed;

    IF p_quantity > v_available THEN
        RAISE EXCEPTION 'Not enough slots available (% available)', v_available;
    END IF;

    -- Create new claim
    v_claim_id := 'claim_' || gen_random_uuid()::text;
    v_new_claim := jsonb_build_object(
        'id', v_claim_id,
        'user_id', v_user_id,
        'user_name', v_user_name,
        'quantity_claimed', p_quantity,
        'status', 'claimed',
        'created_at', now()
    );

    -- Append claim to item
    v_claims := v_claims || v_new_claim;
    v_item := jsonb_set(v_item, '{claims}', v_claims);

    -- Update items array
    v_items := jsonb_set(v_items, ARRAY[v_item_index::text], v_item);

    -- Save back to event
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

-- ============================================
-- 7. UNCLAIM_EVENT_ITEM - Remove a claim
-- ============================================

CREATE OR REPLACE FUNCTION public.unclaim_event_item(
    p_event_id UUID,
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

    -- Get event
    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    -- Find item index
    SELECT i-1 INTO v_item_index
    FROM jsonb_array_elements(v_items) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_item_id;

    IF v_item_index IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    v_item := v_items->v_item_index;
    v_claims := COALESCE(v_item->'claims', '[]'::jsonb);

    -- Find and verify claim ownership, rebuild claims without the removed one
    FOR v_claim IN SELECT * FROM jsonb_array_elements(v_claims)
    LOOP
        IF v_claim->>'id' = p_claim_id THEN
            -- Verify ownership or organizer
            IF v_claim->>'user_id' != v_user_id::text AND v_event.organizer_id != v_user_id THEN
                RAISE EXCEPTION 'Not authorized to remove this claim';
            END IF;
            -- Skip this claim (don't add to new_claims)
        ELSE
            v_new_claims := v_new_claims || v_claim;
        END IF;
    END LOOP;

    -- Update item with filtered claims
    v_item := jsonb_set(v_item, '{claims}', v_new_claims);
    v_items := jsonb_set(v_items, ARRAY[v_item_index::text], v_item);

    -- Save back to event
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

-- ============================================
-- 8. FULFILL_CLAIM - Mark claim as fulfilled
-- ============================================

CREATE OR REPLACE FUNCTION public.fulfill_claim(
    p_event_id UUID,
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
    v_claim_index INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get event
    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    -- Find item
    SELECT i-1 INTO v_item_index
    FROM jsonb_array_elements(v_items) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_item_id;

    IF v_item_index IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    v_item := v_items->v_item_index;
    v_claims := COALESCE(v_item->'claims', '[]'::jsonb);

    -- Find claim
    SELECT i-1 INTO v_claim_index
    FROM jsonb_array_elements(v_claims) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_claim_id;

    IF v_claim_index IS NULL THEN
        RAISE EXCEPTION 'Claim not found';
    END IF;

    v_claim := v_claims->v_claim_index;

    -- Verify ownership or organizer
    IF v_claim->>'user_id' != v_user_id::text AND v_event.organizer_id != v_user_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Update claim status
    v_claim := jsonb_set(v_claim, '{status}', '"fulfilled"');
    v_claims := jsonb_set(v_claims, ARRAY[v_claim_index::text], v_claim);
    v_item := jsonb_set(v_item, '{claims}', v_claims);
    v_items := jsonb_set(v_items, ARRAY[v_item_index::text], v_item);

    -- Save
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

-- ============================================
-- 9. ATTACH_RECIPE_TO_ITEM - Link recipe to item
-- ============================================

CREATE OR REPLACE FUNCTION public.attach_recipe_to_item(
    p_event_id UUID,
    p_item_id TEXT,
    p_recipe_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_recipe RECORD;
    v_items JSONB;
    v_item JSONB;
    v_item_index INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify recipe exists and is accessible
    SELECT * INTO v_recipe FROM public.recipes
    WHERE id = p_recipe_id AND (is_public = true OR created_by_id = v_user_id);

    IF v_recipe IS NULL THEN
        RAISE EXCEPTION 'Recipe not found or not accessible';
    END IF;

    -- Get event
    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- Check settings
    IF NOT COALESCE((v_event.settings->>'potluck_allow_recipes')::boolean, true) THEN
        RAISE EXCEPTION 'Recipes are disabled for this event';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    -- Find item
    SELECT i-1 INTO v_item_index
    FROM jsonb_array_elements(v_items) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_item_id;

    IF v_item_index IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    v_item := v_items->v_item_index;

    -- Check if item allows recipes
    IF NOT COALESCE((v_item->>'allow_recipe')::boolean, true) THEN
        RAISE EXCEPTION 'Item does not allow recipes';
    END IF;

    -- Update item with recipe_id
    v_item := jsonb_set(v_item, '{recipe_id}', to_jsonb(p_recipe_id));
    v_items := jsonb_set(v_items, ARRAY[v_item_index::text], v_item);

    -- Save
    UPDATE public.community_events
    SET event_data = jsonb_set(
        COALESCE(event_data, '{}'::jsonb),
        '{items}',
        v_items
    ),
    updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object('success', true, 'recipe_id', p_recipe_id);
END;
$$;

-- ============================================
-- 10. INVITE_SPEAKER - Speaker invite
-- ============================================

CREATE OR REPLACE FUNCTION public.invite_speaker(
    p_event_id UUID,
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

    -- Verify user is event organizer
    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND organizer_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    -- Verify speaker exists
    SELECT * INTO v_speaker FROM public.speakers WHERE id = p_speaker_id;

    IF v_speaker IS NULL THEN
        RAISE EXCEPTION 'Speaker not found';
    END IF;

    v_invites := COALESCE(v_event.event_data->'speaker_invites', '[]'::jsonb);

    -- Get next order
    SELECT COALESCE(MAX((inv->>'order')::integer), 0) + 1 INTO v_order
    FROM jsonb_array_elements(v_invites) AS inv;

    -- Create invite
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

    -- Save
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

-- ============================================
-- 11. UPDATE_SPEAKER_INVITE_STATUS - Accept/decline
-- ============================================

CREATE OR REPLACE FUNCTION public.update_speaker_invite_status(
    p_event_id UUID,
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

    -- Get event
    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    v_invites := COALESCE(v_event.event_data->'speaker_invites', '[]'::jsonb);

    -- Find invite
    SELECT i-1 INTO v_invite_index
    FROM jsonb_array_elements(v_invites) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_invite_id;

    IF v_invite_index IS NULL THEN
        RAISE EXCEPTION 'Invite not found';
    END IF;

    v_invite := v_invites->v_invite_index;
    v_speaker_id := (v_invite->>'speaker_id')::uuid;

    -- Verify: user is event organizer OR created the speaker profile
    IF v_event.organizer_id != v_user_id THEN
        -- Check if user owns the speaker profile
        IF NOT EXISTS (SELECT 1 FROM public.speakers WHERE id = v_speaker_id AND created_by_id = v_user_id) THEN
            RAISE EXCEPTION 'Not authorized';
        END IF;
    END IF;

    -- Update status
    v_invite := jsonb_set(v_invite, '{invite_status}', to_jsonb(p_status));
    v_invites := jsonb_set(v_invites, ARRAY[v_invite_index::text], v_invite);

    -- Save
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

-- ============================================
-- 12. GET_MEETING_LINK - Returns link only if RSVP=going
-- ============================================

CREATE OR REPLACE FUNCTION public.get_meeting_link(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_participant RECORD;
    v_show_to_rsvp_only BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get event
    SELECT * INTO v_event FROM public.community_events WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- Check if meeting link exists
    IF v_event.meeting_link IS NULL OR v_event.meeting_link = '' THEN
        RETURN jsonb_build_object('success', true, 'meeting_link', null);
    END IF;

    -- Check setting
    v_show_to_rsvp_only := COALESCE((v_event.settings->>'meetup_show_zoom_only_to_rsvp')::boolean, true);

    -- If user is organizer, always show
    IF v_event.organizer_id = v_user_id THEN
        RETURN jsonb_build_object('success', true, 'meeting_link', v_event.meeting_link);
    END IF;

    -- If setting is off, show to everyone
    IF NOT v_show_to_rsvp_only THEN
        RETURN jsonb_build_object('success', true, 'meeting_link', v_event.meeting_link);
    END IF;

    -- Check if user has RSVP = going
    SELECT * INTO v_participant
    FROM public.event_participants
    WHERE event_id = p_event_id
    AND user_id = v_user_id
    AND rsvp_status = 'going'
    AND approval_status = 'approved';

    IF v_participant IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'meeting_link', null,
            'reason', 'RSVP required to view meeting link'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'meeting_link', v_event.meeting_link);
END;
$$;

-- ============================================
-- 13. UPDATE_EVENT_STATUS - Change event status
-- ============================================

CREATE OR REPLACE FUNCTION public.update_event_status(
    p_event_id UUID,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_status NOT IN ('draft', 'published', 'closed') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    -- Verify user is organizer
    UPDATE public.community_events
    SET status = p_status, updated_at = now()
    WHERE id = p_event_id AND organizer_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found or not authorized';
    END IF;

    RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- ============================================
-- 14. UPDATE_EVENT_SETTINGS - Update event settings
-- ============================================

CREATE OR REPLACE FUNCTION public.update_event_settings(
    p_event_id UUID,
    p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_current_settings JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get current settings
    SELECT settings INTO v_current_settings
    FROM public.community_events
    WHERE id = p_event_id AND organizer_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found or not authorized';
    END IF;

    -- Merge settings
    v_current_settings := COALESCE(v_current_settings, '{}'::jsonb) || p_settings;

    -- Update
    UPDATE public.community_events
    SET settings = v_current_settings, updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object('success', true, 'settings', v_current_settings);
END;
$$;

-- ============================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.rsvp_event_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_rsvp TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rsvp TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_participant TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_event_item_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_item_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.unclaim_event_item TO authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_claim TO authenticated;
GRANT EXECUTE ON FUNCTION public.attach_recipe_to_item TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_speaker TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_speaker_invite_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meeting_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_settings TO authenticated;
