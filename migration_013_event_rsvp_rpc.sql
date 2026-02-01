-- Migration 013: RSVP to events via SECURITY DEFINER RPC
-- Date: 2026-02-01
-- Description: Allow authenticated users to join/leave events using instance_memberships

BEGIN;

CREATE OR REPLACE FUNCTION public.rsvp_event(
    p_event_id TEXT,
    p_attending BOOLEAN DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_membership_id text;
    v_event record;
    v_result jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id
    INTO v_membership_id
    FROM public.instance_memberships
    WHERE user_id = v_user_id
      AND status = 'active'
    LIMIT 1;

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'Must join a community before joining events';
    END IF;

    IF p_attending THEN
        INSERT INTO public.event_participants (id, event_id, membership_id, status, role, registered_at)
        VALUES (gen_random_uuid(), p_event_id, v_membership_id, 'registered', 'attendee', now())
        ON CONFLICT (event_id, membership_id) DO NOTHING;
    ELSE
        DELETE FROM public.event_participants
        WHERE event_id = p_event_id
          AND membership_id = v_membership_id;
    END IF;

    SELECT e.*
    INTO v_event
    FROM public.community_events e
    WHERE e.id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    v_result := to_jsonb(v_event);
    RETURN v_result;
END;
$$;

ALTER FUNCTION public.rsvp_event(TEXT, BOOLEAN)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.rsvp_event(TEXT, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.rsvp_event(TEXT, BOOLEAN) TO authenticated;

COMMIT;
