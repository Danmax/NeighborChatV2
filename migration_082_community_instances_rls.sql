-- Migration 082: Community instances RLS policies
-- Date: 2026-02-10
-- Description: Allow authenticated users to create communities they administer,
-- and allow admins/moderators to manage their communities.

BEGIN;

ALTER TABLE public.community_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_instances_select ON public.community_instances;
CREATE POLICY community_instances_select
ON public.community_instances FOR SELECT
TO authenticated
USING (
    is_public = true
    OR public.is_platform_admin()
    OR EXISTS (
        SELECT 1
        FROM public.instance_memberships im
        WHERE im.instance_id = community_instances.id
          AND im.user_id = public.current_user_uuid()
          AND im.status = 'active'
    )
    OR admin_ids ? COALESCE(public.current_user_uuid()::text, '')
    OR moderator_ids ? COALESCE(public.current_user_uuid()::text, '')
);

DROP POLICY IF EXISTS community_instances_insert ON public.community_instances;
CREATE POLICY community_instances_insert
ON public.community_instances FOR INSERT
TO authenticated
WITH CHECK (
    public.is_platform_admin()
    OR admin_ids ? COALESCE(public.current_user_uuid()::text, '')
);

DROP POLICY IF EXISTS community_instances_update ON public.community_instances;
CREATE POLICY community_instances_update
ON public.community_instances FOR UPDATE
TO authenticated
USING (
    public.is_platform_admin()
    OR admin_ids ? COALESCE(public.current_user_uuid()::text, '')
    OR moderator_ids ? COALESCE(public.current_user_uuid()::text, '')
)
WITH CHECK (
    public.is_platform_admin()
    OR admin_ids ? COALESCE(public.current_user_uuid()::text, '')
);

DROP POLICY IF EXISTS community_instances_delete ON public.community_instances;
CREATE POLICY community_instances_delete
ON public.community_instances FOR DELETE
TO authenticated
USING (
    public.is_platform_admin()
    OR admin_ids ? COALESCE(public.current_user_uuid()::text, '')
);

COMMIT;

NOTIFY pgrst, 'reload schema';
