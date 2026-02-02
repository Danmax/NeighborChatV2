-- Migration 027: Fix speakers RLS policy for TEXT vs UUID
-- Date: 2026-02-02
-- Description: Ensure speakers table RLS works regardless of created_by_id type

BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "speakers_select_policy" ON public.speakers;
DROP POLICY IF EXISTS "speakers_insert_policy" ON public.speakers;
DROP POLICY IF EXISTS "speakers_update_policy" ON public.speakers;
DROP POLICY IF EXISTS "speakers_delete_policy" ON public.speakers;

-- Recreate policies with TEXT casting for safe comparison
CREATE POLICY "speakers_select_policy"
ON public.speakers FOR SELECT
TO authenticated
USING (
    is_public = true
    OR created_by_id::text = auth.uid()::text
);

CREATE POLICY "speakers_insert_policy"
ON public.speakers FOR INSERT
TO authenticated
WITH CHECK (
    created_by_id::text = auth.uid()::text
);

CREATE POLICY "speakers_update_policy"
ON public.speakers FOR UPDATE
TO authenticated
USING (created_by_id::text = auth.uid()::text)
WITH CHECK (created_by_id::text = auth.uid()::text);

CREATE POLICY "speakers_delete_policy"
ON public.speakers FOR DELETE
TO authenticated
USING (created_by_id::text = auth.uid()::text);

-- Also ensure speakers table has proper grants
GRANT SELECT ON public.speakers TO authenticated;
GRANT INSERT ON public.speakers TO authenticated;
GRANT UPDATE ON public.speakers TO authenticated;
GRANT DELETE ON public.speakers TO authenticated;

COMMIT;
