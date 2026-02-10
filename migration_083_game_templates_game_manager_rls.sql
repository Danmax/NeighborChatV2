-- Migration 083: Allow game managers to manage game templates
-- Date: 2026-02-10
-- Description: Extend game_templates RLS so active game managers can create/update/delete

BEGIN;

ALTER TABLE public.game_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_templates_insert" ON public.game_templates;
CREATE POLICY "game_templates_insert"
ON public.game_templates FOR INSERT
TO authenticated
WITH CHECK (
    instance_id IS NOT NULL
    AND (
        EXISTS (
            SELECT 1 FROM public.instance_memberships im
            WHERE im.user_id = public.current_user_uuid()
              AND im.instance_id = game_templates.instance_id
              AND im.role IN ('admin', 'moderator')
              AND im.status = 'active'
        )
        OR EXISTS (
            SELECT 1 FROM public.game_roles gr
            WHERE gr.user_id = public.current_user_uuid()
              AND gr.instance_id = game_templates.instance_id
              AND gr.role = 'game_manager'
              AND gr.is_active = true
              AND (gr.expires_at IS NULL OR gr.expires_at > now())
        )
    )
);

DROP POLICY IF EXISTS "game_templates_update" ON public.game_templates;
CREATE POLICY "game_templates_update"
ON public.game_templates FOR UPDATE
TO authenticated
USING (
    instance_id IS NOT NULL
    AND (
        EXISTS (
            SELECT 1 FROM public.instance_memberships im
            WHERE im.user_id = public.current_user_uuid()
              AND im.instance_id = game_templates.instance_id
              AND im.role IN ('admin', 'moderator')
              AND im.status = 'active'
        )
        OR EXISTS (
            SELECT 1 FROM public.game_roles gr
            WHERE gr.user_id = public.current_user_uuid()
              AND gr.instance_id = game_templates.instance_id
              AND gr.role = 'game_manager'
              AND gr.is_active = true
              AND (gr.expires_at IS NULL OR gr.expires_at > now())
        )
    )
)
WITH CHECK (
    instance_id IS NOT NULL
    AND (
        EXISTS (
            SELECT 1 FROM public.instance_memberships im
            WHERE im.user_id = public.current_user_uuid()
              AND im.instance_id = game_templates.instance_id
              AND im.role IN ('admin', 'moderator')
              AND im.status = 'active'
        )
        OR EXISTS (
            SELECT 1 FROM public.game_roles gr
            WHERE gr.user_id = public.current_user_uuid()
              AND gr.instance_id = game_templates.instance_id
              AND gr.role = 'game_manager'
              AND gr.is_active = true
              AND (gr.expires_at IS NULL OR gr.expires_at > now())
        )
    )
);

DROP POLICY IF EXISTS "game_templates_delete" ON public.game_templates;
CREATE POLICY "game_templates_delete"
ON public.game_templates FOR DELETE
TO authenticated
USING (
    instance_id IS NOT NULL
    AND (
        EXISTS (
            SELECT 1 FROM public.instance_memberships im
            WHERE im.user_id = public.current_user_uuid()
              AND im.instance_id = game_templates.instance_id
              AND im.role IN ('admin', 'moderator')
              AND im.status = 'active'
        )
        OR EXISTS (
            SELECT 1 FROM public.game_roles gr
            WHERE gr.user_id = public.current_user_uuid()
              AND gr.instance_id = game_templates.instance_id
              AND gr.role = 'game_manager'
              AND gr.is_active = true
              AND (gr.expires_at IS NULL OR gr.expires_at > now())
        )
    )
);

COMMIT;

NOTIFY pgrst, 'reload schema';
