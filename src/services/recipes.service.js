// Recipes service - CRUD operations for potluck recipes
import { getSupabase, getAuthUserId } from '../lib/supabase.js';
import {
    setRecipes,
    addRecipe,
    updateRecipe as updateRecipeStore,
    removeRecipe,
    recipesLoading,
    recipesError
} from '../stores/recipes.js';

/**
 * Transform database row to app format
 */
function transformRecipeFromDb(row) {
    return {
        id: row.id,
        createdById: row.created_by_id,
        title: row.title,
        description: row.description,
        ingredients: row.ingredients || [],
        instructions: row.instructions,
        prepTime: row.prep_time,
        cookTime: row.cook_time,
        servings: row.servings,
        tags: row.tags || [],
        imageUrl: row.image_url,
        isPublic: row.is_public !== false,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

/**
 * Transform app format to database row
 */
function transformRecipeToDb(recipeData, authUserId) {
    return {
        created_by_id: authUserId,
        title: recipeData.title,
        description: recipeData.description || null,
        ingredients: recipeData.ingredients || [],
        instructions: recipeData.instructions || null,
        prep_time: recipeData.prepTime || null,
        cook_time: recipeData.cookTime || null,
        servings: recipeData.servings || null,
        tags: recipeData.tags || [],
        image_url: recipeData.imageUrl || null,
        is_public: recipeData.isPublic !== false
    };
}

/**
 * Fetch all recipes (public + user's own)
 */
export async function fetchRecipes(filters = {}) {
    const supabase = getSupabase();
    recipesLoading.set(true);
    recipesError.set(null);

    try {
        let query = supabase
            .from('recipes')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters
        if (filters.tags && filters.tags.length > 0) {
            query = query.contains('tags', filters.tags);
        }
        if (filters.searchTerm) {
            query = query.ilike('title', `%${filters.searchTerm}%`);
        }
        if (filters.myRecipesOnly) {
            const authUserId = await getAuthUserId();
            if (authUserId) {
                query = query.eq('created_by_id', authUserId);
            }
        }

        const { data, error } = await query;

        if (error) throw error;

        const recipes = (data || []).map(transformRecipeFromDb);
        setRecipes(recipes);
        return recipes;
    } catch (error) {
        console.error('Failed to fetch recipes:', error);
        recipesError.set(error.message);
        return [];
    } finally {
        recipesLoading.set(false);
    }
}

/**
 * Fetch a single recipe by ID
 */
export async function fetchRecipeById(recipeId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('recipes')
            .select('*')
            .eq('id', recipeId)
            .single();

        if (error) throw error;

        return transformRecipeFromDb(data);
    } catch (error) {
        console.error('Failed to fetch recipe:', error);
        throw error;
    }
}

/**
 * Create a new recipe
 */
export async function createRecipe(recipeData) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();

    if (!authUserId) {
        throw new Error('Please sign in to create recipes.');
    }

    const dbRecipe = transformRecipeToDb(recipeData, authUserId);

    try {
        const { data, error } = await supabase
            .from('recipes')
            .insert([dbRecipe])
            .select()
            .single();

        if (error) throw error;

        const recipe = transformRecipeFromDb(data);
        addRecipe(recipe);
        return recipe;
    } catch (error) {
        console.error('Failed to create recipe:', error);
        throw error;
    }
}

/**
 * Update an existing recipe
 */
export async function updateRecipe(recipeId, updates) {
    const supabase = getSupabase();

    const dbUpdates = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.ingredients !== undefined) dbUpdates.ingredients = updates.ingredients;
    if (updates.instructions !== undefined) dbUpdates.instructions = updates.instructions;
    if (updates.prepTime !== undefined) dbUpdates.prep_time = updates.prepTime;
    if (updates.cookTime !== undefined) dbUpdates.cook_time = updates.cookTime;
    if (updates.servings !== undefined) dbUpdates.servings = updates.servings;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
    if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;

    try {
        const { data, error } = await supabase
            .from('recipes')
            .update(dbUpdates)
            .eq('id', recipeId)
            .select()
            .single();

        if (error) throw error;

        const recipe = transformRecipeFromDb(data);
        updateRecipeStore(recipeId, recipe);
        return recipe;
    } catch (error) {
        console.error('Failed to update recipe:', error);
        throw error;
    }
}

/**
 * Delete a recipe
 */
export async function deleteRecipe(recipeId) {
    const supabase = getSupabase();

    try {
        const { error } = await supabase
            .from('recipes')
            .delete()
            .eq('id', recipeId);

        if (error) throw error;

        removeRecipe(recipeId);
        return true;
    } catch (error) {
        console.error('Failed to delete recipe:', error);
        throw error;
    }
}

/**
 * Fetch recipes by user
 */
export async function fetchUserRecipes(userId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('recipes')
            .select('*')
            .eq('created_by_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(transformRecipeFromDb);
    } catch (error) {
        console.error('Failed to fetch user recipes:', error);
        throw error;
    }
}

/**
 * Search recipes by tags
 */
export async function searchRecipesByTags(tags) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('recipes')
            .select('*')
            .contains('tags', tags)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(transformRecipeFromDb);
    } catch (error) {
        console.error('Failed to search recipes:', error);
        throw error;
    }
}
