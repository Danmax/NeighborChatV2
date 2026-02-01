-- Migration 010: Celebration reactions via SECURITY DEFINER RPC
-- Date: 2026-02-01
-- Description: Allow authenticated users to add/toggle a single reaction on celebrations

BEGIN;

CREATE OR REPLACE FUNCTION public.add_celebration_reaction(
    p_celebration_id TEXT,
    p_emoji TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_reactions jsonb;
    v_updated jsonb := '{}'::jsonb;
    v_value jsonb;
    v_arr jsonb;
    v_user_text text;
    v_has_reacted boolean := false;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_emoji IS NULL OR btrim(p_emoji) = '' THEN
        RAISE EXCEPTION 'Emoji required';
    END IF;

    SELECT reactions
    INTO v_reactions
    FROM public.celebrations
    WHERE id = p_celebration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Celebration not found';
    END IF;

    v_reactions := COALESCE(v_reactions, '{}'::jsonb);
    v_user_text := v_user_id::text;

    FOR v_value IN SELECT * FROM jsonb_each(v_reactions)
    LOOP
        v_arr := COALESCE(v_value.value, '[]'::jsonb);

        IF v_value.key = p_emoji THEN
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

        v_updated := jsonb_set(v_updated, ARRAY[v_value.key], v_arr, true);
    END LOOP;

    IF NOT v_has_reacted THEN
        v_arr := COALESCE(v_updated -> p_emoji, '[]'::jsonb) || to_jsonb(v_user_text);
        v_updated := jsonb_set(v_updated, ARRAY[p_emoji], v_arr, true);
    END IF;

    UPDATE public.celebrations
    SET reactions = v_updated
    WHERE id = p_celebration_id;

    RETURN v_updated;
END;
$$;

ALTER FUNCTION public.add_celebration_reaction(TEXT, TEXT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.add_celebration_reaction(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.add_celebration_reaction(TEXT, TEXT) TO authenticated;

COMMIT;
