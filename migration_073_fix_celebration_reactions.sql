-- Migration 073: Fix celebration reactions with emoji index approach
-- Date: 2026-02-08
-- Description: Replace emoji-based RPC with index-based to avoid JSON encoding issues

BEGIN;

-- Drop the old function
DROP FUNCTION IF EXISTS public.add_celebration_reaction(TEXT, TEXT);

-- Create new function that accepts emoji index instead of raw emoji
CREATE OR REPLACE FUNCTION public.add_celebration_reaction_v2(
    p_celebration_id TEXT,
    p_emoji_index INT
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
BEGIN
    -- Get the Clerk user ID from JWT (auth.uid() returns Clerk ID as text)
    v_clerk_id := auth.jwt() ->> 'sub';
    IF v_clerk_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Look up the user's UUID from user_profiles
    SELECT id INTO v_user_uuid
    FROM public.user_profiles
    WHERE clerk_user_id = v_clerk_id;

    IF v_user_uuid IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    -- Validate emoji index (0-7)
    IF p_emoji_index < 0 OR p_emoji_index > 7 THEN
        RAISE EXCEPTION 'Invalid emoji index: must be 0-7';
    END IF;

    -- Get emoji from array (1-indexed in PostgreSQL)
    v_emoji := v_emoji_list[p_emoji_index + 1];

    SELECT reactions
    INTO v_reactions
    FROM public.celebrations
    WHERE id = p_celebration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Celebration not found';
    END IF;

    v_reactions := COALESCE(v_reactions, '{}'::jsonb);
    v_user_text := v_user_uuid::text;

    -- Process existing reactions
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

ALTER FUNCTION public.add_celebration_reaction_v2(TEXT, INT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.add_celebration_reaction_v2(TEXT, INT) FROM public;
GRANT EXECUTE ON FUNCTION public.add_celebration_reaction_v2(TEXT, INT) TO authenticated;

COMMIT;
