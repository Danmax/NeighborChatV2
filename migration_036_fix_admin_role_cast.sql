-- Migration 036: Fix admin role helpers for text user_id
-- Date: 2026-02-02
-- Description: Avoid UUID casts when user_id contains guest_* ids

BEGIN;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_id = v_user_id::text
          AND role = 'admin'
    ) INTO v_is_admin;

    RETURN COALESCE(v_is_admin, false);
END;
$$;

ALTER FUNCTION public.is_platform_admin()
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_event_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_allowed boolean;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE user_id = v_user_id::text
          AND role IN ('admin', 'event_manager')
    ) INTO v_allowed;

    RETURN COALESCE(v_allowed, false);
END;
$$;

ALTER FUNCTION public.can_manage_event_access()
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.can_manage_event_access() FROM public;
GRANT EXECUTE ON FUNCTION public.can_manage_event_access() TO authenticated;

COMMIT;
