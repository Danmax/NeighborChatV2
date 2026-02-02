-- Migration 026: Feedback collection
-- Date: 2026-02-01
-- Description: Allow users to submit feedback and admins to review

BEGIN;

CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    username TEXT,
    category TEXT NOT NULL DEFAULT 'issue',
    title TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedback_category_check'
    ) THEN
        ALTER TABLE public.feedback
        ADD CONSTRAINT feedback_category_check
        CHECK (category IN ('issue', 'bug', 'question', 'feature'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedback_status_check'
    ) THEN
        ALTER TABLE public.feedback
        ADD CONSTRAINT feedback_status_check
        CHECK (status IN ('open', 'reviewing', 'resolved', 'closed'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);

-- Admin helper
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    PERFORM set_config('row_security', 'off', true);

    SELECT EXISTS (
        SELECT 1
        FROM public.instance_memberships
        WHERE user_id = v_user_id
          AND role IN ('admin', 'owner', 'moderator')
    ) INTO v_is_admin;

    RETURN COALESCE(v_is_admin, false);
END;
$$;

ALTER FUNCTION public.is_platform_admin()
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_select_own"
ON public.feedback FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "feedback_insert_own"
ON public.feedback FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_update_admin"
ON public.feedback FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP TRIGGER IF EXISTS feedback_updated_at_trigger ON public.feedback;
CREATE TRIGGER feedback_updated_at_trigger
    BEFORE UPDATE ON public.feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
