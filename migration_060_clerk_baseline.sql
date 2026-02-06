-- Migration 060: Clerk-first baseline schema (full rebuild)
-- Date: 2026-02-05
-- Description: Drop all public tables and recreate with Clerk-first auth model

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop all public tables (destructive)
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    END LOOP;
END $$;

-- Clerk helpers
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT auth.jwt() ->> 'sub';
$$;

CREATE TABLE public.user_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE,
  display_name text,
  real_name text,
  email text,
  phone text,
  location text,
  birthday date,
  title text,
  linkedin text,
  profile_image_url text,
  interests jsonb DEFAULT '[]'::jsonb,
  avatar jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  city text,
  magic_email text,
  onboarding_completed boolean DEFAULT false,
  first_login_at timestamp with time zone,
  created_from_guest boolean DEFAULT false,
  previous_guest_id text,
  username text CHECK (username IS NULL OR length(username) >= 3 AND length(username) <= 30 AND username ~ '^[a-z0-9_]+$'::text),
  bio text CHECK (bio IS NULL OR length(bio) <= 200),
  banner_color character varying DEFAULT '#4CAF50'::character varying CHECK (banner_color::text ~ '^#[0-9A-Fa-f]{6}$'::text),
  banner_pattern character varying DEFAULT 'solid'::character varying,
  show_city boolean DEFAULT true,
  show_phone boolean DEFAULT false,
  show_email boolean DEFAULT false,
  show_birthday boolean DEFAULT false,
  show_interests boolean DEFAULT true,
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'event_manager'::text])),
  banner_image_url text,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id)
);

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

    PERFORM set_config('row_security', 'off', true);

    SELECT id INTO v_user_id
    FROM public.user_profiles
    WHERE clerk_user_id = v_clerk_id
    LIMIT 1;

    IF v_user_id IS NULL THEN
        INSERT INTO public.user_profiles (clerk_user_id, created_at, updated_at)
        VALUES (v_clerk_id, now(), now())
        ON CONFLICT (clerk_user_id) DO NOTHING
        RETURNING id INTO v_user_id;

        IF v_user_id IS NULL THEN
            SELECT id INTO v_user_id
            FROM public.user_profiles
            WHERE clerk_user_id = v_clerk_id
            LIMIT 1;
        END IF;
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

-- Reference tables
CREATE TABLE public.community_instances (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  logo text DEFAULT '🏘️'::text,
  banner_url text,
  instance_type text DEFAULT 'neighborhood'::text,
  settings jsonb DEFAULT '{"theme": "default", "maxMembers": null, "enableGames": true, "enableAwards": true, "enableEvents": true, "enableSponsors": true, "enableKnowledge": true, "requireApproval": false, "allowGuestAccess": true}'::jsonb,
  enabled_features jsonb DEFAULT '["games", "events", "celebrations", "chat", "awards"]'::jsonb,
  admin_ids jsonb DEFAULT '[]'::jsonb,
  moderator_ids jsonb DEFAULT '[]'::jsonb,
  invite_code text,
  is_public boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT community_instances_pkey PRIMARY KEY (id)
);

CREATE TABLE public.status_options (
  id text NOT NULL,
  label text NOT NULL,
  color text NOT NULL,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  CONSTRAINT status_options_pkey PRIMARY KEY (id)
);

CREATE TABLE public.interest_options (
  id text NOT NULL,
  label text NOT NULL,
  emoji text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  CONSTRAINT interest_options_pkey PRIMARY KEY (id)
);

