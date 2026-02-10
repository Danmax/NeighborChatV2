-- Migration 079: Game Roles, Locations, and Highlights
-- Date: 2026-02-09
-- Description: Add role management (Game Manager, Team Lead, Referee), locations, and highlights system

BEGIN;

-- ============================================================================
-- TABLES: Role Management
-- ============================================================================

-- Table: game_role_requests (follows event_manager_requests pattern)
CREATE TABLE IF NOT EXISTS public.game_role_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    instance_id text NOT NULL REFERENCES public.community_instances(id) ON DELETE CASCADE,
    requested_role text NOT NULL CHECK (requested_role IN ('game_manager', 'team_lead', 'referee')),
    reason text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at timestamptz DEFAULT now(),
    reviewed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_active_game_role_request UNIQUE (user_id, instance_id, requested_role, status)
);

CREATE INDEX IF NOT EXISTS idx_game_role_requests_user ON public.game_role_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_game_role_requests_instance ON public.game_role_requests(instance_id);
CREATE INDEX IF NOT EXISTS idx_game_role_requests_status ON public.game_role_requests(status);

-- Table: game_roles (active role assignments)
CREATE TABLE IF NOT EXISTS public.game_roles (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    instance_id text NOT NULL REFERENCES public.community_instances(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('game_manager', 'team_lead', 'referee')),
    granted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    granted_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_user_game_role_instance UNIQUE (user_id, instance_id, role)
);

CREATE INDEX IF NOT EXISTS idx_game_roles_user ON public.game_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_game_roles_instance ON public.game_roles(instance_id);
CREATE INDEX IF NOT EXISTS idx_game_roles_active ON public.game_roles(is_active) WHERE is_active = true;

