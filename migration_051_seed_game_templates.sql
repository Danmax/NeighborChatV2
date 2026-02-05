-- Migration 051: Seed game play templates
-- Date: 2026-02-04
-- Description: Add example game templates with teams, points, rules, and sessions

BEGIN;

INSERT INTO public.game_templates (
    id,
    instance_id,
    name,
    description,
    icon,
    game_type,
    category,
    config,
    rules,
    min_players,
    max_players,
    estimated_duration_minutes,
    is_template,
    is_public,
    created_at
) VALUES
(
    'game_tpl_minute_to_win_it',
    NULL,
    'Minute to Win It Challenge',
    'Fast-paced mini challenges with quick rounds, team points, and a final championship heat.',
    '⏱️',
    'minute-to-win-it',
    'party',
    '{"teams": {"mode": "squads", "size": 4}, "scoring": {"win": 10, "participation": 2, "bonus": 5}, "scoreboard": "team", "sessions": {"duration_minutes": 45, "rounds": 6, "heat_format": "single"}, "stages": ["Meet", "Heat", "Final"], "prizes": "Top 3 teams", "winner_rules": "Highest total points"}',
    '{"list": ["Teams rotate through stations", "Each round is capped at 60 seconds", "Bonus points for style", "Tie-breaker: sudden-death heat"]}',
    8,
    40,
    60,
    true,
    true,
    now()
),
(
    'game_tpl_trivia_league',
    NULL,
    'Trivia League Night',
    'Multi-round trivia with teams, themed categories, and a live scoreboard.',
    '🧠',
    'trivia',
    'knowledge',
    '{"teams": {"mode": "tables", "size": 5}, "scoring": {"correct": 5, "bonus": 2, "streak": 3}, "scoreboard": "team", "sessions": {"duration_minutes": 60, "rounds": 5, "heat_format": "multi"}, "stages": ["Meet", "Rounds", "Championship"], "sponsors": "Local cafe", "prizes": "Gift cards", "winner_rules": "Highest round total"}',
    '{"list": ["No phones during rounds", "One answer per team", "Final round is double points", "Host resolves disputes"]}',
    6,
    60,
    75,
    true,
    true,
    now()
),
(
    'game_tpl_bar_games_tournament',
    NULL,
    'Bar Games Tournament',
    'Bracket-style tournament for skills checks and bar classics with heats and finals.',
    '🏆',
    'tournament',
    'skills',
    '{"teams": {"mode": "solo", "size": 1}, "scoring": {"win": 1, "loss": 0}, "scoreboard": "bracket", "sessions": {"duration_minutes": 90, "rounds": 4, "heat_format": "bracket"}, "stages": ["Meet", "Heats", "Semis", "Finals"], "sponsors": "Community partners", "prizes": "Trophy + swag", "winner_rules": "Bracket champion"}',
    '{"list": ["Single elimination", "Best of 3 in finals", "Heats limited to 10 minutes", "Sportsmanship required"]}',
    4,
    64,
    90,
    true,
    true,
    now()
),
(
    'game_tpl_skills_check',
    NULL,
    'Skills Check Gauntlet',
    'Timed skill stations with cumulative points and a final scoreboard.',
    '🎯',
    'skills-check',
    'skills',
    '{"teams": {"mode": "pairs", "size": 2}, "scoring": {"completion": 8, "speed_bonus": 4}, "scoreboard": "team", "sessions": {"duration_minutes": 50, "rounds": 5, "heat_format": "relay"}, "stages": ["Meet", "Stations", "Final"], "prizes": "Achievement badges", "winner_rules": "Highest skill score"}',
    '{"list": ["Teams must complete all stations", "Points scale with speed", "No skipping stations", "Organizer verifies scores"]}',
    6,
    32,
    60,
    true,
    true,
    now()
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
    estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
    is_template = EXCLUDED.is_template,
    is_public = EXCLUDED.is_public,
    created_at = EXCLUDED.created_at;

COMMIT;
