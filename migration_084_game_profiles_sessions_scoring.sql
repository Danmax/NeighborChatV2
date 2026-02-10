-- Migration 084: Game profiles, session scheduling controls, and score events
-- Date: 2026-02-10
-- Description: Adds player game profiles, session self-join controls, and score event audit logging.

BEGIN;

-- ============================================================================
-- SESSION SCHEDULING CONTROLS
-- ============================================================================

ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS max_players integer CHECK (max_players IS NULL OR max_players > 0);

ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS allow_self_join boolean DEFAULT true;

ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS registration_deadline timestamptz;

CREATE INDEX IF NOT EXISTS idx_game_sessions_registration_deadline
ON public.game_sessions(registration_deadline)
WHERE registration_deadline IS NOT NULL;

-- ============================================================================
-- TABLE: GAME PLAYER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_player_profiles (
    id text PRIMARY KEY,
    membership_id text NOT NULL REFERENCES public.instance_memberships(id) ON DELETE CASCADE,
    display_name text,
    avatar text,
    skill_level text DEFAULT 'beginner' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    favorite_game_types jsonb DEFAULT '[]'::jsonb,
    bio text,
    visibility text DEFAULT 'instance' CHECK (visibility IN ('private', 'instance', 'public')),
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_game_player_profile_membership UNIQUE (membership_id)
);

CREATE INDEX IF NOT EXISTS idx_game_player_profiles_membership
ON public.game_player_profiles(membership_id);

-- ============================================================================
-- TABLE: GAME SCORE EVENTS (AUDIT LOG)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_score_events (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    membership_id text NOT NULL REFERENCES public.instance_memberships(id) ON DELETE CASCADE,
    team_id text REFERENCES public.game_teams(id) ON DELETE SET NULL,
    event_type text NOT NULL DEFAULT 'score_adjustment',
    points_delta integer NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by_membership_id text NOT NULL REFERENCES public.instance_memberships(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_score_events_session
ON public.game_score_events(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_score_events_membership
ON public.game_score_events(membership_id, created_at DESC);

-- ============================================================================
-- RLS: GAME SESSIONS
-- ============================================================================

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'game_sessions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.game_sessions', r.policyname);
    END LOOP;
END $$;

CREATE POLICY game_sessions_select_members
ON public.game_sessions FOR SELECT
TO authenticated
USING (is_instance_member(instance_id));

CREATE POLICY game_sessions_insert_game_managers
ON public.game_sessions FOR INSERT
TO authenticated
WITH CHECK (
    instance_id IS NOT NULL
    AND is_instance_member(instance_id)
    AND public.is_game_manager(instance_id)
    AND host_membership_id = public.get_user_membership_id(instance_id)
);

CREATE POLICY game_sessions_update_managers
ON public.game_sessions FOR UPDATE
TO authenticated
USING (public.can_manage_game_session(id))
WITH CHECK (public.can_manage_game_session(id));

CREATE POLICY game_sessions_delete_managers
ON public.game_sessions FOR DELETE
TO authenticated
USING (public.can_manage_game_session(id));

-- ============================================================================
-- RLS: GAME PLAYERS (JOIN/PARTICIPATION)
-- ============================================================================

ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'game_players'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.game_players', r.policyname);
    END LOOP;
END $$;

CREATE POLICY game_players_select_members
ON public.game_players FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.game_sessions gs
        WHERE gs.id = game_players.session_id
          AND is_instance_member(gs.instance_id)
    )
);

CREATE POLICY game_players_insert_join_or_manage
ON public.game_players FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.game_sessions gs
        JOIN public.instance_memberships im
          ON im.id = game_players.membership_id
        WHERE gs.id = game_players.session_id
          AND im.status = 'active'
          AND im.instance_id = gs.instance_id
          AND (
              public.can_manage_game_session(gs.id)
              OR (
                  im.user_id = public.current_user_uuid()
                  AND
                  COALESCE(gs.allow_self_join, true) = true
                  AND gs.status IN ('scheduled', 'active')
                  AND (gs.registration_deadline IS NULL OR gs.registration_deadline > now())
              )
          )
    )
);

CREATE POLICY game_players_update_self_or_manage
ON public.game_players FOR UPDATE
TO authenticated
USING (
    public.can_manage_game_session(session_id)
    OR membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND status = 'active'
    )
)
WITH CHECK (
    public.can_manage_game_session(session_id)
    OR membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND status = 'active'
    )
);

CREATE POLICY game_players_delete_self_or_manage
ON public.game_players FOR DELETE
TO authenticated
USING (
    public.can_manage_game_session(session_id)
    OR membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND status = 'active'
    )
);

-- ============================================================================
-- RLS: GAME PLAYER PROFILES
-- ============================================================================

ALTER TABLE public.game_player_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_player_profiles_select ON public.game_player_profiles;
CREATE POLICY game_player_profiles_select
ON public.game_player_profiles FOR SELECT
TO authenticated
USING (
    membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND status = 'active'
    )
    OR (
        visibility IN ('instance', 'public')
        AND EXISTS (
            SELECT 1
            FROM public.instance_memberships mine
            JOIN public.instance_memberships target
              ON target.id = game_player_profiles.membership_id
            WHERE mine.user_id = public.current_user_uuid()
              AND mine.status = 'active'
              AND target.instance_id = mine.instance_id
        )
    )
);

DROP POLICY IF EXISTS game_player_profiles_insert_self ON public.game_player_profiles;
CREATE POLICY game_player_profiles_insert_self
ON public.game_player_profiles FOR INSERT
TO authenticated
WITH CHECK (
    membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND status = 'active'
    )
);

DROP POLICY IF EXISTS game_player_profiles_update_self ON public.game_player_profiles;
CREATE POLICY game_player_profiles_update_self
ON public.game_player_profiles FOR UPDATE
TO authenticated
USING (
    membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND status = 'active'
    )
)
WITH CHECK (
    membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND status = 'active'
    )
);

DROP POLICY IF EXISTS game_player_profiles_delete_self ON public.game_player_profiles;
CREATE POLICY game_player_profiles_delete_self
ON public.game_player_profiles FOR DELETE
TO authenticated
USING (
    membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND status = 'active'
    )
);

-- ============================================================================
-- RLS: GAME SCORE EVENTS
-- ============================================================================

ALTER TABLE public.game_score_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_score_events_select_members ON public.game_score_events;
CREATE POLICY game_score_events_select_members
ON public.game_score_events FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.game_sessions gs
        WHERE gs.id = game_score_events.session_id
          AND is_instance_member(gs.instance_id)
    )
);

DROP POLICY IF EXISTS game_score_events_insert_managers ON public.game_score_events;
CREATE POLICY game_score_events_insert_managers
ON public.game_score_events FOR INSERT
TO authenticated
WITH CHECK (
    public.can_manage_game_session(session_id)
    AND created_by_membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND status = 'active'
    )
);

DROP POLICY IF EXISTS game_score_events_update_managers ON public.game_score_events;
CREATE POLICY game_score_events_update_managers
ON public.game_score_events FOR UPDATE
TO authenticated
USING (public.can_manage_game_session(session_id))
WITH CHECK (public.can_manage_game_session(session_id));

DROP POLICY IF EXISTS game_score_events_delete_managers ON public.game_score_events;
CREATE POLICY game_score_events_delete_managers
ON public.game_score_events FOR DELETE
TO authenticated
USING (public.can_manage_game_session(session_id));

COMMIT;

NOTIFY pgrst, 'reload schema';
