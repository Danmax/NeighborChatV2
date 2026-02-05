-- Migration 037: Fix event_manager_requests policies for text user_id
-- Date: 2026-02-02
-- Description: Compare auth.uid() as text to avoid UUID cast errors

BEGIN;

DROP POLICY IF EXISTS "event_manager_requests_read_own" ON public.event_manager_requests;
DROP POLICY IF EXISTS "event_manager_requests_insert_own" ON public.event_manager_requests;
DROP POLICY IF EXISTS "event_manager_requests_admin_update" ON public.event_manager_requests;

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
