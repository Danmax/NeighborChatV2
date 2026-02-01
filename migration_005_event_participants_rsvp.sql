-- Migration 005: Event RSVP via event_participants
-- Date: 2026-01-31
-- Description: Enable RLS and policies for event_participants, add unique constraint

BEGIN;

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- Ensure unique RSVP per user per event
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'event_participants_unique'
          AND conrelid = 'public.event_participants'::regclass
    ) THEN
        ALTER TABLE public.event_participants
        ADD CONSTRAINT event_participants_unique
        UNIQUE (event_id, membership_id);
    END IF;
END $$;

-- Allow authenticated users to view participants for public events
DROP POLICY IF EXISTS "View event participants" ON public.event_participants;

CREATE POLICY "View event participants"
ON public.event_participants FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.community_events
        WHERE community_events.id = event_participants.event_id
          AND (
              community_events.visibility = 'public'
              OR community_events.created_by_id = auth.uid()
          )
    )
);

-- Allow authenticated users to RSVP for themselves
DROP POLICY IF EXISTS "Users RSVP to events" ON public.event_participants;

CREATE POLICY "Users RSVP to events"
ON public.event_participants FOR INSERT
TO authenticated
WITH CHECK (membership_id = auth.uid()::text);

-- Allow authenticated users to remove their RSVP
DROP POLICY IF EXISTS "Users remove RSVP" ON public.event_participants;

CREATE POLICY "Users remove RSVP"
ON public.event_participants FOR DELETE
TO authenticated
USING (membership_id = auth.uid()::text);

COMMIT;