-- Profiles & memberships
CREATE TABLE public.master_profiles (
  id uuid NOT NULL,
  full_name text,
  email text,
  phone text,
  linkedin text,
  birthday date,
  bio text,
  photo_url text,
  address text,
  city text,
  all_interests jsonb DEFAULT '[]'::jsonb,
  skills jsonb DEFAULT '[]'::jsonb,
  total_points integer DEFAULT 0,
  total_games_played integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  achievements jsonb DEFAULT '[]'::jsonb,
  default_avatar jsonb DEFAULT '{"emoji1": "😊", "background": "#E8F5E9"}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT master_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT master_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.instance_memberships (
  id text NOT NULL,
  user_id uuid,
  instance_id text,
  display_name text NOT NULL,
  avatar jsonb DEFAULT '{}'::jsonb,
  shared_interests jsonb DEFAULT '[]'::jsonb,
  privacy_settings jsonb DEFAULT '{"showEmail": false, "showPhone": false, "allowInvites": true, "showBirthday": false, "showLinkedIn": false, "showRealName": false, "showGameStats": true, "allowDirectChat": true, "locationPrecision": "none"}'::jsonb,
  shared_location text,
  role text DEFAULT 'member'::text,
  status text DEFAULT 'active'::text,
  instance_points integer DEFAULT 0,
  instance_level integer DEFAULT 1,
  badges jsonb DEFAULT '[]'::jsonb,
  joined_at timestamp with time zone DEFAULT now(),
  last_active_at timestamp with time zone DEFAULT now(),
  CONSTRAINT instance_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT instance_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id),
  CONSTRAINT instance_memberships_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id)
);

-- Events
CREATE TABLE public.community_events (
  id text NOT NULL,
  type text NOT NULL DEFAULT 'meetup'::text,
  name text NOT NULL,
  date timestamp with time zone NOT NULL,
  location text,
  description text,
  created_by text NOT NULL,
  created_by_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  participants text[] DEFAULT ARRAY[]::text[],
  visibility text DEFAULT 'public'::text,
  archived boolean DEFAULT false,
  event_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'published'::text CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'closed'::text])),
  capacity integer,
  join_policy text DEFAULT 'open'::text CHECK (join_policy = ANY (ARRAY['open'::text, 'approval'::text])),
  meeting_link text,
  settings jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT community_events_pkey PRIMARY KEY (id),
  CONSTRAINT community_events_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.event_participants (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  event_id text,
  membership_id text,
  status text DEFAULT 'registered'::text,
  role text DEFAULT 'attendee'::text,
  registered_at timestamp with time zone DEFAULT now(),
  checked_in_at timestamp with time zone,
  feedback_rating integer,
  feedback_text text,
  rsvp_status text DEFAULT 'going'::text CHECK (rsvp_status = ANY (ARRAY['going'::text, 'maybe'::text, 'not_going'::text, 'pending'::text])),
  guest_count integer DEFAULT 0,
  checked_in boolean DEFAULT false,
  notes text,
  approval_status text DEFAULT 'approved'::text CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_participants_pkey PRIMARY KEY (id),
  CONSTRAINT event_participants_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.instance_memberships(id),
  CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.community_events(id)
);

CREATE TABLE public.event_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  user_id uuid NOT NULL,
  membership_id text,
  body text NOT NULL,
  message_type text NOT NULL DEFAULT 'text'::text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT event_chat_messages_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.community_events(id),
  CONSTRAINT event_chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.event_manager_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_manager_requests_pkey PRIMARY KEY (id),
  CONSTRAINT event_manager_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id),
  CONSTRAINT event_manager_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.user_profiles(id)
);

-- Celebrations
CREATE TABLE public.celebrations (
  id text NOT NULL,
  type text NOT NULL DEFAULT 'birthday'::text,
  message text NOT NULL,
  honoree text,
  recipient_name text,
  recipient_id uuid,
  author_id uuid,
  author_name text NOT NULL,
  timestamp_ms bigint NOT NULL,
  emoji text DEFAULT '🎂'::text,
  created_at timestamp with time zone DEFAULT now(),
  reactions jsonb DEFAULT '{}'::jsonb,
  comments jsonb DEFAULT '[]'::jsonb,
  visibility text DEFAULT 'public'::text,
  archived boolean DEFAULT false,
  gif_url text,
  celebration_date date,
  image_url text,
  CONSTRAINT celebrations_pkey PRIMARY KEY (id),
  CONSTRAINT celebrations_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.user_profiles(id),
  CONSTRAINT celebrations_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.user_profiles(id)
);

