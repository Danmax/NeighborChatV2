-- Migration 017: Enhanced Events System
-- Add new columns to community_events and event_participants for enhanced functionality

-- ============================================
-- COMMUNITY_EVENTS TABLE ENHANCEMENTS
-- ============================================

-- Add status column for draft/published/closed workflow
ALTER TABLE public.community_events
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';

-- Add check constraint for status (done separately to handle existing data)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'community_events_status_check'
    ) THEN
        ALTER TABLE public.community_events
        ADD CONSTRAINT community_events_status_check
        CHECK (status IN ('draft', 'published', 'closed'));
    END IF;
END $$;

-- Add capacity column for event size limits
ALTER TABLE public.community_events
ADD COLUMN IF NOT EXISTS capacity INTEGER;

-- Add join_policy for open vs approval-required events
ALTER TABLE public.community_events
ADD COLUMN IF NOT EXISTS join_policy TEXT DEFAULT 'open';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'community_events_join_policy_check'
    ) THEN
        ALTER TABLE public.community_events
        ADD CONSTRAINT community_events_join_policy_check
        CHECK (join_policy IN ('open', 'approval'));
    END IF;
END $$;

-- Add meeting_link for virtual events (Zoom, etc.)
ALTER TABLE public.community_events
ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Add settings JSONB for type-specific configuration
ALTER TABLE public.community_events
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add updated_at for RPCs that touch it
ALTER TABLE public.community_events
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- EVENT_PARTICIPANTS TABLE ENHANCEMENTS
-- ============================================

-- Add rsvp_status for going/maybe/not_going
ALTER TABLE public.event_participants
ADD COLUMN IF NOT EXISTS rsvp_status TEXT DEFAULT 'going';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'event_participants_rsvp_status_check'
    ) THEN
        ALTER TABLE public.event_participants
        ADD CONSTRAINT event_participants_rsvp_status_check
        CHECK (rsvp_status IN ('going', 'maybe', 'not_going', 'pending'));
    END IF;
END $$;

-- Add guest_count for plus-ones
ALTER TABLE public.event_participants
ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 0;

-- Add checked_in for event day tracking
ALTER TABLE public.event_participants
ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT false;

-- Add notes for participant comments
ALTER TABLE public.event_participants
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add approval status for approval-required events
ALTER TABLE public.event_participants
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'event_participants_approval_status_check'
    ) THEN
        ALTER TABLE public.event_participants
        ADD CONSTRAINT event_participants_approval_status_check
        CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for filtering events by status
CREATE INDEX IF NOT EXISTS idx_community_events_status
ON public.community_events(status);

-- Index for filtering participants by rsvp_status
CREATE INDEX IF NOT EXISTS idx_event_participants_rsvp_status
ON public.event_participants(rsvp_status);

-- Index for filtering participants by approval_status
CREATE INDEX IF NOT EXISTS idx_event_participants_approval_status
ON public.event_participants(approval_status);

-- Composite index for event + rsvp status queries
CREATE INDEX IF NOT EXISTS idx_event_participants_event_rsvp
ON public.event_participants(event_id, rsvp_status);

-- ============================================
-- UPDATE EXISTING EVENTS (set defaults)
-- ============================================

-- Ensure all existing events have status = 'published'
UPDATE public.community_events
SET status = 'published'
WHERE status IS NULL;

-- Ensure all existing participants have rsvp_status = 'going'
UPDATE public.event_participants
SET rsvp_status = 'going'
WHERE rsvp_status IS NULL;

-- Ensure all existing participants have approval_status = 'approved'
UPDATE public.event_participants
SET approval_status = 'approved'
WHERE approval_status IS NULL;
