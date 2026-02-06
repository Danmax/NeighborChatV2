-- Migration 071: Admin feedback update RPC (bypass RLS safely)
-- Date: 2026-02-06
-- Description: Provide SECURITY DEFINER function for admin feedback review

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_update_feedback(
    p_id uuid,
    p_status text,
    p_resolution_note text DEFAULT NULL
)
RETURNS public.feedback
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_note text := NULLIF(btrim(p_resolution_note), '');
    v_row public.feedback;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE public.feedback
    SET status = p_status,
        updated_at = now(),
        metadata = CASE
            WHEN v_note IS NULL THEN COALESCE(metadata, '{}'::jsonb)
            ELSE jsonb_set(
                jsonb_set(COALESCE(metadata, '{}'::jsonb), '{resolution_note}', to_jsonb(v_note), true),
                '{resolved_at}',
                to_jsonb(now()),
                true
            )
        END
    WHERE id = p_id
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Feedback not found';
    END IF;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_feedback(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_feedback(uuid, text, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
