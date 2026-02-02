-- Migration 022: Event participants use TEXT event_id + RPC updates
-- Date: 2026-02-01
-- Description: Align event_participants.event_id with text-based community_events.id

BEGIN;

-- Drop existing FK if it exists (name may vary)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.event_participants'::regclass
          AND contype = 'f'
          AND conname = 'event_participants_event_id_fkey'
    ) THEN
        ALTER TABLE public.event_participants
        DROP CONSTRAINT event_participants_event_id_fkey;
    END IF;
END $$;

-- Convert event_id to TEXT to match community_events.id
ALTER TABLE public.event_participants
ALTER COLUMN event_id TYPE TEXT
USING event_id::text;

-- Recreate FK to community_events(id) if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.event_participants'::regclass
          AND contype = 'f'
          AND conname = 'event_participants_event_id_fkey'
    ) THEN
        ALTER TABLE public.event_participants
        ADD CONSTRAINT event_participants_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.community_events(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Update enhanced RPCs to accept TEXT event IDs
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
    v_event RECORD;
    v_existing RECORD;
    v_participant_count INTEGER;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
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
        AND user_id != v_user_id;

        IF v_participant_count >= v_event.capacity THEN
            RAISE EXCEPTION 'Event is at capacity';
        END IF;
    END IF;

    SELECT * INTO v_existing
    FROM public.event_participants
    WHERE event_id = p_event_id AND user_id = v_user_id;

    IF v_existing IS NOT NULL THEN
        UPDATE public.event_participants
        SET rsvp_status = p_rsvp_status,
            guest_count = p_guest_count,
            notes = COALESCE(p_notes, notes),
            updated_at = now()
        WHERE event_id = p_event_id AND user_id = v_user_id;
    ELSE
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

CREATE OR REPLACE FUNCTION public.approve_rsvp(
    p_event_id TEXT,
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

    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND created_by_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    UPDATE public.event_participants
    SET approval_status = 'approved', updated_at = now()
    WHERE event_id = p_event_id AND user_id = p_participant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_rsvp(
    p_event_id TEXT,
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

    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND created_by_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    UPDATE public.event_participants
    SET approval_status = 'rejected', updated_at = now()
    WHERE event_id = p_event_id AND user_id = p_participant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_in_participant(
    p_event_id TEXT,
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

    SELECT * INTO v_event FROM public.community_events
    WHERE id = p_event_id AND created_by_id = v_user_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Not authorized - must be event organizer';
    END IF;

    UPDATE public.event_participants
    SET checked_in = true, updated_at = now()
    WHERE event_id = p_event_id AND user_id = p_participant_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rsvp_event_v2(TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_rsvp(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rsvp(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_participant(TEXT, UUID) TO authenticated;

COMMIT;
