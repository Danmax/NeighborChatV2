-- Migration 057: Ensure user_profiles row for Clerk users
-- Date: 2026-02-05
-- Description: Create helper to upsert user_profiles by clerk_user_id

BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clerk_id text;
    v_user_id uuid;
BEGIN
    v_clerk_id := public.current_user_id();
    IF v_clerk_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT id INTO v_user_id
    FROM public.user_profiles
    WHERE clerk_user_id = v_clerk_id
    LIMIT 1;

    IF v_user_id IS NULL THEN
        INSERT INTO public.user_profiles (clerk_user_id, created_at, updated_at)
        VALUES (v_clerk_id, now(), now())
        ON CONFLICT (clerk_user_id) DO NOTHING
        RETURNING id INTO v_user_id;

        IF v_user_id IS NULL THEN
            SELECT id INTO v_user_id
            FROM public.user_profiles
            WHERE clerk_user_id = v_clerk_id
            LIMIT 1;
        END IF;
    END IF;

    RETURN v_user_id;
END;
$$;

COMMIT;
