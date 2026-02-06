-- Migration 064: Fix community_events.created_by_id FK to user_profiles
-- Date: 2026-02-06
-- Description: Repoint created_by_id foreign key away from auth.users

BEGIN;

ALTER TABLE public.community_events
DROP CONSTRAINT IF EXISTS community_events_created_by_id_fkey;

ALTER TABLE public.community_events
ADD CONSTRAINT community_events_created_by_id_fkey
FOREIGN KEY (created_by_id) REFERENCES public.user_profiles(id);

COMMIT;

NOTIFY pgrst, 'reload schema';
