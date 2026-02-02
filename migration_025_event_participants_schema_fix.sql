-- Migration 025: Fix event_participants schema and RPC
-- Date: 2026-02-02
-- Description: Add missing updated_at column, fix RPC to use membership_id

BEGIN;

-- 1. Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'event_participants'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.event_participants
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 2. Add created_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'event_participants'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.event_participants
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 3. Fix rsvp_event_v2 to use membership_id (matches unique constraint)
CREATE OR REPLACE FUNCTION public.rsvp_event_v2(
    p_event_id TEXT,
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
    v_membership_id TEXT;
    v_event RECORD;
    v_participant_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get user's active membership_id
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

    -- Check capacity only when RSVPing as 'going'
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

    -- Upsert participant record
    INSERT INTO public.event_participants (
        event_id, membership_id, rsvp_status, guest_count, notes, approval_status, created_at, updated_at
    ) VALUES (
        p_event_id, v_membership_id, p_rsvp_status, p_guest_count, p_notes,
        CASE WHEN v_event.join_policy = 'approval' THEN 'pending' ELSE 'approved' END,
        now(), now()
    )
    ON CONFLICT (event_id, membership_id) DO UPDATE
    SET rsvp_status = EXCLUDED.rsvp_status,
        guest_count = EXCLUDED.guest_count,
        notes = COALESCE(EXCLUDED.notes, public.event_participants.notes),
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'rsvp_status', p_rsvp_status,
        'membership_id', v_membership_id,
        'requires_approval', v_event.join_policy = 'approval'
    );
END;
$$;

-- 4. Fix approve_rsvp to use membership_id
CREATE OR REPLACE FUNCTION public.approve_rsvp(
    p_event_id TEXT,
    p_membership_id TEXT
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

    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND created_by_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    UPDATE public.event_participants
    SET approval_status = 'approved', updated_at = now()
    WHERE event_id = p_event_id AND membership_id = p_membership_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Fix reject_rsvp to use membership_id
CREATE OR REPLACE FUNCTION public.reject_rsvp(
    p_event_id TEXT,
    p_membership_id TEXT
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

    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND created_by_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    UPDATE public.event_participants
    SET approval_status = 'rejected', updated_at = now()
    WHERE event_id = p_event_id AND membership_id = p_membership_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Fix check_in_participant to use membership_id
CREATE OR REPLACE FUNCTION public.check_in_participant(
    p_event_id TEXT,
    p_membership_id TEXT
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

    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND created_by_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    UPDATE public.event_participants
    SET checked_in = true, updated_at = now()
    WHERE event_id = p_event_id AND membership_id = p_membership_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Drop old UUID-based function overloads
DROP FUNCTION IF EXISTS public.approve_rsvp(TEXT, UUID);
DROP FUNCTION IF EXISTS public.reject_rsvp(TEXT, UUID);
DROP FUNCTION IF EXISTS public.check_in_participant(TEXT, UUID);

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.rsvp_event_v2(TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_rsvp(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rsvp(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_participant(TEXT, TEXT) TO authenticated;

COMMIT;
