// Recipes store - State management for potluck recipes
import { writable, derived } from 'svelte/store';
import { currentUser } from './auth.js';

// Recipes state
export const recipes = writable([]);
export const recipesLoading = writable(false);
export const recipesError = writable(null);

// Common recipe tags
export const RECIPE_TAGS = [
    'vegetarian',
    'vegan',
    'gluten-free',
    'dairy-free',
    'nut-free',
    'keto',
    'low-carb',
    'quick',
    'make-ahead',
    'crowd-pleaser',
    'kid-friendly',
    'spicy',
    'comfort-food',
    'healthy'
];

// Derived: my recipes
export const myRecipes = derived([recipes, currentUser], ([$recipes, $currentUser]) => {
    if (!$currentUser) return [];
    const currentId = $currentUser.user_uuid || $currentUser.user_id;
    return $recipes.filter(r => r.createdById === currentId);
});

// Derived: public recipes (not mine)
export const publicRecipes = derived([recipes, currentUser], ([$recipes, $currentUser]) => {
    const currentId = $currentUser?.user_uuid || $currentUser?.user_id;
    return $recipes.filter(r => r.isPublic && (!$currentUser || r.createdById !== currentId));
});

// Set recipes
export function setRecipes(recipesList) {
    recipes.set(recipesList);
}

// Add a new recipe
export function addRecipe(recipe) {
    recipes.update(list => [recipe, ...list]);
}

// Update a recipe
export function updateRecipe(recipeId, updates) {
    recipes.update(list =>
        list.map(r => r.id === recipeId ? { ...r, ...updates } : r)
    );
}

// Remove a recipe
export function removeRecipe(recipeId) {
    recipes.update(list => list.filter(r => r.id !== recipeId));
}

// Get recipe by ID
export function getRecipeById(recipeId) {
    let found = null;
    recipes.subscribe(list => {
        found = list.find(r => r.id === recipeId);
    })();
    return found;
}

// Filter recipes by tags
export function filterByTags(recipesList, tags) {
    if (!tags || tags.length === 0) return recipesList;
    return recipesList.filter(recipe =>
        tags.some(tag => (recipe.tags || []).includes(tag))
    );
}

// Search recipes by title
export function searchRecipes(recipesList, searchTerm) {
    if (!searchTerm) return recipesList;
    const term = searchTerm.toLowerCase();
    return recipesList.filter(recipe =>
        recipe.title?.toLowerCase().includes(term) ||
        recipe.description?.toLowerCase().includes(term)
    );
}

// Format time (minutes to human readable)
export function formatRecipeTime(minutes) {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
}

// Get total recipe time
export function getTotalTime(recipe) {
    const prep = recipe?.prepTime || 0;
    const cook = recipe?.cookTime || 0;
    return prep + cook;
}
