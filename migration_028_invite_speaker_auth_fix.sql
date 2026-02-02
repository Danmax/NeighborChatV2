-- Migration 028: Fix invite_speaker auth comparison for TEXT/UUID
-- Date: 2026-02-02
-- Description: Ensure organizer check works when created_by_id stored as TEXT

BEGIN;

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
    WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.created_by_id::text != v_user_id::text THEN
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
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_invites JSONB;
    v_invite JSONB;
    v_invite_index INTEGER;
    v_speaker_id TEXT;
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
    v_speaker_id := v_invite->>'speaker_id';

    IF v_event.created_by_id::text != v_user_id::text THEN
        IF NOT EXISTS (SELECT 1 FROM public.speakers WHERE id::text = v_speaker_id AND created_by_id::text = v_user_id::text) THEN
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

GRANT EXECUTE ON FUNCTION public.invite_speaker(TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_speaker_invite_status(TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
