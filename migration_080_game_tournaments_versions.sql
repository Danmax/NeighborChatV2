-- Migration 080: Game Tournaments, Versions, and Referees
-- Date: 2026-02-09
-- Description: Add tournament system, game version tracking, and referee assignments

BEGIN;

-- ============================================================================
-- TABLES: Game Versions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_versions (
    id text PRIMARY KEY,
    template_id text NOT NULL REFERENCES public.game_templates(id) ON DELETE CASCADE,
    version_number text NOT NULL, -- e.g., "1.0", "1.1", "2.0"
    version_name text, -- e.g., "Original", "Season 2 Update"
    changes_summary text,
    rules_diff jsonb, -- Changes to rules
    config_diff jsonb, -- Changes to config
    is_current boolean DEFAULT false,
    effective_date timestamptz DEFAULT now(),
    created_by_membership_id text REFERENCES public.instance_memberships(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_game_versions_template ON public.game_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_game_versions_current ON public.game_versions(is_current) WHERE is_current = true;

-- Add game_version_id to game_sessions
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS game_version_id text REFERENCES public.game_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_game_sessions_version ON public.game_sessions(game_version_id);

-- ============================================================================
-- TABLES: Tournaments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_tournaments (
    id text PRIMARY KEY,
    instance_id text NOT NULL REFERENCES public.community_instances(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    icon text DEFAULT '🏆',
    banner_image_url text,
    tournament_type text DEFAULT 'single_elimination' CHECK (tournament_type IN
        ('single_elimination', 'double_elimination', 'round_robin', 'swiss', 'group_stage', 'custom')),
    game_template_id text REFERENCES public.game_templates(id) ON DELETE SET NULL,
    status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'registration', 'active', 'completed', 'cancelled')),
    start_date timestamptz,
    end_date timestamptz,
    registration_deadline timestamptz,
    max_participants integer,
    participant_type text DEFAULT 'individual' CHECK (participant_type IN ('individual', 'team', 'mixed')),
    prize_info jsonb, -- {"1st": "Trophy + $100", "2nd": "$50", ...}
    bracket_data jsonb, -- Tournament bracket structure
    rules text,
    organizer_membership_id text NOT NULL REFERENCES public.instance_memberships(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_tournaments_instance ON public.game_tournaments(instance_id);
CREATE INDEX IF NOT EXISTS idx_game_tournaments_status ON public.game_tournaments(status);
CREATE INDEX IF NOT EXISTS idx_game_tournaments_start_date ON public.game_tournaments(start_date);
CREATE INDEX IF NOT EXISTS idx_game_tournaments_template ON public.game_tournaments(game_template_id);

-- Table: Tournament Participants
CREATE TABLE IF NOT EXISTS public.game_tournament_participants (
    id text PRIMARY KEY,
    tournament_id text NOT NULL REFERENCES public.game_tournaments(id) ON DELETE CASCADE,
    membership_id text REFERENCES public.instance_memberships(id) ON DELETE SET NULL,
    team_id text REFERENCES public.game_teams(id) ON DELETE SET NULL,
    seed_number integer,
    status text DEFAULT 'registered' CHECK (status IN ('registered', 'active', 'eliminated', 'withdrawn', 'winner')),
    current_wins integer DEFAULT 0,
    current_losses integer DEFAULT 0,
    placement integer, -- Final placement (1st, 2nd, 3rd, etc.)
    registered_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT tournament_participant_type CHECK (
        (membership_id IS NOT NULL AND team_id IS NULL) OR
        (membership_id IS NULL AND team_id IS NOT NULL)
    ),
    UNIQUE (tournament_id, membership_id),
    UNIQUE (tournament_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON public.game_tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_member ON public.game_tournament_participants(membership_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_team ON public.game_tournament_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_status ON public.game_tournament_participants(status);

-- Add tournament fields to game_sessions
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS tournament_id text REFERENCES public.game_tournaments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tournament_round integer,
ADD COLUMN IF NOT EXISTS tournament_match_number integer;

CREATE INDEX IF NOT EXISTS idx_game_sessions_tournament ON public.game_sessions(tournament_id);

-- ============================================================================
-- TABLES: Referees
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_referees (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    membership_id text NOT NULL REFERENCES public.instance_memberships(id) ON DELETE CASCADE,
    referee_role text DEFAULT 'scorer' CHECK (referee_role IN ('head_referee', 'scorer', 'timekeeper', 'assistant')),
    assigned_by_membership_id text REFERENCES public.instance_memberships(id) ON DELETE SET NULL,
    notes text, -- Referee's match notes
    assigned_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_referee_per_session UNIQUE (session_id, membership_id)
);

CREATE INDEX IF NOT EXISTS idx_game_referees_session ON public.game_referees(session_id);
CREATE INDEX IF NOT EXISTS idx_game_referees_member ON public.game_referees(membership_id);
CREATE INDEX IF NOT EXISTS idx_game_referees_role ON public.game_referees(referee_role);

-- ============================================================================
-- UPDATE SECURITY FUNCTIONS
-- ============================================================================

-- Update is_session_referee function (was placeholder in migration_079)
CREATE OR REPLACE FUNCTION public.is_session_referee(p_session_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_uuid text;
    v_is_referee boolean;
BEGIN
    v_user_uuid := public.current_user_uuid();
    IF v_user_uuid IS NULL THEN
        RETURN false;
    END IF;

    -- Disable RLS for internal query
    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.game_referees gr
        JOIN public.instance_memberships im ON im.id = gr.membership_id
        WHERE gr.session_id = p_session_id
          AND im.user_id = v_user_uuid
          AND im.status = 'active'
    ) INTO v_is_referee;

    RETURN COALESCE(v_is_referee, false);
END;
$$;

-- ============================================================================
-- RLS POLICIES: game_versions
-- ============================================================================

ALTER TABLE public.game_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_versions_select" ON public.game_versions;
CREATE POLICY "game_versions_select"
ON public.game_versions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.game_templates gt
        WHERE gt.id = game_versions.template_id
          AND (
              gt.is_public = true
              OR gt.instance_id IS NULL
              OR is_instance_member(gt.instance_id)
          )
    )
);

DROP POLICY IF EXISTS "game_versions_insert" ON public.game_versions;
CREATE POLICY "game_versions_insert"
ON public.game_versions FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.game_templates gt
        WHERE gt.id = game_versions.template_id
          AND gt.instance_id IS NOT NULL
          AND public.is_game_manager(gt.instance_id)
    )
);

DROP POLICY IF EXISTS "game_versions_update" ON public.game_versions;
CREATE POLICY "game_versions_update"
ON public.game_versions FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.game_templates gt
        WHERE gt.id = game_versions.template_id
          AND gt.instance_id IS NOT NULL
          AND public.is_game_manager(gt.instance_id)
    )
);