-- ============================================================================
-- TABLES: Locations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_locations (
    id text PRIMARY KEY,
    instance_id text NOT NULL REFERENCES public.community_instances(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    address text,
    coordinates jsonb, -- {"lat": 0.0, "lng": 0.0}
    venue_type text DEFAULT 'office' CHECK (venue_type IN ('office', 'park', 'gym', 'conference_room', 'outdoor', 'other')),
    capacity integer,
    amenities jsonb DEFAULT '[]'::jsonb, -- ["parking", "wifi", "food", "restrooms"]
    image_url text,
    is_active boolean DEFAULT true,
    created_by_membership_id text REFERENCES public.instance_memberships(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_locations_instance ON public.game_locations(instance_id);
CREATE INDEX IF NOT EXISTS idx_game_locations_active ON public.game_locations(is_active) WHERE is_active = true;

-- Add location_id to game_sessions
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS location_id text REFERENCES public.game_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_game_sessions_location ON public.game_sessions(location_id);

-- ============================================================================
-- TABLES: Highlights
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_highlights (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    membership_id text REFERENCES public.instance_memberships(id) ON DELETE SET NULL,
    team_id text REFERENCES public.game_teams(id) ON DELETE SET NULL,
    highlight_type text NOT NULL CHECK (highlight_type IN
        ('play_of_the_game', 'clutch_moment', 'comeback', 'milestone', 'funny_moment', 'sportsmanship', 'upset', 'record_breaking')),
    title text NOT NULL,
    description text,
    media_url text,
    media_type text CHECK (media_type IN ('image', 'video', 'gif')),
    timestamp_in_game integer, -- seconds from game start
    reactions jsonb DEFAULT '{"likes": 0, "loves": 0, "fire": 0, "clap": 0}'::jsonb,
    is_featured boolean DEFAULT false,
    created_by_membership_id text NOT NULL REFERENCES public.instance_memberships(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_highlights_session ON public.game_highlights(session_id);
CREATE INDEX IF NOT EXISTS idx_game_highlights_type ON public.game_highlights(highlight_type);
CREATE INDEX IF NOT EXISTS idx_game_highlights_featured ON public.game_highlights(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_game_highlights_created_at ON public.game_highlights(created_at DESC);

-- ============================================================================
-- SECURITY FUNCTIONS
-- ============================================================================

-- Function: Check if user has specific game role
CREATE OR REPLACE FUNCTION public.has_game_role(p_instance_id text, p_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid uuid;
    v_has_role boolean;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RETURN false;
    END IF;

    -- Disable RLS for internal query
    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.game_roles gr
        WHERE gr.user_id = v_user_uuid
          AND gr.instance_id = p_instance_id
          AND gr.role = p_role
          AND gr.is_active = true
          AND (gr.expires_at IS NULL OR gr.expires_at > now())
    ) INTO v_has_role;

    RETURN COALESCE(v_has_role, false);
END;
$$;

-- Function: Check if user is game manager (admin/moderator OR has game_manager role)
CREATE OR REPLACE FUNCTION public.is_game_manager(p_instance_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid uuid;
    v_is_manager boolean;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RETURN false;
    END IF;

    -- Disable RLS for internal query
    PERFORM set_config('row_security', 'off', true);

    -- Check if user is instance admin/moderator OR has game_manager role
    SELECT EXISTS (
        SELECT 1
        FROM public.instance_memberships im
        WHERE im.user_id = v_user_uuid
          AND im.instance_id = p_instance_id
          AND im.role IN ('admin', 'moderator')
          AND im.status = 'active'
    ) OR EXISTS (
        SELECT 1
        FROM public.game_roles gr
        WHERE gr.user_id = v_user_uuid
          AND gr.instance_id = p_instance_id
          AND gr.role = 'game_manager'
          AND gr.is_active = true
          AND (gr.expires_at IS NULL OR gr.expires_at > now())
    ) INTO v_is_manager;

    RETURN COALESCE(v_is_manager, false);
END;
$$;

-- Function: Check if user is referee for session
CREATE OR REPLACE FUNCTION public.is_session_referee(p_session_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid uuid;
    v_is_referee boolean;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RETURN false;
    END IF;

    -- Disable RLS for internal query
    PERFORM set_config('row_security', 'off', true);

    -- Will be implemented in migration_080 with game_referees table
    -- For now, return false
    RETURN false;
END;
$$;

-- Function: Check if user can manage session (host, referee, or game manager)
CREATE OR REPLACE FUNCTION public.can_manage_game_session(p_session_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid uuid;
    v_session RECORD;
    v_can_manage boolean;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RETURN false;
    END IF;

    -- Disable RLS for internal query
    PERFORM set_config('row_security', 'off', true);

    SELECT gs.host_membership_id, gs.instance_id
    INTO v_session
    FROM public.game_sessions gs
    WHERE gs.id = p_session_id;

    IF v_session IS NULL THEN
        RETURN false;
    END IF;

    -- Check if session host
    IF EXISTS (
        SELECT 1
        FROM public.instance_memberships im
        WHERE im.id = v_session.host_membership_id
          AND im.user_id = v_user_uuid
    ) THEN
        RETURN true;
    END IF;

    -- Check if game manager or referee
    RETURN public.is_game_manager(v_session.instance_id)
           OR public.is_session_referee(p_session_id);
END;
$$;

-- Function: Request game role
CREATE OR REPLACE FUNCTION public.request_game_role(
    p_instance_id text,
    p_role text,
    p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid uuid;
    v_request_id uuid;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_role NOT IN ('game_manager', 'team_lead', 'referee') THEN
        RAISE EXCEPTION 'Invalid role requested';
    END IF;

    -- Check if already has role
    IF public.has_game_role(p_instance_id, p_role) THEN
        RAISE EXCEPTION 'You already have this role';
    END IF;

    -- Disable RLS for internal operations
    PERFORM set_config('row_security', 'off', true);

    -- Insert request
    INSERT INTO public.game_role_requests (user_id, instance_id, requested_role, reason)
    VALUES (v_user_uuid, p_instance_id, p_role, p_reason)
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

-- Function: Review game role request (admin/moderator only)
CREATE OR REPLACE FUNCTION public.review_game_role_request(
    p_request_id uuid,
    p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid uuid;
    v_request RECORD;
    v_role_id text;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    -- Disable RLS for internal operations
    PERFORM set_config('row_security', 'off', true);

    -- Get request details
    SELECT * INTO v_request
    FROM public.game_role_requests
    WHERE id = p_request_id;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    -- Check if user is admin/moderator for this instance
    IF NOT EXISTS (
        SELECT 1
        FROM public.instance_memberships
        WHERE user_id = v_user_uuid
          AND instance_id = v_request.instance_id
          AND role IN ('admin', 'moderator')
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Not authorized to review game role requests';
    END IF;

    -- Update request status
    UPDATE public.game_role_requests
    SET status = p_status,
        reviewed_by = v_user_uuid,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = p_request_id;

    -- If approved, grant role
    IF p_status = 'approved' THEN
        v_role_id := 'gr_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);

        INSERT INTO public.game_roles (id, user_id, instance_id, role, granted_by)
        VALUES (
            v_role_id,
            v_request.user_id,
            v_request.instance_id,
            v_request.requested_role,
            v_user_uuid
        )
        ON CONFLICT (user_id, instance_id, role)
        DO UPDATE SET
            is_active = true,
            granted_at = now(),
            granted_by = v_user_uuid,
            updated_at = now();
    END IF;

    RETURN true;
END;
$$;

-- ============================================================================
-- RLS POLICIES: game_role_requests
-- ============================================================================

ALTER TABLE public.game_role_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_role_requests_select" ON public.game_role_requests;
CREATE POLICY "game_role_requests_select"
ON public.game_role_requests FOR SELECT
TO authenticated
USING (
    user_id = public.current_user_uuid()
    OR EXISTS (
        SELECT 1 FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND instance_id = game_role_requests.instance_id
          AND role IN ('admin', 'moderator')
          AND status = 'active'
    )
);

DROP POLICY IF EXISTS "game_role_requests_insert" ON public.game_role_requests;
CREATE POLICY "game_role_requests_insert"
ON public.game_role_requests FOR INSERT
TO authenticated
WITH CHECK (
    user_id = public.current_user_uuid()
    AND is_instance_member(instance_id)
);

-- ============================================================================
-- RLS POLICIES: game_roles
-- ============================================================================

ALTER TABLE public.game_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_roles_select" ON public.game_roles;
CREATE POLICY "game_roles_select"
ON public.game_roles FOR SELECT
TO authenticated
USING (
    user_id = public.current_user_uuid()
    OR is_instance_member(instance_id)
);

-- ============================================================================
-- RLS POLICIES: game_locations
-- ============================================================================

ALTER TABLE public.game_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_locations_select" ON public.game_locations;
CREATE POLICY "game_locations_select"
ON public.game_locations FOR SELECT
TO authenticated
USING (is_instance_member(instance_id));

DROP POLICY IF EXISTS "game_locations_insert" ON public.game_locations;
CREATE POLICY "game_locations_insert"
ON public.game_locations FOR INSERT
TO authenticated
WITH CHECK (
    instance_id IS NOT NULL
    AND public.is_game_manager(instance_id)
);

DROP POLICY IF EXISTS "game_locations_update" ON public.game_locations;
CREATE POLICY "game_locations_update"
ON public.game_locations FOR UPDATE
TO authenticated
USING (public.is_game_manager(instance_id))
WITH CHECK (public.is_game_manager(instance_id));

DROP POLICY IF EXISTS "game_locations_delete" ON public.game_locations;
CREATE POLICY "game_locations_delete"
ON public.game_locations FOR DELETE
TO authenticated
USING (public.is_game_manager(instance_id));

-- ============================================================================
-- RLS POLICIES: game_highlights
-- ============================================================================

ALTER TABLE public.game_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_highlights_select" ON public.game_highlights;
CREATE POLICY "game_highlights_select"
ON public.game_highlights FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.game_sessions gs
        WHERE gs.id = game_highlights.session_id
          AND is_instance_member(gs.instance_id)
    )
);

DROP POLICY IF EXISTS "game_highlights_insert" ON public.game_highlights;
CREATE POLICY "game_highlights_insert"
ON public.game_highlights FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.game_sessions gs
        WHERE gs.id = game_highlights.session_id
          AND is_instance_member(gs.instance_id)
    )
);

DROP POLICY IF EXISTS "game_highlights_update" ON public.game_highlights;
CREATE POLICY "game_highlights_update"
ON public.game_highlights FOR UPDATE
TO authenticated
USING (
    created_by_membership_id IN (
        SELECT id FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
    )
    OR public.can_manage_game_session(session_id)
);

COMMIT;

NOTIFY pgrst, 'reload schema';
