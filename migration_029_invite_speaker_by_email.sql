-- Migration 029: Invite speaker by email
-- Date: 2026-02-02
-- Description: Allow organizers to invite speakers by email (creates private speaker profile)

BEGIN;

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

    IF v_event.created_by_id::text != v_user_id::text THEN
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

REVOKE ALL ON FUNCTION public.invite_speaker_by_email(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.invite_speaker_by_email(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

COMMIT;
