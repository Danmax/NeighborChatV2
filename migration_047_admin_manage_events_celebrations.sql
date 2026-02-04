-- Migration 047: Admin manage events and celebrations
-- Date: 2026-02-04
-- Description: Allow platform admins to manage community events and celebrations

BEGIN;

ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celebrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_events_select" ON public.community_events;
DROP POLICY IF EXISTS "admin_events_insert" ON public.community_events;
DROP POLICY IF EXISTS "admin_events_update" ON public.community_events;
DROP POLICY IF EXISTS "admin_events_delete" ON public.community_events;

CREATE POLICY "admin_events_select"
ON public.community_events FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "admin_events_insert"
ON public.community_events FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY "admin_events_update"
ON public.community_events FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "admin_events_delete"
ON public.community_events FOR DELETE
TO authenticated
USING (public.is_platform_admin());

DROP POLICY IF EXISTS "admin_celebrations_select" ON public.celebrations;
DROP POLICY IF EXISTS "admin_celebrations_insert" ON public.celebrations;
DROP POLICY IF EXISTS "admin_celebrations_update" ON public.celebrations;
DROP POLICY IF EXISTS "admin_celebrations_delete" ON public.celebrations;

CREATE POLICY "admin_celebrations_select"
ON public.celebrations FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "admin_celebrations_insert"
ON public.celebrations FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY "admin_celebrations_update"
ON public.celebrations FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "admin_celebrations_delete"
ON public.celebrations FOR DELETE
TO authenticated
USING (public.is_platform_admin());

COMMIT;
