-- Migration 009: Celebration replies via SECURITY DEFINER RPC
-- Date: 2026-02-01
-- Description: Allow authenticated users to add replies (message + GIF) to celebrations

BEGIN;

CREATE OR REPLACE FUNCTION public.add_celebration_reply(
    p_celebration_id TEXT,
    p_message TEXT,
    p_gif_url TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_profile record;
    v_comment jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF (p_message IS NULL OR btrim(p_message) = '')
       AND (p_gif_url IS NULL OR btrim(p_gif_url) = '') THEN
        RAISE EXCEPTION 'Message or GIF required';
    END IF;

    SELECT display_name, avatar
    INTO v_profile
    FROM public.public_profiles
    WHERE user_id = v_user_id::text
    LIMIT 1;

    v_comment := jsonb_build_object(
        'id', v_user_id::text || '-' || extract(epoch from now())::bigint::text,
        'user_id', v_user_id::text,
        'user_name', COALESCE(v_profile.display_name, 'Neighbor'),
        'user_avatar', v_profile.avatar,
        'message', p_message,
        'gif_url', p_gif_url,
        'created_at', now()
    );

    UPDATE public.celebrations
    SET comments = COALESCE(comments, '[]'::jsonb) || jsonb_build_array(v_comment)
    WHERE id = p_celebration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Celebration not found';
    END IF;

    RETURN v_comment;
END;
$$;

ALTER FUNCTION public.add_celebration_reply(TEXT, TEXT, TEXT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.add_celebration_reply(TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.add_celebration_reply(TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
