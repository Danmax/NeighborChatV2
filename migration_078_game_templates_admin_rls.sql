-- Migration 078: Game Templates Admin RLS Policies
-- Date: 2026-02-08
-- Description: Add RLS policies for admins/moderators to create, update, delete game templates

BEGIN;

-- ============================================================================
-- RLS POLICIES FOR game_templates
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE public.game_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate cleanly)
DROP POLICY IF EXISTS "game_templates_select" ON public.game_templates;
DROP POLICY IF EXISTS "game_templates_insert" ON public.game_templates;
DROP POLICY IF EXISTS "game_templates_update" ON public.game_templates;
DROP POLICY IF EXISTS "game_templates_delete" ON public.game_templates;

-- SELECT: Anyone authenticated can view public templates or templates from their instance
CREATE POLICY "game_templates_select"
ON public.game_templates FOR SELECT
TO authenticated
USING (
    is_public = true
    OR instance_id IS NULL
    OR is_instance_member(instance_id)
);

-- INSERT: Admins and moderators can create templates for their instance
CREATE POLICY "game_templates_insert"
ON public.game_templates FOR INSERT
TO authenticated
WITH CHECK (
    instance_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND instance_id = game_templates.instance_id
          AND role IN ('admin', 'moderator')
          AND status = 'active'
    )
);

-- UPDATE: Admins and moderators can update templates from their instance
-- Also allow updating templates created by the user
CREATE POLICY "game_templates_update"
ON public.game_templates FOR UPDATE
TO authenticated
USING (
    instance_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND instance_id = game_templates.instance_id
          AND role IN ('admin', 'moderator')
          AND status = 'active'
    )
)
WITH CHECK (
    instance_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND instance_id = game_templates.instance_id
          AND role IN ('admin', 'moderator')
          AND status = 'active'
    )
);

-- DELETE: Admins can delete templates from their instance (not global templates)
CREATE POLICY "game_templates_delete"
ON public.game_templates FOR DELETE
TO authenticated
USING (
    instance_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.instance_memberships
        WHERE user_id = public.current_user_uuid()
          AND instance_id = game_templates.instance_id
          AND role = 'admin'
          AND status = 'active'
    )
);

-- ============================================================================
-- Add created_by_membership_id column if it doesn't exist
-- ============================================================================

ALTER TABLE public.game_templates
ADD COLUMN IF NOT EXISTS created_by_membership_id text REFERENCES public.instance_memberships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_game_templates_created_by ON public.game_templates(created_by_membership_id) WHERE created_by_membership_id IS NOT NULL;

-- ============================================================================
-- Add category column if it doesn't exist
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'game_templates'
          AND column_name = 'category'
    ) THEN
        ALTER TABLE public.game_templates ADD COLUMN category text DEFAULT 'general';
    END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