-- Messaging
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  message_type text DEFAULT 'direct'::text,
  subject text,
  body text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id),
  CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT message_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.saved_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  contact_user_id uuid,
  contact_name text,
  contact_avatar jsonb,
  contact_interests jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  favorite boolean DEFAULT false,
  CONSTRAINT saved_contacts_pkey PRIMARY KEY (id),
  CONSTRAINT saved_contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.user_profiles(id),
  CONSTRAINT saved_contacts_contact_user_id_fkey FOREIGN KEY (contact_user_id) REFERENCES public.user_profiles(id)
);

-- Notifications & feedback
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  link text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  category text NOT NULL DEFAULT 'issue'::text CHECK (category = ANY (ARRAY['issue'::text, 'bug'::text, 'question'::text, 'feature'::text])),
  title text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text, 'closed'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.favorite_movies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  movie_id text NOT NULL,
  source text NOT NULL DEFAULT 'tmdb'::text,
  title text NOT NULL,
  poster_url text,
  year integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT favorite_movies_pkey PRIMARY KEY (id),
  CONSTRAINT favorite_movies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

-- Games
CREATE TABLE public.game_templates (
  id text NOT NULL,
  instance_id text,
  name text NOT NULL,
  description text,
  icon text DEFAULT '🎮'::text,
  cover_image_url text,
  game_type text NOT NULL,
  category text DEFAULT 'general'::text,
  config jsonb DEFAULT '{}'::jsonb,
  rules jsonb DEFAULT '{}'::jsonb,
  min_players integer DEFAULT 2,
  max_players integer,
  estimated_duration_minutes integer,
  ai_generated boolean DEFAULT false,
  ai_prompt text,
  ai_model text,
  is_template boolean DEFAULT true,
  is_public boolean DEFAULT false,
  use_count integer DEFAULT 0,
  created_by_membership_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_templates_pkey PRIMARY KEY (id),
  CONSTRAINT game_templates_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES public.instance_memberships(id),
  CONSTRAINT game_templates_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id)
);

-- General events (calendar)
CREATE TABLE public.events (
  id text NOT NULL,
  instance_id text,
  name text NOT NULL,
  description text,
  event_type text DEFAULT 'general'::text,
  category text,
  start_datetime timestamp with time zone NOT NULL,
  end_datetime timestamp with time zone,
  timezone text DEFAULT 'America/New_York'::text,
  is_all_day boolean DEFAULT false,
  recurrence_rule text,
  parent_event_id text,
  location_type text DEFAULT 'in_person'::text,
  location_name text,
  location_address text,
  virtual_link text,
  max_participants integer,
  waitlist_enabled boolean DEFAULT false,
  registration_required boolean DEFAULT false,
  registration_deadline timestamp with time zone,
  registration_fee numeric,
  linked_game_sessions jsonb DEFAULT '[]'::jsonb,
  cover_image_url text,
  attachments jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'scheduled'::text,
  visibility text DEFAULT 'public'::text,
  created_by_membership_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT events_parent_event_id_fkey FOREIGN KEY (parent_event_id) REFERENCES public.events(id),
  CONSTRAINT events_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES public.instance_memberships(id)
);

CREATE TABLE public.workshops (
  id text NOT NULL,
  event_id text,
  instance_id text,
  title text NOT NULL,
  description text,
  skill_level text DEFAULT 'all'::text,
  topics jsonb DEFAULT '[]'::jsonb,
  learning_objectives jsonb DEFAULT '[]'::jsonb,
  prerequisites jsonb DEFAULT '[]'::jsonb,
  materials jsonb DEFAULT '[]'::jsonb,
  instructor_membership_id text,
  instructor_name text,
  instructor_bio text,
  completion_criteria jsonb DEFAULT '{}'::jsonb,
  certificate_template_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workshops_pkey PRIMARY KEY (id),
  CONSTRAINT workshops_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT workshops_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT workshops_instructor_membership_id_fkey FOREIGN KEY (instructor_membership_id) REFERENCES public.instance_memberships(id)
);

