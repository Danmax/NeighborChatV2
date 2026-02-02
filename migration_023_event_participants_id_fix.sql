-- Migration 023: Fix event_participants id default + remove ambiguous RPC overloads
-- Date: 2026-02-01
-- Description: Ensure event_participants.id auto-generates and drop UUID overloads

BEGIN;

-- Ensure id defaults to gen_random_uuid()
ALTER TABLE public.event_participants
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop UUID overloads to avoid RPC ambiguity
DROP FUNCTION IF EXISTS public.add_event_item_v2(UUID, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.claim_event_item_v2(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.rsvp_event_v2(UUID, TEXT, INTEGER, TEXT);

COMMIT;
