-- Migration 016: Enforce username/display_name consolidation
-- Date: 2026-02-01
-- Description: Keep username/display_name in sync and backfill remaining null usernames

BEGIN;

-- Backfill any remaining null usernames with generated values
UPDATE public.user_profiles
SET username = CONCAT('user_', SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 10))
WHERE username IS NULL;

-- Backfill any remaining null display_name values
UPDATE public.user_profiles
SET display_name = username
WHERE display_name IS NULL AND username IS NOT NULL;

-- Ensure display_name always matches username
CREATE OR REPLACE FUNCTION public.sync_username_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_base text;
BEGIN
    IF NEW.username IS NULL AND NEW.display_name IS NOT NULL THEN
        v_base := lower(regexp_replace(NEW.display_name, '[^a-zA-Z0-9_]+', '_', 'g'));
        v_base := trim(both '_' from v_base);
        v_base := left(v_base, 30);
        IF length(v_base) < 3 THEN
            v_base := concat('user_', left(replace(coalesce(NEW.id::text, gen_random_uuid()::text), '-', ''), 8));
        END IF;
        NEW.username := v_base;
    END IF;

    IF NEW.display_name IS NULL AND NEW.username IS NOT NULL THEN
        NEW.display_name := NEW.username;
    END IF;

    IF NEW.username IS NOT NULL AND NEW.display_name IS NOT NULL THEN
        NEW.display_name := NEW.username;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_username_display_name ON public.user_profiles;
CREATE TRIGGER trg_sync_username_display_name
BEFORE INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_username_display_name();

-- Update public_profiles view to reflect consolidated name
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true) AS
SELECT
    user_id,
    COALESCE(username, display_name) AS display_name,
    username,
    avatar,
    bio,
    banner_color,
    banner_pattern,
    CASE WHEN show_interests THEN interests ELSE '[]'::jsonb END AS interests,
    CASE WHEN show_city THEN city ELSE NULL END AS city,
    CASE WHEN show_phone THEN phone ELSE NULL END AS phone,
    CASE WHEN show_birthday THEN birthday ELSE NULL END AS birthday,
    created_at
FROM public.user_profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

COMMIT;
