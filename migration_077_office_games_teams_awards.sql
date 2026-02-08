-- Migration 077: Office Games Teams and Awards
-- Date: 2026-02-08
-- Description: Add team support, game awards, leaderboard functionality for Office Games feature

BEGIN;

-- ============================================================================
-- PART 1: NEW TABLES
-- ============================================================================

-- 1. game_teams - Team management
CREATE TABLE IF NOT EXISTS public.game_teams (
    id text NOT NULL,
    instance_id text NOT NULL,
    name text NOT NULL,
    description text,
    icon text DEFAULT '🎮'::text,
    color text DEFAULT '#5c34a5'::text,
    captain_membership_id text,
    max_members integer DEFAULT 10,
    is_active boolean DEFAULT true,
    team_stats jsonb DEFAULT '{"totalGames": 0, "totalWins": 0, "totalPoints": 0, "winStreak": 0, "bestWinStreak": 0}'::jsonb,
    created_by_membership_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT game_teams_pkey PRIMARY KEY (id),
    CONSTRAINT game_teams_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id) ON DELETE CASCADE,
    CONSTRAINT game_teams_captain_membership_id_fkey FOREIGN KEY (captain_membership_id) REFERENCES public.instance_memberships(id) ON DELETE SET NULL,
    CONSTRAINT game_teams_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES public.instance_memberships(id) ON DELETE CASCADE,
    CONSTRAINT game_teams_name_check CHECK (length(name) >= 2 AND length(name) <= 50)
);

