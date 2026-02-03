-- Migration 038: Accept TEXT ids in review_event_manager_request
-- Date: 2026-02-02
-- Description: Avoid UUID casting for guest IDs

BEGIN;

DROP FUNCTION IF EXISTS public.review_event_manager_request(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.review_event_manager_request(
    p_request_id TEXT,
    p_status TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request RECORD;
BEGIN
    IF NOT public.can_manage_event_access() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    SELECT * INTO v_request
    FROM public.event_manager_requests
    WHERE id::text = p_request_id;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    UPDATE public.event_manager_requests
    SET status = p_status,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE id = v_request.id;

    IF p_status = 'approved' THEN
        UPDATE public.user_profiles
        SET role = 'event_manager'
        WHERE user_id = v_request.user_id;
    END IF;

    RETURN true;
END;
$$;

ALTER FUNCTION public.review_event_manager_request(TEXT, TEXT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.review_event_manager_request(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.review_event_manager_request(TEXT, TEXT) TO authenticated;

COMMIT;
