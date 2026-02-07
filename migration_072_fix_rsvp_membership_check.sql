-- Migration 072: Fix RSVP membership requirement
-- Date: 2026-02-07
-- Description: Remove strict membership check from RSVP to allow authenticated users to RSVP

BEGIN;

-- Updated RSVP function (uuid-based) - remove membership check
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
    v_user_uuid uuid;
    v_event RECORD;
    v_participant_count INTEGER;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
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
          AND user_id != v_user_uuid;

        IF v_participant_count >= v_event.capacity THEN
            RAISE EXCEPTION 'Event is at capacity';
        END IF;
    END IF;

    INSERT INTO public.event_participants (
        event_id, user_id, rsvp_status, guest_count, notes, approval_status
    ) VALUES (
        p_event_id, v_user_uuid, p_rsvp_status, p_guest_count, p_notes,
        CASE WHEN v_event.join_policy = 'approval' THEN 'pending' ELSE 'approved' END
    )
    ON CONFLICT (event_id, user_id) DO UPDATE
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

COMMIT;

NOTIFY pgrst, 'reload schema';
