-- Migration 019: Speakers Table
-- Create speakers table for dev meetup events

-- ============================================
-- SPEAKERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.speakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_id UUID NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    company TEXT,
    bio TEXT,
    headshot_url TEXT,
    email TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Index for fetching user's speakers
CREATE INDEX IF NOT EXISTS idx_speakers_created_by
ON public.speakers(created_by_id);

-- Index for public speaker queries
CREATE INDEX IF NOT EXISTS idx_speakers_public
ON public.speakers(is_public) WHERE is_public = true;

-- Index for name search
CREATE INDEX IF NOT EXISTS idx_speakers_name
ON public.speakers(name);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read public speakers or their own
CREATE POLICY "speakers_select_policy"
ON public.speakers FOR SELECT
USING (
    is_public = true
    OR created_by_id = auth.uid()
);

-- Policy: Users can insert their own speakers
CREATE POLICY "speakers_insert_policy"
ON public.speakers FOR INSERT
WITH CHECK (
    created_by_id = auth.uid()
);

-- Policy: Users can update their own speakers
CREATE POLICY "speakers_update_policy"
ON public.speakers FOR UPDATE
USING (created_by_id = auth.uid())
WITH CHECK (created_by_id = auth.uid());

-- Policy: Users can delete their own speakers
CREATE POLICY "speakers_delete_policy"
ON public.speakers FOR DELETE
USING (created_by_id = auth.uid());

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

-- Create trigger for speakers
DROP TRIGGER IF EXISTS speakers_updated_at_trigger ON public.speakers;
CREATE TRIGGER speakers_updated_at_trigger
    BEFORE UPDATE ON public.speakers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