CREATE TABLE public.seasons (
  id text NOT NULL,
  instance_id text,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'upcoming'::text,
  scoring_rules jsonb DEFAULT '{"pointsPerWin": 10, "bonusMultipliers": {}, "pointsPerParticipation": 1}'::jsonb,
  prizes jsonb DEFAULT '[]'::jsonb,
  final_standings jsonb,
  champion_membership_id text,
  created_by_membership_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT seasons_pkey PRIMARY KEY (id),
  CONSTRAINT seasons_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT seasons_champion_membership_id_fkey FOREIGN KEY (champion_membership_id) REFERENCES public.instance_memberships(id),
  CONSTRAINT seasons_created_by_membership_id_fkey FOREIGN KEY (created_by_membership_id) REFERENCES public.instance_memberships(id)
);

CREATE TABLE public.game_sessions (
  id text NOT NULL,
  instance_id text,
  template_id text,
  season_id text,
  name text NOT NULL,
  description text,
  scheduled_start timestamp with time zone,
  actual_start timestamp with time zone,
  ended_at timestamp with time zone,
  status text DEFAULT 'scheduled'::text,
  game_state jsonb DEFAULT '{}'::jsonb,
  settings jsonb DEFAULT '{"isRanked": true, "visibility": "instance", "allowLateJoin": true}'::jsonb,
  host_membership_id text,
  results jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT game_sessions_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT game_sessions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.game_templates(id),
  CONSTRAINT game_sessions_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id),
  CONSTRAINT game_sessions_host_membership_id_fkey FOREIGN KEY (host_membership_id) REFERENCES public.instance_memberships(id)
);

CREATE TABLE public.game_players (
  id text NOT NULL,
  session_id text,
  membership_id text,
  status text DEFAULT 'joined'::text,
  player_state jsonb DEFAULT '{}'::jsonb,
  final_score integer,
  final_rank integer,
  points_earned integer DEFAULT 0,
  joined_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone,
  CONSTRAINT game_players_pkey PRIMARY KEY (id),
  CONSTRAINT game_players_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id),
  CONSTRAINT game_players_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.instance_memberships(id)
);

CREATE TABLE public.game_stats (
  id text NOT NULL,
  membership_id text,
  game_type text NOT NULL,
  games_played integer DEFAULT 0,
  games_won integer DEFAULT 0,
  total_score bigint DEFAULT 0,
  best_score integer,
  average_score numeric,
  current_win_streak integer DEFAULT 0,
  best_win_streak integer DEFAULT 0,
  detailed_stats jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_stats_pkey PRIMARY KEY (id),
  CONSTRAINT game_stats_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.instance_memberships(id)
);

CREATE TABLE public.training_paths (
  id text NOT NULL,
  instance_id text,
  name text NOT NULL,
  description text,
  icon text DEFAULT '🎓'::text,
  items jsonb DEFAULT '[]'::jsonb,
  completion_award_type_id text,
  completion_points integer DEFAULT 0,
  estimated_hours numeric,
  difficulty_level text DEFAULT 'beginner'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT training_paths_pkey PRIMARY KEY (id),
  CONSTRAINT training_paths_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id)
);

CREATE TABLE public.training_progress (
  id text NOT NULL,
  membership_id text,
  path_id text,
  completed_items jsonb DEFAULT '[]'::jsonb,
  current_item_index integer DEFAULT 0,
  status text DEFAULT 'in_progress'::text,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  total_score integer,
  CONSTRAINT training_progress_pkey PRIMARY KEY (id),
  CONSTRAINT training_progress_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.instance_memberships(id),
  CONSTRAINT training_progress_path_id_fkey FOREIGN KEY (path_id) REFERENCES public.training_paths(id)
);

