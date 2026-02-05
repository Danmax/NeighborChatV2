-- Migration 050: Force event_manager_requests.user_id to TEXT
-- Date: 2026-02-04
-- Description: Drop policies, alter user_id type, recreate policies, reload schema

BEGIN;

-- Drop policies that depend on user_id
DROP POLICY IF EXISTS "event_manager_requests_read_own" ON public.event_manager_requests;
DROP POLICY IF EXISTS "event_manager_requests_insert_own" ON public.event_manager_requests;
DROP POLICY IF EXISTS "event_manager_requests_admin_update" ON public.event_manager_requests;

-- Convert user_id to TEXT
ALTER TABLE public.event_manager_requests
ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- Recreate policies with text-safe comparisons
CREATE POLICY "event_manager_requests_read_own"
ON public.event_manager_requests FOR SELECT
TO authenticated
USING (user_id::text = auth.uid()::text OR public.can_manage_event_access());

CREATE POLICY "event_manager_requests_insert_own"
ON public.event_manager_requests FOR INSERT
TO authenticated
WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "event_manager_requests_admin_update"
ON public.event_manager_requests FOR UPDATE
TO authenticated
USING (public.can_manage_event_access())
WITH CHECK (public.can_manage_event_access());

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
