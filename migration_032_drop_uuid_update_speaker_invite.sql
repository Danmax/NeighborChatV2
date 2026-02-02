-- Migration 032: Drop UUID overload for update_speaker_invite_status
-- Date: 2026-02-02
-- Description: Keep TEXT signature to avoid ambiguity

BEGIN;

DROP FUNCTION IF EXISTS public.update_speaker_invite_status(UUID, TEXT, TEXT);

COMMIT;
