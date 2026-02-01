-- Migration 014: Fix instance_memberships RLS recursion
-- Date: 2026-02-01
-- Description: Replace recursive policies with SECURITY DEFINER membership check

BEGIN;

-- Ensure RLS enabled
ALTER TABLE public.instance_memberships ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_instance_member_uid(
    p_user_id uuid,
    p_instance_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists boolean;
BEGIN
    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.instance_memberships
        WHERE user_id = p_user_id
          AND instance_id = p_instance_id
          AND status = 'active'
    )
    INTO v_exists;

    RETURN COALESCE(v_exists, false);
END;
$$;

ALTER FUNCTION public.is_instance_member_uid(uuid, text)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.is_instance_member_uid(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.is_instance_member_uid(uuid, text) TO authenticated;

-- Replace recursive policies
DROP POLICY IF EXISTS "View instance memberships" ON public.instance_memberships;
DROP POLICY IF EXISTS "View instance members" ON public.instance_memberships;
DROP POLICY IF EXISTS "Manage own membership" ON public.instance_memberships;

CREATE POLICY "View own memberships"
ON public.instance_memberships FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "View instance members"
ON public.instance_memberships FOR SELECT
TO authenticated
USING (public.is_instance_member_uid(auth.uid(), instance_id));

CREATE POLICY "Manage own membership"
ON public.instance_memberships FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

COMMIT;