CREATE TABLE public.award_types (
  id text NOT NULL,
  instance_id text,
  name text NOT NULL,
  description text,
  icon text DEFAULT '🏆'::text,
  badge_image_url text,
  category text DEFAULT 'general'::text,
  criteria jsonb DEFAULT '{}'::jsonb,
  rarity text DEFAULT 'common'::text,
  points_value integer DEFAULT 0,
  max_per_person integer,
  max_per_period text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT award_types_pkey PRIMARY KEY (id),
  CONSTRAINT award_types_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id)
);

ALTER TABLE public.training_paths
ADD CONSTRAINT training_paths_completion_award_type_id_fkey
FOREIGN KEY (completion_award_type_id) REFERENCES public.award_types(id);

CREATE TABLE public.awards (
  id text NOT NULL,
  award_type_id text,
  instance_id text,
  recipient_membership_id text,
  reason text,
  related_event_id text,
  related_game_session_id text,
  related_season_id text,
  given_by_membership_id text,
  nomination_id text,
  awarded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT awards_pkey PRIMARY KEY (id),
  CONSTRAINT awards_award_type_id_fkey FOREIGN KEY (award_type_id) REFERENCES public.award_types(id),
  CONSTRAINT awards_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT awards_recipient_membership_id_fkey FOREIGN KEY (recipient_membership_id) REFERENCES public.instance_memberships(id),
  CONSTRAINT awards_related_event_id_fkey FOREIGN KEY (related_event_id) REFERENCES public.events(id),
  CONSTRAINT awards_related_game_session_id_fkey FOREIGN KEY (related_game_session_id) REFERENCES public.game_sessions(id),
  CONSTRAINT awards_related_season_id_fkey FOREIGN KEY (related_season_id) REFERENCES public.seasons(id),
  CONSTRAINT awards_given_by_membership_id_fkey FOREIGN KEY (given_by_membership_id) REFERENCES public.instance_memberships(id)
);

-- Knowledge base
CREATE TABLE public.knowledge_categories (
  id text NOT NULL,
  instance_id text,
  name text NOT NULL,
  description text,
  icon text DEFAULT '📚'::text,
  parent_category_id text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT knowledge_categories_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_categories_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT knowledge_categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.knowledge_categories(id)
);

CREATE TABLE public.knowledge_articles (
  id text NOT NULL,
  instance_id text,
  category_id text,
  title text NOT NULL,
  slug text,
  summary text,
  content text,
  cover_image_url text,
  attachments jsonb DEFAULT '[]'::jsonb,
  tags jsonb DEFAULT '[]'::jsonb,
  difficulty_level text,
  estimated_read_time integer,
  author_membership_id text,
  status text DEFAULT 'draft'::text,
  published_at timestamp with time zone,
  view_count integer DEFAULT 0,
  helpful_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT knowledge_articles_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_articles_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT knowledge_articles_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.knowledge_categories(id),
  CONSTRAINT knowledge_articles_author_membership_id_fkey FOREIGN KEY (author_membership_id) REFERENCES public.instance_memberships(id)
);

-- Chat
CREATE TABLE public.chat_sessions (
  id text NOT NULL,
  instance_id text,
  participant1_membership_id text,
  participant2_membership_id text,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  duration_minutes integer,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT chat_sessions_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT chat_sessions_participant1_membership_id_fkey FOREIGN KEY (participant1_membership_id) REFERENCES public.instance_memberships(id),
  CONSTRAINT chat_sessions_participant2_membership_id_fkey FOREIGN KEY (participant2_membership_id) REFERENCES public.instance_memberships(id)
);

CREATE TABLE public.chat_messages (
  id text NOT NULL,
  instance_id text,
  session_id text,
  channel text,
  category text,
  sender_membership_id text,
  sender_name text,
  sender_avatar jsonb,
  message_type text DEFAULT 'text'::text,
  content text,
  gif_url text,
  game_session_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id),
  CONSTRAINT chat_messages_sender_membership_id_fkey FOREIGN KEY (sender_membership_id) REFERENCES public.instance_memberships(id),
  CONSTRAINT chat_messages_game_session_id_fkey FOREIGN KEY (game_session_id) REFERENCES public.game_sessions(id)
);

