-- Migration 048: Attach recipe to item using TEXT event ids
-- Date: 2026-02-04
-- Description: Align attach_recipe_to_item RPC with text-based event ids

BEGIN;

CREATE OR REPLACE FUNCTION public.attach_recipe_to_item(
    p_event_id TEXT,
    p_item_id TEXT,
    p_recipe_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_event RECORD;
    v_recipe RECORD;
    v_items JSONB;
    v_item JSONB;
    v_item_index INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_recipe
    FROM public.recipes
    WHERE id = p_recipe_id
      AND (is_public = true OR created_by_id = v_user_id);

    IF v_recipe IS NULL THEN
        RAISE EXCEPTION 'Recipe not found or not accessible';
    END IF;

    SELECT * INTO v_event
    FROM public.community_events
    WHERE id = p_event_id;

    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    IF NOT COALESCE((v_event.settings->>'potluck_allow_recipes')::boolean, true) THEN
        RAISE EXCEPTION 'Recipes are disabled for this event';
    END IF;

    v_items := COALESCE(v_event.event_data->'items', '[]'::jsonb);

    SELECT i-1 INTO v_item_index
    FROM jsonb_array_elements(v_items) WITH ORDINALITY arr(elem, i)
    WHERE elem->>'id' = p_item_id;

    IF v_item_index IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    v_item := v_items->v_item_index;

    IF NOT COALESCE((v_item->>'allow_recipe')::boolean, true) THEN
        RAISE EXCEPTION 'Item does not allow recipes';
    END IF;

    v_item := jsonb_set(v_item, '{recipe_id}', to_jsonb(p_recipe_id));
    v_items := jsonb_set(v_items, ARRAY[v_item_index::text], v_item);

    UPDATE public.community_events
    SET event_data = jsonb_set(
        COALESCE(event_data, '{}'::jsonb),
        '{items}',
        v_items
    ),
    updated_at = now()
    WHERE id = p_event_id;

    RETURN jsonb_build_object('success', true, 'recipe_id', p_recipe_id);
END;
$$;

ALTER FUNCTION public.attach_recipe_to_item(TEXT, TEXT, UUID)
SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.attach_recipe_to_item(TEXT, TEXT, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.attach_recipe_to_item(TEXT, TEXT, UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.attach_recipe_to_item(UUID, TEXT, UUID);

COMMIT;
