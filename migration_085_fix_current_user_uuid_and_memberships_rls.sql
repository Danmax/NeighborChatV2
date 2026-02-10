-- Migration 085: Fix current_user_uuid + instance_memberships RLS for game participation
-- Date: 2026-02-10
-- Description: Prevent user_profiles RLS recursion and allow instance members to read members in their community.

BEGIN;

-- ============================================================================
-- Harden current_user_uuid helper to avoid user_profiles RLS side effects
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clerk_id text;
    v_user_id uuid;
BEGIN
    v_clerk_id := public.current_user_id();
    IF v_clerk_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Ensure profile lookup/creation works even when called from RLS expressions.
    PERFORM set_config('row_security', 'off', true);

    SELECT id INTO v_user_id
    FROM public.user_profiles
    WHERE clerk_user_id = v_clerk_id
    LIMIT 1;

    IF v_user_id IS NULL THEN
        INSERT INTO public.user_profiles (clerk_user_id, created_at, updated_at)
        VALUES (v_clerk_id, now(), now())
        ON CONFLICT (clerk_user_id) DO UPDATE
        SET updated_at = EXCLUDED.updated_at
        RETURNING id INTO v_user_id;
    END IF;

    RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_uuid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT public.ensure_current_user_profile();
$$;

-- ============================================================================
-- instance_memberships RLS: members can read other members in same instance
-- ============================================================================

ALTER TABLE public.instance_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instance_memberships_select_self ON public.instance_memberships;
DROP POLICY IF EXISTS instance_memberships_modify_self ON public.instance_memberships;
DROP POLICY IF EXISTS instance_memberships_select_instance_members ON public.instance_memberships;
DROP POLICY IF EXISTS instance_memberships_insert_self ON public.instance_memberships;
DROP POLICY IF EXISTS instance_memberships_update_self ON public.instance_memberships;
DROP POLICY IF EXISTS instance_memberships_delete_self ON public.instance_memberships;

CREATE POLICY instance_memberships_select_instance_members
ON public.instance_memberships FOR SELECT
TO authenticated
USING (
    user_id = public.current_user_uuid()
    OR public.is_instance_member(instance_id)
    OR public.is_platform_admin()
);

CREATE POLICY instance_memberships_insert_self
ON public.instance_memberships FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY instance_memberships_update_self
ON public.instance_memberships FOR UPDATE
TO authenticated
USING (user_id = public.current_user_uuid())
WITH CHECK (user_id = public.current_user_uuid());

CREATE POLICY instance_memberships_delete_self
ON public.instance_memberships FOR DELETE
TO authenticated
USING (user_id = public.current_user_uuid());

COMMIT;

NOTIFY pgrst, 'reload schema';