-- ============================================================================
-- RLS POLICIES: game_tournaments
-- ============================================================================

ALTER TABLE public.game_tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_tournaments_select" ON public.game_tournaments;
CREATE POLICY "game_tournaments_select"
ON public.game_tournaments FOR SELECT
TO authenticated
USING (is_instance_member(instance_id));

DROP POLICY IF EXISTS "game_tournaments_insert" ON public.game_tournaments;
CREATE POLICY "game_tournaments_insert"
ON public.game_tournaments FOR INSERT
TO authenticated
WITH CHECK (
    instance_id IS NOT NULL
    AND public.is_game_manager(instance_id)
);

DROP POLICY IF EXISTS "game_tournaments_update" ON public.game_tournaments;
CREATE POLICY "game_tournaments_update"
ON public.game_tournaments FOR UPDATE
TO authenticated
USING (
    organizer_membership_id IN (
        SELECT id FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
    )
    OR public.is_game_manager(instance_id)
);

DROP POLICY IF EXISTS "game_tournaments_delete" ON public.game_tournaments;
CREATE POLICY "game_tournaments_delete"
ON public.game_tournaments FOR DELETE
TO authenticated
USING (public.is_game_manager(instance_id));

-- ============================================================================
-- RLS POLICIES: game_tournament_participants
-- ============================================================================

ALTER TABLE public.game_tournament_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournament_participants_select" ON public.game_tournament_participants;
CREATE POLICY "tournament_participants_select"
ON public.game_tournament_participants FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.game_tournaments gt
        WHERE gt.id = game_tournament_participants.tournament_id
          AND is_instance_member(gt.instance_id)
    )
);

DROP POLICY IF EXISTS "tournament_participants_insert" ON public.game_tournament_participants;
CREATE POLICY "tournament_participants_insert"
ON public.game_tournament_participants FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.game_tournaments gt
        WHERE gt.id = game_tournament_participants.tournament_id
          AND is_instance_member(gt.instance_id)
          AND gt.status IN ('upcoming', 'registration')
    )
    AND (
        -- Can register self
        membership_id IN (
            SELECT id FROM public.instance_memberships
            WHERE user_id = public.current_user_uuid()
        )
        -- Or team captain can register team
        OR team_id IN (
            SELECT id FROM public.game_teams
            WHERE captain_membership_id IN (
                SELECT id FROM public.instance_memberships
                WHERE user_id = public.current_user_uuid()
            )
        )
    )
);

DROP POLICY IF EXISTS "tournament_participants_delete" ON public.game_tournament_participants;
CREATE POLICY "tournament_participants_delete"
ON public.game_tournament_participants FOR DELETE
TO authenticated
USING (
    -- Can withdraw self or team captain can withdraw team
    membership_id IN (
        SELECT id FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
    )
    OR team_id IN (
        SELECT id FROM public.game_teams
        WHERE captain_membership_id IN (
            SELECT id FROM public.instance_memberships
            WHERE user_id = public.current_user_uuid()
        )
    )
);

-- ============================================================================
-- RLS POLICIES: game_referees
-- ============================================================================

ALTER TABLE public.game_referees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_referees_select" ON public.game_referees;
CREATE POLICY "game_referees_select"
ON public.game_referees FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.game_sessions gs
        WHERE gs.id = game_referees.session_id
          AND is_instance_member(gs.instance_id)
    )
);

DROP POLICY IF EXISTS "game_referees_insert" ON public.game_referees;
CREATE POLICY "game_referees_insert"
ON public.game_referees FOR INSERT
TO authenticated
WITH CHECK (
    public.can_manage_game_session(session_id)
    OR EXISTS (
        SELECT 1 FROM public.game_sessions gs
        WHERE gs.id = game_referees.session_id
          AND public.is_game_manager(gs.instance_id)
    )
);

DROP POLICY IF EXISTS "game_referees_update" ON public.game_referees;
CREATE POLICY "game_referees_update"
ON public.game_referees FOR UPDATE
TO authenticated
USING (
    -- Referee can update own notes
    membership_id IN (
        SELECT id FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
    )
    OR public.can_manage_game_session(session_id)
);

DROP POLICY IF EXISTS "game_referees_delete" ON public.game_referees;
CREATE POLICY "game_referees_delete"
ON public.game_referees FOR DELETE
TO authenticated
USING (public.can_manage_game_session(session_id));

COMMIT;

NOTIFY pgrst, 'reload schema';
