-- Migration 074: Make celebration reaction RPC accept emoji or index (robust)
-- Date: 2026-02-08
-- Description: Recreate add_celebration_reaction_v2 with text param to handle legacy clients

BEGIN;

DROP FUNCTION IF EXISTS public.add_celebration_reaction_v2(TEXT, INT);
DROP FUNCTION IF EXISTS public.add_celebration_reaction_v2(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.add_celebration_reaction_v2(TEXT, JSON);
DROP FUNCTION IF EXISTS public.add_celebration_reaction_v2(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.add_celebration_reaction_v2(
    p_celebration_id TEXT,
    p_emoji TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clerk_id text;
    v_user_uuid uuid;
    v_reactions jsonb;
    v_updated jsonb := '{}'::jsonb;
    v_value jsonb;
    v_arr jsonb;
    v_user_text text;
    v_has_reacted boolean := false;
    v_emoji text;
    v_emoji_list text[] := ARRAY['❤️', '🎉', '👏', '🙌', '💯', '🔥', '✨', '💪'];
    v_index int;
BEGIN
    v_clerk_id := auth.jwt() ->> 'sub';
    IF v_clerk_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id INTO v_user_uuid
    FROM public.user_profiles
    WHERE clerk_user_id = v_clerk_id;

    IF v_user_uuid IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    IF p_emoji IS NULL OR btrim(p_emoji) = '' THEN
        RAISE EXCEPTION 'Emoji required';
    END IF;

    IF p_emoji ~ '^[0-9]+$' THEN
        v_index := p_emoji::int;
        IF v_index < 0 OR v_index > 7 THEN
            RAISE EXCEPTION 'Invalid emoji index: must be 0-7';
        END IF;
        v_emoji := v_emoji_list[v_index + 1];
    ELSE
        v_index := array_position(v_emoji_list, p_emoji);
        IF v_index IS NULL THEN
            RAISE EXCEPTION 'Invalid emoji';
        END IF;
        v_emoji := p_emoji;
    END IF;

    SELECT reactions
    INTO v_reactions
    FROM public.celebrations
    WHERE id = p_celebration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Celebration not found';
    END IF;

    v_reactions := COALESCE(v_reactions, '{}'::jsonb);
    v_user_text := v_user_uuid::text;

    FOR v_value IN SELECT * FROM jsonb_each(v_reactions)
    LOOP
        v_arr := COALESCE(v_value.value, '[]'::jsonb);

        IF v_value.key = v_emoji THEN
            IF v_arr ? v_user_text THEN
                v_has_reacted := true;
                v_arr := (SELECT jsonb_agg(value) FROM jsonb_array_elements_text(v_arr) WHERE value <> v_user_text);
            END IF;
        ELSE
            IF v_arr ? v_user_text THEN
                v_arr := (SELECT jsonb_agg(value) FROM jsonb_array_elements_text(v_arr) WHERE value <> v_user_text);
            END IF;
        END IF;

        IF v_arr IS NULL THEN
            v_arr := '[]'::jsonb;
        END IF;

        IF jsonb_array_length(v_arr) > 0 THEN
            v_updated := jsonb_set(v_updated, ARRAY[v_value.key], v_arr, true);
        END IF;
    END LOOP;

    IF NOT v_has_reacted THEN
        v_arr := COALESCE(v_updated -> v_emoji, '[]'::jsonb) || to_jsonb(v_user_text);
        v_updated := jsonb_set(v_updated, ARRAY[v_emoji], v_arr, true);
    END IF;

    UPDATE public.celebrations
    SET reactions = v_updated
    WHERE id = p_celebration_id;

    RETURN v_updated;
END;
$$;

ALTER FUNCTION public.add_celebration_reaction_v2(TEXT, TEXT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.add_celebration_reaction_v2(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.add_celebration_reaction_v2(TEXT, TEXT) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
