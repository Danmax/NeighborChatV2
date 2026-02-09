-- Migration 076: Enable realtime for direct messages
-- Date: 2026-02-08
-- Description: Ensure messages are in supabase_realtime publication and have replica identity

BEGIN;

ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
