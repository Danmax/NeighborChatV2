-- Migration 012: Remove event items RPC
-- Date: 2026-02-01
-- Description: Allow event owners to remove items from potluck lists

BEGIN;

CREATE OR REPLACE FUNCTION public.remove_event_item(
    p_event_id TEXT,
    p_item_id TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_event record;
    v_items jsonb;
    v_new_items jsonb := '[]'::jsonb;
    v_item jsonb;
    v_found boolean := false;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT id, created_by_id, event_data
    INTO v_event
    FROM public.community_events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF v_event.created_by_id <> v_user_id THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        IF (v_item->>'id') = p_item_id THEN
            v_found := true;
        ELSE
            v_new_items := v_new_items || jsonb_build_array(v_item);
        END IF;
    END LOOP;

    IF NOT v_found THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    UPDATE public.community_events
    SET event_data = jsonb_set(COALESCE(event_data, '{}'::jsonb), '{items}', v_new_items, true)
    WHERE id = p_event_id;

    RETURN v_new_items;
END;
$$;

ALTER FUNCTION public.remove_event_item(TEXT, TEXT)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.remove_event_item(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_event_item(TEXT, TEXT) TO authenticated;

COMMIT;