-- Unique team name per instance (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS game_teams_instance_name_unique
ON public.game_teams (instance_id, lower(name))
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_game_teams_instance_id ON public.game_teams(instance_id);
CREATE INDEX IF NOT EXISTS idx_game_teams_captain ON public.game_teams(captain_membership_id);
CREATE INDEX IF NOT EXISTS idx_game_teams_created_at ON public.game_teams(created_at DESC);

-- 2. game_team_members - Team membership
CREATE TABLE IF NOT EXISTS public.game_team_members (
    id text NOT NULL,
    team_id text NOT NULL,
    membership_id text NOT NULL,
    role text DEFAULT 'member'::text CHECK (role IN ('captain', 'co-captain', 'member')),
    status text DEFAULT 'active'::text CHECK (status IN ('active', 'inactive', 'pending', 'removed')),
    joined_at timestamp with time zone DEFAULT now(),
    left_at timestamp with time zone,
    invited_by_membership_id text,
    player_stats jsonb DEFAULT '{"gamesPlayed": 0, "gamesWon": 0, "pointsContributed": 0}'::jsonb,
    CONSTRAINT game_team_members_pkey PRIMARY KEY (id),
    CONSTRAINT game_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.game_teams(id) ON DELETE CASCADE,
    CONSTRAINT game_team_members_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.instance_memberships(id) ON DELETE CASCADE,
    CONSTRAINT game_team_members_invited_by_fkey FOREIGN KEY (invited_by_membership_id) REFERENCES public.instance_memberships(id) ON DELETE SET NULL
);

-- Unique active membership per team
CREATE UNIQUE INDEX IF NOT EXISTS game_team_members_active_unique
ON public.game_team_members (team_id, membership_id)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_game_team_members_team_id ON public.game_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_game_team_members_membership_id ON public.game_team_members(membership_id);
CREATE INDEX IF NOT EXISTS idx_game_team_members_status ON public.game_team_members(status) WHERE status = 'active';

-- 3. game_awards - Award/achievement definitions
CREATE TABLE IF NOT EXISTS public.game_awards (
    id text NOT NULL,
    instance_id text,  -- NULL for global/system awards
    name text NOT NULL,
    description text,
    icon text DEFAULT '🏆'::text,
    badge_image_url text,
    category text DEFAULT 'general'::text CHECK (category IN ('general', 'milestone', 'streak', 'game_type', 'team', 'special')),
    game_type text,  -- Specific game type this award applies to (NULL for any game)
    criteria jsonb DEFAULT '{}'::jsonb,  -- e.g., {"type": "games_won", "threshold": 10}
    rarity text DEFAULT 'common'::text CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    points_value integer DEFAULT 0,
    max_per_person integer,  -- NULL means unlimited
    is_automatic boolean DEFAULT false,  -- Auto-awarded when criteria met
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT game_awards_pkey PRIMARY KEY (id),
    CONSTRAINT game_awards_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id) ON DELETE CASCADE,
    CONSTRAINT game_awards_name_check CHECK (length(name) >= 2 AND length(name) <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS game_awards_instance_name_unique
ON public.game_awards (COALESCE(instance_id, '__global__'), lower(name));

CREATE INDEX IF NOT EXISTS idx_game_awards_instance_id ON public.game_awards(instance_id);
CREATE INDEX IF NOT EXISTS idx_game_awards_category ON public.game_awards(category);
CREATE INDEX IF NOT EXISTS idx_game_awards_game_type ON public.game_awards(game_type) WHERE game_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_awards_is_automatic ON public.game_awards(is_automatic) WHERE is_automatic = true;

-- 4. game_player_awards - Awarded badges to players
CREATE TABLE IF NOT EXISTS public.game_player_awards (
    id text NOT NULL,
    award_id text NOT NULL,
    membership_id text NOT NULL,
    team_id text,  -- For team-based awards
    session_id text,  -- Game session that triggered the award
    reason text,
    awarded_by_membership_id text,  -- NULL for automatic awards
    is_automatic boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    awarded_at timestamp with time zone DEFAULT now(),
    CONSTRAINT game_player_awards_pkey PRIMARY KEY (id),
    CONSTRAINT game_player_awards_award_id_fkey FOREIGN KEY (award_id) REFERENCES public.game_awards(id) ON DELETE CASCADE,
    CONSTRAINT game_player_awards_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.instance_memberships(id) ON DELETE CASCADE,
    CONSTRAINT game_player_awards_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.game_teams(id) ON DELETE SET NULL,
    CONSTRAINT game_player_awards_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id) ON DELETE SET NULL,
    CONSTRAINT game_player_awards_awarded_by_fkey FOREIGN KEY (awarded_by_membership_id) REFERENCES public.instance_memberships(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_game_player_awards_award_id ON public.game_player_awards(award_id);
CREATE INDEX IF NOT EXISTS idx_game_player_awards_membership_id ON public.game_player_awards(membership_id);
CREATE INDEX IF NOT EXISTS idx_game_player_awards_awarded_at ON public.game_player_awards(awarded_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_player_awards_membership_award ON public.game_player_awards(membership_id, award_id);

-- ============================================================================
-- PART 2: MODIFY EXISTING TABLES
-- ============================================================================

-- Add team_mode and winning_team_id to game_sessions
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS team_mode text DEFAULT 'individual'::text
CHECK (team_mode IN ('individual', 'team', 'mixed'));

ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS winning_team_id text REFERENCES public.game_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_game_sessions_team_mode ON public.game_sessions(team_mode) WHERE team_mode != 'individual';
CREATE INDEX IF NOT EXISTS idx_game_sessions_winning_team ON public.game_sessions(winning_team_id) WHERE winning_team_id IS NOT NULL;

-- Add team_id to game_players
ALTER TABLE public.game_players
ADD COLUMN IF NOT EXISTS team_id text REFERENCES public.game_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_game_players_team_id ON public.game_players(team_id) WHERE team_id IS NOT NULL;

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Check if user is a team member
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.game_team_members gtm
        JOIN public.instance_memberships im ON im.id = gtm.membership_id
        WHERE gtm.team_id = p_team_id
          AND im.user_id = public.current_user_uuid()
          AND gtm.status = 'active'
    );
END;
$$;

-- Check if user is team captain
CREATE OR REPLACE FUNCTION public.is_team_captain(p_team_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.game_teams gt
        JOIN public.instance_memberships im ON im.id = gt.captain_membership_id
        WHERE gt.id = p_team_id
          AND im.user_id = public.current_user_uuid()
          AND im.status = 'active'
    );
END;
$$;

-- Get user's current membership for an instance
CREATE OR REPLACE FUNCTION public.get_user_membership_id(p_instance_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_membership_id text;
BEGIN
    SELECT id INTO v_membership_id
    FROM public.instance_memberships
    WHERE user_id = public.current_user_uuid()
      AND instance_id = p_instance_id
      AND status = 'active'
    LIMIT 1;

    RETURN v_membership_id;
END;
$$;

-- ============================================================================
-- PART 4: RLS POLICIES
-- ============================================================================

-- game_teams RLS
ALTER TABLE public.game_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_teams_select" ON public.game_teams;
CREATE POLICY "game_teams_select"
ON public.game_teams FOR SELECT
TO authenticated
USING (is_instance_member(instance_id));

DROP POLICY IF EXISTS "game_teams_insert" ON public.game_teams;
CREATE POLICY "game_teams_insert"
ON public.game_teams FOR INSERT
TO authenticated
WITH CHECK (
    is_instance_member(instance_id)
    AND created_by_membership_id = public.get_user_membership_id(instance_id)
);

DROP POLICY IF EXISTS "game_teams_update" ON public.game_teams;
CREATE POLICY "game_teams_update"
ON public.game_teams FOR UPDATE
TO authenticated
USING (
    captain_membership_id = public.get_user_membership_id(instance_id)
    OR created_by_membership_id = public.get_user_membership_id(instance_id)
)
WITH CHECK (
    captain_membership_id = public.get_user_membership_id(instance_id)
    OR created_by_membership_id = public.get_user_membership_id(instance_id)
);

DROP POLICY IF EXISTS "game_teams_delete" ON public.game_teams;
CREATE POLICY "game_teams_delete"
ON public.game_teams FOR DELETE
TO authenticated
USING (
    created_by_membership_id = public.get_user_membership_id(instance_id)
);

-- game_team_members RLS
ALTER TABLE public.game_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_team_members_select" ON public.game_team_members;
CREATE POLICY "game_team_members_select"
ON public.game_team_members FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.game_teams t
        WHERE t.id = game_team_members.team_id
          AND is_instance_member(t.instance_id)
    )
);

DROP POLICY IF EXISTS "game_team_members_insert" ON public.game_team_members;
CREATE POLICY "game_team_members_insert"
ON public.game_team_members FOR INSERT
TO authenticated
WITH CHECK (
    -- Captain can add members
    is_team_captain(team_id)
    OR
    -- User can join themselves (as pending or if open team)
    (membership_id IN (
        SELECT id FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid() AND status = 'active'
    ))
);

DROP POLICY IF EXISTS "game_team_members_update" ON public.game_team_members;
CREATE POLICY "game_team_members_update"
ON public.game_team_members FOR UPDATE
TO authenticated
USING (
    -- Own membership
    membership_id IN (
        SELECT id FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid() AND status = 'active'
    )
    OR is_team_captain(team_id)
);

DROP POLICY IF EXISTS "game_team_members_delete" ON public.game_team_members;
CREATE POLICY "game_team_members_delete"
ON public.game_team_members FOR DELETE
TO authenticated
USING (is_team_captain(team_id));

-- game_awards RLS
ALTER TABLE public.game_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_awards_select" ON public.game_awards;
CREATE POLICY "game_awards_select"
ON public.game_awards FOR SELECT
TO authenticated
USING (
    instance_id IS NULL  -- Global awards visible to all
    OR is_instance_member(instance_id)
);

DROP POLICY IF EXISTS "game_awards_insert" ON public.game_awards;
CREATE POLICY "game_awards_insert"
ON public.game_awards FOR INSERT
TO authenticated
WITH CHECK (
    instance_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND instance_id = game_awards.instance_id
          AND role IN ('admin', 'moderator')
          AND status = 'active'
    )
);

DROP POLICY IF EXISTS "game_awards_update" ON public.game_awards;
CREATE POLICY "game_awards_update"
ON public.game_awards FOR UPDATE
TO authenticated
USING (
    instance_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND instance_id = game_awards.instance_id
          AND role IN ('admin', 'moderator')
          AND status = 'active'
    )
);

