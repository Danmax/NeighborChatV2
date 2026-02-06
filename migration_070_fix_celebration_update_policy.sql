-- Migration 070: Allow celebration owners to update (and claim orphaned rows)
-- Date: 2026-02-06
-- Description: Adjust update policy to permit owner updates and fix null author_id rows

BEGIN;

DROP POLICY IF EXISTS celebrations_update_own ON public.celebrations;

CREATE POLICY celebrations_update_own
ON public.celebrations FOR UPDATE
TO authenticated
USING (
    author_id = public.current_user_uuid()
    OR author_id IS NULL
)
WITH CHECK (author_id = public.current_user_uuid());

COMMIT;

NOTIFY pgrst, 'reload schema';
