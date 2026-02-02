-- Migration 030: Drop UUID overload for invite_speaker to avoid ambiguity
-- Date: 2026-02-02
-- Description: Keep TEXT invite_speaker signature only

BEGIN;

DROP FUNCTION IF EXISTS public.invite_speaker(UUID, UUID, TEXT, TEXT, INTEGER);

COMMIT;