-- game_player_awards RLS
ALTER TABLE public.game_player_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_player_awards_select" ON public.game_player_awards;
CREATE POLICY "game_player_awards_select"
ON public.game_player_awards FOR SELECT
TO authenticated
USING (
    membership_id IN (
        SELECT id FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
    )
    OR EXISTS (
        SELECT 1 FROM public.game_awards a
        WHERE a.id = game_player_awards.award_id
          AND (a.instance_id IS NULL OR is_instance_member(a.instance_id))
    )
);

DROP POLICY IF EXISTS "game_player_awards_insert" ON public.game_player_awards;
CREATE POLICY "game_player_awards_insert"
ON public.game_player_awards FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.game_awards a
        JOIN public.instance_memberships im ON im.instance_id = a.instance_id
        WHERE a.id = game_player_awards.award_id
          AND im.user_id = public.current_user_uuid()
          AND im.role IN ('admin', 'moderator')
          AND im.status = 'active'
    )
);

-- ============================================================================
-- PART 5: SEED NEW GAME TEMPLATES
-- ============================================================================

INSERT INTO public.game_templates (
    id, instance_id, name, description, icon, game_type, category,
    config, rules, min_players, max_players, estimated_duration_minutes,
    is_template, is_public, created_at
) VALUES
(
    'game_tpl_nerf_target',
    NULL,
    'Nerf Target Challenge',
    'Test your accuracy with a Nerf blaster target shooting competition. Compete individually to score the most points!',
    '🎯',
    'nerf-target',
    'skills',
    '{"teams": {"mode": "individual", "size": 1}, "scoring": {"bullseye": 10, "inner_ring": 5, "outer_ring": 2, "miss": 0}, "scoreboard": "individual", "sessions": {"duration_minutes": 30, "rounds": 3, "shots_per_round": 10}, "equipment": ["Nerf blasters", "Target boards", "Safety glasses"], "prizes": "Top 3 shooters", "winner_rules": "Highest total score"}'::jsonb,
    '{"list": ["Safety glasses required at all times", "3 rounds of 10 shots each", "No crossing the firing line", "Score tallied after each round", "Ties broken by sudden-death round", "Must use provided equipment only"]}'::jsonb,
    2, 20, 30, true, true, now()
),
(
    'game_tpl_office_trivia',
    NULL,
    'Office Trivia Challenge',
    'Test your knowledge across multiple categories in this team or individual trivia competition.',
    '🧠',
    'trivia',
    'knowledge',
    '{"teams": {"mode": "tables", "size": 4}, "scoring": {"correct": 10, "bonus_round": 20, "speed_bonus": 5}, "scoreboard": "team", "sessions": {"duration_minutes": 45, "rounds": 5, "questions_per_round": 10}, "categories": ["General Knowledge", "Pop Culture", "Science & Tech", "History", "Office Lore"], "prizes": "Winning team trophy", "winner_rules": "Highest team score"}'::jsonb,
    '{"list": ["Teams of 2-5 players", "No phones or internet during questions", "30 seconds per question", "Final round is double points", "One answer submission per team", "Host decision is final on disputes"]}'::jsonb,
    4, 40, 45, true, true, now()
),
(
    'game_tpl_puzzle_challenge',
    NULL,
    'Puzzle Challenge',
    'Race against time and opponents to complete challenging puzzles. Work in pairs for maximum strategy!',
    '🧩',
    'puzzle',
    'strategy',
    '{"teams": {"mode": "pairs", "size": 2}, "scoring": {"completion": 100, "time_bonus": 50, "accuracy_bonus": 25}, "scoreboard": "team", "sessions": {"duration_minutes": 60, "rounds": 3, "puzzle_types": ["jigsaw", "logic", "word"]}, "difficulty_levels": ["easy", "medium", "hard"], "prizes": "Fastest team wins", "winner_rules": "Fastest completion with accuracy bonus"}'::jsonb,
    '{"list": ["Teams of 2 players", "Different puzzle type each round", "15-minute time limit per puzzle", "Partial credit for incomplete puzzles", "No outside help or electronic devices", "Puzzles verified by judge before scoring"]}'::jsonb,
    4, 24, 60, true, true, now()
),
(
    'game_tpl_time_trial',
    NULL,
    'Time Trial Sprint',
    'Complete office challenges against the clock in this fast-paced individual competition.',
    '⏱️',
    'time-trial',
    'skills',
    '{"teams": {"mode": "individual", "size": 1}, "scoring": {"completion": 50, "time_multiplier": 2, "penalty_per_error": -5}, "scoreboard": "individual", "sessions": {"duration_minutes": 40, "rounds": 4, "stations": 5}, "challenges": ["typing speed", "paper airplane distance", "desk organization", "memo delivery", "coffee cup stacking"], "prizes": "Fastest overall time", "winner_rules": "Lowest total time with penalties"}'::jsonb,
    '{"list": ["Complete all stations in order", "Time starts on whistle", "5-second penalty per error", "Must finish each station before moving on", "Safety first - no running", "Judges decision is final"]}'::jsonb,
    4, 16, 40, true, true, now()
),
(
    'game_tpl_table_tennis',
    NULL,
    'Table Tennis Tournament',
    'Classic ping pong tournament with singles brackets. May the best paddle win!',
    '🏓',
    'table-tennis',
    'sports',
    '{"teams": {"mode": "solo", "size": 1}, "scoring": {"game_win": 1, "match_win": 3}, "scoreboard": "bracket", "sessions": {"duration_minutes": 120, "format": "single_elimination", "games_per_match": 3, "points_per_game": 11}, "equipment": ["Ping pong table", "Paddles", "Balls"], "prizes": "Champion trophy", "winner_rules": "Bracket winner"}'::jsonb,
    '{"list": ["Official table tennis rules apply", "Best of 3 games per match", "Games to 11 points, win by 2", "Alternate serves every 2 points", "Let serves are replayed", "Finals are best of 5", "Players provide own paddles or use house paddles"]}'::jsonb,
    4, 32, 120, true, true, now()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    game_type = EXCLUDED.game_type,
    category = EXCLUDED.category,
    config = EXCLUDED.config,
    rules = EXCLUDED.rules,
    min_players = EXCLUDED.min_players,
    max_players = EXCLUDED.max_players,
    estimated_duration_minutes = EXCLUDED.estimated_duration_minutes;

-- ============================================================================
-- PART 6: SEED DEFAULT AWARDS
-- ============================================================================

INSERT INTO public.game_awards (
    id, instance_id, name, description, icon, category, game_type,
    criteria, rarity, points_value, is_automatic, is_active, sort_order
) VALUES
-- Milestone achievements
('award_first_game', NULL, 'First Steps', 'Completed your first game', '🎮', 'milestone', NULL,
 '{"type": "games_played", "threshold": 1}'::jsonb, 'common', 10, true, true, 1),
('award_10_games', NULL, 'Game Enthusiast', 'Played 10 games', '🎯', 'milestone', NULL,
 '{"type": "games_played", "threshold": 10}'::jsonb, 'uncommon', 25, true, true, 2),
('award_50_games', NULL, 'Game Veteran', 'Played 50 games', '🏆', 'milestone', NULL,
 '{"type": "games_played", "threshold": 50}'::jsonb, 'rare', 50, true, true, 3),
('award_100_games', NULL, 'Game Legend', 'Played 100 games', '👑', 'milestone', NULL,
 '{"type": "games_played", "threshold": 100}'::jsonb, 'epic', 100, true, true, 4),

-- Win achievements
('award_first_win', NULL, 'Victor', 'Won your first game', '🥇', 'milestone', NULL,
 '{"type": "games_won", "threshold": 1}'::jsonb, 'common', 15, true, true, 10),
('award_10_wins', NULL, 'Champion', 'Won 10 games', '🏅', 'milestone', NULL,
 '{"type": "games_won", "threshold": 10}'::jsonb, 'uncommon', 40, true, true, 11),
('award_25_wins', NULL, 'Grand Champion', 'Won 25 games', '🎖️', 'milestone', NULL,
 '{"type": "games_won", "threshold": 25}'::jsonb, 'rare', 75, true, true, 12),

-- Win streaks
('award_3_streak', NULL, 'Hot Streak', 'Won 3 games in a row', '🔥', 'streak', NULL,
 '{"type": "win_streak", "threshold": 3}'::jsonb, 'uncommon', 30, true, true, 20),
('award_5_streak', NULL, 'On Fire', 'Won 5 games in a row', '💥', 'streak', NULL,
 '{"type": "win_streak", "threshold": 5}'::jsonb, 'rare', 50, true, true, 21),
('award_10_streak', NULL, 'Unstoppable', 'Won 10 games in a row', '⚡', 'streak', NULL,
 '{"type": "win_streak", "threshold": 10}'::jsonb, 'legendary', 100, true, true, 22),

-- Game-type specific
('award_trivia_master', NULL, 'Trivia Master', 'Won 5 trivia games', '🧠', 'game_type', 'trivia',
 '{"type": "game_type_wins", "game_type": "trivia", "threshold": 5}'::jsonb, 'rare', 50, true, true, 30),
('award_sharpshooter', NULL, 'Sharpshooter', 'Won 5 Nerf target games', '🎯', 'game_type', 'nerf-target',
 '{"type": "game_type_wins", "game_type": "nerf-target", "threshold": 5}'::jsonb, 'rare', 50, true, true, 31),
('award_ping_pong_pro', NULL, 'Ping Pong Pro', 'Won 5 table tennis matches', '🏓', 'game_type', 'table-tennis',
 '{"type": "game_type_wins", "game_type": "table-tennis", "threshold": 5}'::jsonb, 'rare', 50, true, true, 32),
('award_puzzle_genius', NULL, 'Puzzle Genius', 'Won 5 puzzle challenges', '🧩', 'game_type', 'puzzle',
 '{"type": "game_type_wins", "game_type": "puzzle", "threshold": 5}'::jsonb, 'rare', 50, true, true, 33),
('award_speed_demon', NULL, 'Speed Demon', 'Won 5 time trial games', '⏱️', 'game_type', 'time-trial',
 '{"type": "game_type_wins", "game_type": "time-trial", "threshold": 5}'::jsonb, 'rare', 50, true, true, 34),

-- Team achievements
('award_team_player', NULL, 'Team Player', 'Joined your first team', '👥', 'team', NULL,
 '{"type": "team_joined", "threshold": 1}'::jsonb, 'common', 10, true, true, 40),
('award_team_champion', NULL, 'Team Champion', 'Won a team game', '🏆', 'team', NULL,
 '{"type": "team_wins", "threshold": 1}'::jsonb, 'uncommon', 25, true, true, 41),
('award_team_mvp', NULL, 'Team MVP', 'Top scorer in 5 team games', '⭐', 'team', NULL,
 '{"type": "team_top_scorer", "threshold": 5}'::jsonb, 'epic', 75, true, true, 42),

-- Special awards (manual)
('award_mvp', NULL, 'MVP', 'Most Valuable Player award', '🌟', 'special', NULL,
 '{"type": "manual"}'::jsonb, 'epic', 75, false, true, 50),
('award_sportsmanship', NULL, 'Good Sport', 'Exemplary sportsmanship', '🤝', 'special', NULL,
 '{"type": "manual"}'::jsonb, 'rare', 50, false, true, 51),
('award_most_improved', NULL, 'Most Improved', 'Showed significant improvement', '📈', 'special', NULL,
 '{"type": "manual"}'::jsonb, 'rare', 50, false, true, 52),
('award_crowd_favorite', NULL, 'Crowd Favorite', 'Fan favorite player', '❤️', 'special', NULL,
 '{"type": "manual"}'::jsonb, 'rare', 50, false, true, 53)

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    category = EXCLUDED.category,
    game_type = EXCLUDED.game_type,
    criteria = EXCLUDED.criteria,
    rarity = EXCLUDED.rarity,
    points_value = EXCLUDED.points_value,
    is_automatic = EXCLUDED.is_automatic,
    sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- PART 7: LEADERBOARD VIEW
-- ============================================================================

CREATE OR REPLACE VIEW public.game_leaderboard_individual AS
SELECT
    gs.membership_id,
    im.display_name,
    im.avatar,
    im.instance_id,
    gs.game_type,
    gs.games_played,
    gs.games_won,
    gs.total_score,
    gs.best_score,
    gs.average_score,
    gs.current_win_streak,
    gs.best_win_streak,
    CASE
        WHEN gs.games_played > 0
        THEN ROUND((gs.games_won::numeric / gs.games_played::numeric) * 100, 1)
        ELSE 0
    END as win_rate,
    RANK() OVER (
        PARTITION BY im.instance_id, gs.game_type
        ORDER BY gs.total_score DESC
    ) as rank_by_score,
    RANK() OVER (
        PARTITION BY im.instance_id, gs.game_type
        ORDER BY gs.games_won DESC
    ) as rank_by_wins
FROM public.game_stats gs
JOIN public.instance_memberships im ON im.id = gs.membership_id
WHERE im.status = 'active';

CREATE OR REPLACE VIEW public.game_leaderboard_teams AS
SELECT
    gt.id as team_id,
    gt.name as team_name,
    gt.icon,
    gt.color,
    gt.instance_id,
    (gt.team_stats->>'totalGames')::integer as total_games,
    (gt.team_stats->>'totalWins')::integer as total_wins,
    (gt.team_stats->>'totalPoints')::bigint as total_points,
    (gt.team_stats->>'winStreak')::integer as current_win_streak,
    (gt.team_stats->>'bestWinStreak')::integer as best_win_streak,
    CASE
        WHEN (gt.team_stats->>'totalGames')::integer > 0
        THEN ROUND(
            ((gt.team_stats->>'totalWins')::numeric / (gt.team_stats->>'totalGames')::numeric) * 100,
            1
        )
        ELSE 0
    END as win_rate,
    (SELECT COUNT(*) FROM public.game_team_members gtm WHERE gtm.team_id = gt.id AND gtm.status = 'active') as member_count,
    RANK() OVER (
        PARTITION BY gt.instance_id
        ORDER BY (gt.team_stats->>'totalPoints')::bigint DESC
    ) as rank_by_points,
    RANK() OVER (
        PARTITION BY gt.instance_id
        ORDER BY (gt.team_stats->>'totalWins')::integer DESC
    ) as rank_by_wins
FROM public.game_teams gt
WHERE gt.is_active = true;

-- ============================================================================
-- PART 8: UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_game_teams_updated_at ON public.game_teams;
CREATE TRIGGER update_game_teams_updated_at
    BEFORE UPDATE ON public.game_teams
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_awards_updated_at ON public.game_awards;
CREATE TRIGGER update_game_awards_updated_at
    BEFORE UPDATE ON public.game_awards
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

NOTIFY pgrst, 'reload schema';
