-- Migration 018: Recipes Table
-- Create recipes table for potluck events

-- ============================================
-- RECIPES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    ingredients JSONB DEFAULT '[]'::jsonb,
    instructions TEXT,
    prep_time INTEGER,
    cook_time INTEGER,
    servings INTEGER,
    tags TEXT[] DEFAULT '{}',
    image_url TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

-- Index for fetching user's recipes
CREATE INDEX IF NOT EXISTS idx_recipes_created_by
ON public.recipes(created_by_id);

-- Index for public recipe queries
CREATE INDEX IF NOT EXISTS idx_recipes_public
ON public.recipes(is_public) WHERE is_public = true;

-- Index for tag-based searches (GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_recipes_tags
ON public.recipes USING GIN(tags);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read public recipes or their own
CREATE POLICY "recipes_select_policy"
ON public.recipes FOR SELECT
USING (
    is_public = true
    OR created_by_id = auth.uid()
);

-- Policy: Users can insert their own recipes
CREATE POLICY "recipes_insert_policy"
ON public.recipes FOR INSERT
WITH CHECK (
    created_by_id = auth.uid()
);

-- Policy: Users can update their own recipes
CREATE POLICY "recipes_update_policy"
ON public.recipes FOR UPDATE
USING (created_by_id = auth.uid())
WITH CHECK (created_by_id = auth.uid());

-- Policy: Users can delete their own recipes
CREATE POLICY "recipes_delete_policy"
ON public.recipes FOR DELETE
USING (created_by_id = auth.uid());

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for recipes
DROP TRIGGER IF EXISTS recipes_updated_at_trigger ON public.recipes;
CREATE TRIGGER recipes_updated_at_trigger
    BEFORE UPDATE ON public.recipes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
