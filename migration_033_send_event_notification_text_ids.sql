-- Migration 033: Update send_event_notification to use TEXT ids
-- Date: 2026-02-02
-- Description: Align notification RPC with text-based membership ids

BEGIN;

CREATE OR REPLACE FUNCTION public.send_event_notification(
    p_event_id TEXT,
    p_message TEXT,
    p_user_ids TEXT[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_event record;
    v_targets text[];
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

    IF v_event.created_by_id::text <> v_user_id::text THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    IF p_user_ids IS NULL THEN
        SELECT array_agg(membership_id)
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

ALTER FUNCTION public.send_event_notification(TEXT, TEXT, TEXT[])
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.send_event_notification(TEXT, TEXT, TEXT[]) FROM public;
GRANT EXECUTE ON FUNCTION public.send_event_notification(TEXT, TEXT, TEXT[]) TO authenticated;

DROP FUNCTION IF EXISTS public.send_event_notification(TEXT, TEXT, UUID[]);

COMMIT;
