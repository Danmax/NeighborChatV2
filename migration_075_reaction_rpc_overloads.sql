-- Migration 075: Add RPC overloads for celebration reactions
-- Date: 2026-02-08
-- Description: Provide int/json/jsonb overloads that delegate to text version

BEGIN;

-- int overload
CREATE OR REPLACE FUNCTION public.add_celebration_reaction_v2(
    p_celebration_id TEXT,
    p_emoji_index INT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.add_celebration_reaction_v2(p_celebration_id, p_emoji_index::text);
END;
$$;

-- json overload (accepts {"emoji": "👏"} or "👏" or 3)
CREATE OR REPLACE FUNCTION public.add_celebration_reaction_v2(
    p_celebration_id TEXT,
    p_payload JSON
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_text text;
BEGIN
    IF json_typeof(p_payload) = 'object' THEN
        v_text := (p_payload->>'emoji');
    ELSIF json_typeof(p_payload) = 'string' THEN
        v_text := trim(both '"' from p_payload::text);
    ELSE
        v_text := p_payload::text;
    END IF;
    RETURN public.add_celebration_reaction_v2(p_celebration_id, v_text);
END;
$$;

-- jsonb overload
CREATE OR REPLACE FUNCTION public.add_celebration_reaction_v2(
    p_celebration_id TEXT,
    p_payload JSONB
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_text text;
BEGIN
    IF jsonb_typeof(p_payload) = 'object' THEN
        v_text := (p_payload->>'emoji');
    ELSIF jsonb_typeof(p_payload) = 'string' THEN
        v_text := trim(both '"' from p_payload::text);
    ELSE
        v_text := p_payload::text;
    END IF;
    RETURN public.add_celebration_reaction_v2(p_celebration_id, v_text);
END;
$$;

ALTER FUNCTION public.add_celebration_reaction_v2(TEXT, INT)
SET search_path = public, pg_temp;

ALTER FUNCTION public.add_celebration_reaction_v2(TEXT, JSON)
SET search_path = public, pg_temp;

ALTER FUNCTION public.add_celebration_reaction_v2(TEXT, JSONB)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.add_celebration_reaction_v2(TEXT, INT) FROM public;
REVOKE ALL ON FUNCTION public.add_celebration_reaction_v2(TEXT, JSON) FROM public;
REVOKE ALL ON FUNCTION public.add_celebration_reaction_v2(TEXT, JSONB) FROM public;

GRANT EXECUTE ON FUNCTION public.add_celebration_reaction_v2(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_celebration_reaction_v2(TEXT, JSON) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_celebration_reaction_v2(TEXT, JSONB) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