-- AI / app settings / misc
CREATE TABLE public.ai_generation_requests (
  id text NOT NULL,
  instance_id text,
  membership_id text,
  request_type text NOT NULL,
  prompt text NOT NULL,
  parameters jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending'::text,
  result jsonb,
  error_message text,
  model_used text,
  tokens_used integer,
  created_template_id text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT ai_generation_requests_pkey PRIMARY KEY (id),
  CONSTRAINT ai_generation_requests_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT ai_generation_requests_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.instance_memberships(id),
  CONSTRAINT ai_generation_requests_created_template_id_fkey FOREIGN KEY (created_template_id) REFERENCES public.game_templates(id)
);

CREATE TABLE public.app_settings (
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (key),
  CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  instance_id text,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.movie_cache (
  cache_key text NOT NULL,
  data jsonb NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT movie_cache_pkey PRIMARY KEY (cache_key)
);

CREATE TABLE public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action_type text NOT NULL,
  instance_id text,
  attempt_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rate_limits_pkey PRIMARY KEY (id),
  CONSTRAINT rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

-- Content
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  ingredients jsonb DEFAULT '[]'::jsonb,
  instructions text,
  prep_time integer,
  cook_time integer,
  servings integer,
  tags text[] DEFAULT '{}'::text[],
  image_url text,
  is_public boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.speakers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by_id uuid NOT NULL,
  name text NOT NULL,
  title text,
  company text,
  bio text,
  headshot_url text,
  email text,
  social_links jsonb DEFAULT '{}'::jsonb,
  is_public boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT speakers_pkey PRIMARY KEY (id),
  CONSTRAINT speakers_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.user_profiles(id)
);

-- Sponsors / prizes
CREATE TABLE public.sponsors (
  id text NOT NULL,
  instance_id text,
  name text NOT NULL,
  description text,
  logo_url text,
  website_url text,
  contact_name text,
  contact_email text,
  tier text DEFAULT 'supporter'::text,
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  sponsored_items jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sponsors_pkey PRIMARY KEY (id),
  CONSTRAINT sponsors_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id)
);

CREATE TABLE public.prizes (
  id text NOT NULL,
  instance_id text,
  name text NOT NULL,
  description text,
  image_url text,
  value_type text DEFAULT 'item'::text,
  value_amount numeric,
  sponsor_id text,
  event_id text,
  season_id text,
  game_session_id text,
  winner_membership_id text,
  awarded_at timestamp with time zone,
  claimed_at timestamp with time zone,
  status text DEFAULT 'available'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prizes_pkey PRIMARY KEY (id),
  CONSTRAINT prizes_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.community_instances(id),
  CONSTRAINT prizes_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id),
  CONSTRAINT prizes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT prizes_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id),
  CONSTRAINT prizes_game_session_id_fkey FOREIGN KEY (game_session_id) REFERENCES public.game_sessions(id),
  CONSTRAINT prizes_winner_membership_id_fkey FOREIGN KEY (winner_membership_id) REFERENCES public.instance_memberships(id)
);

-- Gift exchange
CREATE TABLE public.gift_exchange_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  giver_user_id uuid NOT NULL,
  receiver_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'approved'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gift_exchange_matches_pkey PRIMARY KEY (id),
  CONSTRAINT gift_exchange_matches_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.community_events(id),
  CONSTRAINT gift_exchange_matches_giver_user_id_fkey FOREIGN KEY (giver_user_id) REFERENCES public.user_profiles(id),
  CONSTRAINT gift_exchange_matches_receiver_user_id_fkey FOREIGN KEY (receiver_user_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.gift_exchange_wishlist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  url text,
  price_range text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gift_exchange_wishlist_items_pkey PRIMARY KEY (id),
  CONSTRAINT gift_exchange_wishlist_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.community_events(id),
  CONSTRAINT gift_exchange_wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

CREATE TABLE public.gift_exchange_wishlist_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  url text,
  price_range text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gift_exchange_wishlist_templates_pkey PRIMARY KEY (id),
  CONSTRAINT gift_exchange_wishlist_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);

COMMIT;
