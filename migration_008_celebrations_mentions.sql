-- Migration 008: Celebration date + mention notifications
-- Date: 2026-02-01
-- Description: Adds celebration_date and RPC to send mention notifications

BEGIN;

ALTER TABLE public.celebrations
ADD COLUMN IF NOT EXISTS celebration_date DATE;

CREATE OR REPLACE FUNCTION public.send_celebration_mention_notification(
    target_user_id UUID,
    from_user_id UUID,
    celebration_id TEXT,
    mention_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF target_user_id IS NULL OR from_user_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
        target_user_id,
        'celebration_mention',
        'You were mentioned',
        mention_message,
        jsonb_build_object(
            'from_user_id', from_user_id,
            'celebration_id', celebration_id
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.send_celebration_mention_notification(UUID, UUID, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.send_celebration_mention_notification(UUID, UUID, TEXT, TEXT) TO authenticated;

COMMIT;
