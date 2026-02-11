-- Migration 086: Celebration message style options
-- Date: 2026-02-11
-- Description: Add background color and pattern fields for celebration message styling

BEGIN;

ALTER TABLE public.celebrations
ADD COLUMN IF NOT EXISTS message_bg_color text DEFAULT '#FFF4D6';

ALTER TABLE public.celebrations
ADD COLUMN IF NOT EXISTS message_bg_pattern text DEFAULT 'none';

COMMIT;

NOTIFY pgrst, 'reload schema';
