-- Migration 041: Event attendee group chat
-- Date: 2026-02-04
-- Description: Add event chat messages with RLS for attendees + organizers

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    membership_id text,
    body text NOT NULL,
    message_type text NOT NULL DEFAULT 'text',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_chat_messages_event_id_idx
ON public.event_chat_messages(event_id, created_at);

ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_event_chat(p_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.community_events e
        WHERE e.id = p_event_id
          AND e.created_by_id::text = v_user_id::text
    ) THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.event_participants ep
        JOIN public.instance_memberships im
            ON im.id = ep.membership_id
        WHERE ep.event_id = p_event_id
          AND im.user_id = v_user_id
          AND im.status = 'active'
          AND ep.approval_status IN ('approved', 'pending')
    );
END;
$$;

ALTER FUNCTION public.can_access_event_chat(text)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.can_access_event_chat(text) FROM public;
GRANT EXECUTE ON FUNCTION public.can_access_event_chat(text) TO authenticated;

DROP POLICY IF EXISTS "event_chat_select" ON public.event_chat_messages;
DROP POLICY IF EXISTS "event_chat_insert" ON public.event_chat_messages;
DROP POLICY IF EXISTS "event_chat_update_own" ON public.event_chat_messages;
DROP POLICY IF EXISTS "event_chat_delete_own" ON public.event_chat_messages;

CREATE POLICY "event_chat_select"
ON public.event_chat_messages FOR SELECT
TO authenticated
USING (public.can_access_event_chat(event_id));

CREATE POLICY "event_chat_insert"
ON public.event_chat_messages FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_event_chat(event_id)
);

CREATE POLICY "event_chat_update_own"
ON public.event_chat_messages FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "event_chat_delete_own"
ON public.event_chat_messages FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.add_event_chat_message(
    p_event_id text,
    p_body text,
    p_message_type text DEFAULT 'text',
    p_gif_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_membership_id text;
    v_inserted record;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_body IS NULL OR btrim(p_body) = '' THEN
        RAISE EXCEPTION 'Message required';
    END IF;

    IF NOT public.can_access_event_chat(p_event_id) THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    SELECT id INTO v_membership_id
    FROM public.instance_memberships
    WHERE user_id = v_user_id
      AND status = 'active'
    LIMIT 1;

    INSERT INTO public.event_chat_messages (
        event_id,
        user_id,
        membership_id,
        body,
        message_type,
        metadata
    )
    VALUES (
        p_event_id,
        v_user_id,
        v_membership_id,
        p_body,
        COALESCE(p_message_type, 'text'),
        CASE
            WHEN p_gif_url IS NOT NULL AND btrim(p_gif_url) <> ''
                THEN jsonb_build_object('gif_url', p_gif_url)
            ELSE '{}'::jsonb
        END
    )
    RETURNING * INTO v_inserted;

    RETURN to_jsonb(v_inserted);
END;
$$;

ALTER FUNCTION public.add_event_chat_message(text, text, text, text)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.add_event_chat_message(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.add_event_chat_message(text, text, text, text) TO authenticated;

COMMIT;
