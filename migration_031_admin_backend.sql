-- Migration 031: Admin backend schema and helpers
-- Date: 2026-02-02
-- Description: Add admin role, settings, option lists, access requests, and metrics RPCs

BEGIN;

-- ============================================
-- USER PROFILES ROLE
-- ============================================
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

UPDATE public.user_profiles
SET role = 'user'
WHERE role IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_role_check'
    ) THEN
        ALTER TABLE public.user_profiles
        ADD CONSTRAINT user_profiles_role_check
        CHECK (role IN ('user', 'admin', 'event_manager'));
    END IF;
END $$;

-- ============================================
-- APP SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- STATUS OPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.status_options (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true
);

-- Seed default status options if empty
INSERT INTO public.status_options (id, label, color, sort_order, active)
SELECT * FROM (VALUES
    ('available', 'Online', '#4CAF50', 1, true),
    ('away', 'Away', '#FFC107', 2, true),
    ('busy', 'Busy', '#F44336', 3, true),
    ('meeting', 'In Meeting', '#9C27B0', 4, true),
    ('offline', 'Offline', '#9E9E9E', 5, true)
) AS v(id, label, color, sort_order, active)
WHERE NOT EXISTS (SELECT 1 FROM public.status_options);

-- ============================================
-- INTEREST OPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.interest_options (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    emoji TEXT,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true
);

-- Seed default interests if empty
INSERT INTO public.interest_options (id, label, emoji, sort_order, active)
SELECT * FROM (VALUES
    ('reading', 'Reading', '📚', 1, true),
    ('cooking', 'Cooking', '👨‍🍳', 2, true),
    ('gardening', 'Gardening', '🌱', 3, true),
    ('fitness', 'Fitness', '🏃', 4, true),
    ('gaming', 'Gaming', '🎮', 5, true),
    ('music', 'Music', '🎵', 6, true),
    ('movies', 'Movies', '🎬', 7, true),
    ('travel', 'Travel', '✈️', 8, true),
    ('pets', 'Pets', '🐕', 9, true),
    ('art', 'Art', '🎨', 10, true),
    ('tech', 'Technology', '💻', 11, true),
    ('sports', 'Sports', '⚽', 12, true),
    ('yoga', 'Yoga', '🧘', 13, true),
    ('photography', 'Photography', '📷', 14, true),
    ('hiking', 'Hiking', '🥾', 15, true),
    ('coffee', 'Coffee', '☕', 16, true)
) AS v(id, label, emoji, sort_order, active)
WHERE NOT EXISTS (SELECT 1 FROM public.interest_options);

-- ============================================
-- EVENT MANAGER ACCESS REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.event_manager_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'event_manager_requests_status_check'
    ) THEN
        ALTER TABLE public.event_manager_requests
        ADD CONSTRAINT event_manager_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_manager_requests_user
ON public.event_manager_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_event_manager_requests_status
ON public.event_manager_requests(status);

DROP TRIGGER IF EXISTS event_manager_requests_updated_at_trigger ON public.event_manager_requests;
CREATE TRIGGER event_manager_requests_updated_at_trigger
    BEFORE UPDATE ON public.event_manager_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ADMIN HELPER (Option A: user_profiles.role)
-- ============================================
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
        WHERE user_id::uuid = v_user_id
          AND role = 'admin'
    ) INTO v_is_admin;

    RETURN COALESCE(v_is_admin, false);
END;
$$;

ALTER FUNCTION public.is_platform_admin()
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- Event access manager (admin + event_manager)
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
        WHERE user_id::uuid = v_user_id
          AND role IN ('admin', 'event_manager')
    ) INTO v_allowed;

    RETURN COALESCE(v_allowed, false);
END;
$$;

ALTER FUNCTION public.can_manage_event_access()
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.can_manage_event_access() FROM public;
GRANT EXECUTE ON FUNCTION public.can_manage_event_access() TO authenticated;

-- ============================================
-- ROLE MANAGEMENT RPCS
-- ============================================
CREATE OR REPLACE FUNCTION public.set_user_role(
    p_user_id UUID,
    p_role TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_role NOT IN ('user', 'admin', 'event_manager') THEN
        RAISE EXCEPTION 'Invalid role';
    END IF;

    UPDATE public.user_profiles
    SET role = p_role
    WHERE user_id::uuid = p_user_id;

    RETURN true;
END;
$$;

ALTER FUNCTION public.set_user_role(UUID, TEXT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.set_user_role(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT) TO authenticated;

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
        WHERE user_id::uuid = v_request.user_id;
    END IF;

    RETURN true;
END;
$$;

ALTER FUNCTION public.review_event_manager_request(UUID, TEXT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.review_event_manager_request(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.review_event_manager_request(UUID, TEXT) TO authenticated;

-- ============================================
-- USAGE METRICS & DB STATUS RPCS
-- ============================================
CREATE OR REPLACE FUNCTION public.get_usage_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_metrics jsonb;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT jsonb_build_object(
        'users', (SELECT count(*) FROM public.user_profiles),
        'events', (SELECT count(*) FROM public.community_events),
        'celebrations', (SELECT count(*) FROM public.celebrations),
        'messages', (SELECT count(*) FROM public.messages),
        'feedback', (SELECT count(*) FROM public.feedback),
        'storage_objects', (SELECT count(*) FROM storage.objects)
    ) INTO v_metrics;

    RETURN v_metrics;
END;
$$;

ALTER FUNCTION public.get_usage_metrics()
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_usage_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.get_usage_metrics() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_database_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status jsonb;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT jsonb_build_object(
        'database', current_database(),
        'version', version(),
        'timestamp', now(),
        'db_size_bytes', pg_database_size(current_database())
    ) INTO v_status;

    RETURN v_status;
END;
$$;

ALTER FUNCTION public.get_database_status()
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_database_status() FROM public;
GRANT EXECUTE ON FUNCTION public.get_database_status() TO authenticated;

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_manager_requests ENABLE ROW LEVEL SECURITY;

-- app_settings
CREATE POLICY "app_settings_read_authenticated"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "app_settings_read_anon"
ON public.app_settings FOR SELECT
TO anon
USING (true);

CREATE POLICY "app_settings_admin_write"
ON public.app_settings FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY "app_settings_admin_update"
ON public.app_settings FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- status_options
CREATE POLICY "status_options_read_authenticated"
ON public.status_options FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "status_options_admin_write"
ON public.status_options FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY "status_options_admin_update"
ON public.status_options FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "status_options_admin_delete"
ON public.status_options FOR DELETE
TO authenticated
USING (public.is_platform_admin());

-- interest_options
CREATE POLICY "interest_options_read_authenticated"
ON public.interest_options FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "interest_options_admin_write"
ON public.interest_options FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY "interest_options_admin_update"
ON public.interest_options FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "interest_options_admin_delete"
ON public.interest_options FOR DELETE
TO authenticated
USING (public.is_platform_admin());

-- event_manager_requests
CREATE POLICY "event_manager_requests_read_own"
ON public.event_manager_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "event_manager_requests_insert_own"
ON public.event_manager_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "event_manager_requests_admin_update"
ON public.event_manager_requests FOR UPDATE
TO authenticated
USING (public.can_manage_event_access())
WITH CHECK (public.can_manage_event_access());

COMMIT;
