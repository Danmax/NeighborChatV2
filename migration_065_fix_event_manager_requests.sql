-- Migration 065: Fix event_manager_requests for Clerk UUIDs
-- Date: 2026-02-06
-- Description: Align reviewed_by/user_id with user_profiles.id and update policies/RPC

BEGIN;

-- Ensure reviewed_by is uuid and FK points to user_profiles(id)
ALTER TABLE public.event_manager_requests
DROP CONSTRAINT IF EXISTS event_manager_requests_reviewed_by_fkey;

ALTER TABLE public.event_manager_requests
ALTER COLUMN reviewed_by TYPE uuid USING reviewed_by::uuid;

ALTER TABLE public.event_manager_requests
ADD CONSTRAINT event_manager_requests_reviewed_by_fkey
FOREIGN KEY (reviewed_by) REFERENCES public.user_profiles(id);

-- Ensure user_id FK points to user_profiles(id)
ALTER TABLE public.event_manager_requests
DROP CONSTRAINT IF EXISTS event_manager_requests_user_id_fkey;

ALTER TABLE public.event_manager_requests
ADD CONSTRAINT event_manager_requests_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);

-- Policies (uuid-based)
DROP POLICY IF EXISTS "event_manager_requests_read_own" ON public.event_manager_requests;
DROP POLICY IF EXISTS "event_manager_requests_insert_own" ON public.event_manager_requests;
DROP POLICY IF EXISTS "event_manager_requests_admin_update" ON public.event_manager_requests;

CREATE POLICY event_manager_requests_read_own
ON public.event_manager_requests FOR SELECT
TO authenticated
USING (user_id = public.current_user_uuid() OR public.can_manage_event_access());

CREATE POLICY event_manager_requests_insert_own
ON public.event_manager_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY event_manager_requests_admin_update
ON public.event_manager_requests FOR UPDATE
TO authenticated
USING (public.can_manage_event_access())
WITH CHECK (public.can_manage_event_access());

-- RPC: review request (uuid-based)
CREATE OR REPLACE FUNCTION public.review_event_manager_request(
    p_request_id TEXT,
    p_status TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
        reviewed_by = public.current_user_uuid(),
        reviewed_at = now()
    WHERE id = v_request.id;

    IF p_status = 'approved' THEN
        UPDATE public.user_profiles
        SET role = 'event_manager'
        WHERE id = v_request.user_id;
    END IF;

    RETURN true;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
