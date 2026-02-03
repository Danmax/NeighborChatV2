-- Migration 035: Event manager requests use text user_id
-- Date: 2026-02-02
-- Description: Align event_manager_requests with text user_id and fix approval

BEGIN;

ALTER TABLE public.event_manager_requests
ALTER COLUMN user_id TYPE TEXT USING user_id::text;

DROP FUNCTION IF EXISTS public.review_event_manager_request(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.review_event_manager_request(
    p_request_id UUID,
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
    WHERE id = p_request_id;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    UPDATE public.event_manager_requests
    SET status = p_status,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    WHERE id = p_request_id;

    IF p_status = 'approved' THEN
        UPDATE public.user_profiles
        SET role = 'event_manager'
        WHERE user_id = v_request.user_id;
    END IF;

    RETURN true;
END;
$$;

ALTER FUNCTION public.review_event_manager_request(UUID, TEXT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.review_event_manager_request(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.review_event_manager_request(UUID, TEXT) TO authenticated;

COMMIT;
