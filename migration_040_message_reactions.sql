-- Migration 040: Message reactions table + RPC
-- Date: 2026-02-04
-- Description: Add reactions for direct messages with toggle RPC

BEGIN;

CREATE TABLE IF NOT EXISTS public.message_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_unique
ON public.message_reactions(message_id, user_id);

CREATE INDEX IF NOT EXISTS message_reactions_message_id_idx
ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_reactions_select" ON public.message_reactions;
DROP POLICY IF EXISTS "message_reactions_insert" ON public.message_reactions;
DROP POLICY IF EXISTS "message_reactions_update" ON public.message_reactions;
DROP POLICY IF EXISTS "message_reactions_delete" ON public.message_reactions;

CREATE POLICY "message_reactions_select"
ON public.message_reactions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = message_reactions.message_id
          AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
);

CREATE POLICY "message_reactions_insert"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = message_reactions.message_id
          AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
);

CREATE POLICY "message_reactions_update"
ON public.message_reactions FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "message_reactions_delete"
ON public.message_reactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.add_message_reaction(
    p_message_id uuid,
    p_emoji text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_existing record;
    v_reactions jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_emoji IS NULL OR btrim(p_emoji) = '' THEN
        RAISE EXCEPTION 'Emoji required';
    END IF;

    SELECT * INTO v_existing
    FROM public.message_reactions
    WHERE message_id = p_message_id
      AND user_id = v_user_id;

    IF FOUND THEN
        IF v_existing.emoji = p_emoji THEN
            DELETE FROM public.message_reactions
            WHERE message_id = p_message_id
              AND user_id = v_user_id;
        ELSE
            UPDATE public.message_reactions
            SET emoji = p_emoji,
                updated_at = now()
            WHERE message_id = p_message_id
              AND user_id = v_user_id;
        END IF;
    ELSE
        INSERT INTO public.message_reactions (message_id, user_id, emoji)
        VALUES (p_message_id, v_user_id, p_emoji);
    END IF;

    SELECT COALESCE(
        jsonb_object_agg(emoji, users),
        '{}'::jsonb
    ) INTO v_reactions
    FROM (
        SELECT emoji, jsonb_agg(user_id::text) AS users
        FROM public.message_reactions
        WHERE message_id = p_message_id
        GROUP BY emoji
    ) s;

    RETURN v_reactions;
END;
$$;

ALTER FUNCTION public.add_message_reaction(uuid, text)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.add_message_reaction(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.add_message_reaction(uuid, text) TO authenticated;

COMMIT;
