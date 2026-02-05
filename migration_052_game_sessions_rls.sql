-- Migration 052: RLS policies for game_sessions inserts
-- Date: 2026-02-05
-- Description: Allow authenticated instance members to create game sessions

BEGIN;

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_sessions_select_members" ON public.game_sessions;
DROP POLICY IF EXISTS "game_sessions_insert_members" ON public.game_sessions;
DROP POLICY IF EXISTS "game_sessions_update_host" ON public.game_sessions;

CREATE POLICY "game_sessions_select_members"
ON public.game_sessions FOR SELECT
TO authenticated
USING (is_instance_member(instance_id));

CREATE POLICY "game_sessions_insert_members"
ON public.game_sessions FOR INSERT
TO authenticated
WITH CHECK (
    is_instance_member(instance_id)
    AND host_membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = auth.uid()
          AND status = 'active'
          AND instance_id = game_sessions.instance_id
    )
);

CREATE POLICY "game_sessions_update_host"
ON public.game_sessions FOR UPDATE
TO authenticated
USING (
    host_membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = auth.uid()
          AND status = 'active'
          AND instance_id = game_sessions.instance_id
    )
)
WITH CHECK (
    host_membership_id IN (
        SELECT id
        FROM public.instance_memberships
        WHERE user_id = auth.uid()
          AND status = 'active'
          AND instance_id = game_sessions.instance_id
    )
);

COMMIT;
