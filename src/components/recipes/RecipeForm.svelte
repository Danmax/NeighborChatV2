<script>
    import { createEventDispatcher } from 'svelte';
    import { RECIPE_TAGS } from '../../stores/recipes.js';

    export let recipe = null;
    export let loading = false;

    const dispatch = createEventDispatcher();

    let title = recipe?.title || '';
    let description = recipe?.description || '';
    let ingredients = recipe?.ingredients ? JSON.stringify(recipe.ingredients, null, 2) : '[]';
    let instructions = recipe?.instructions || '';
    let prepTime = recipe?.prepTime || '';
    let cookTime = recipe?.cookTime || '';
    let servings = recipe?.servings || '';
    let tags = recipe?.tags || [];
    let imageUrl = recipe?.imageUrl || '';
    let isPublic = recipe?.isPublic !== false;

    $: isValid = title.trim() && instructions.trim();

    function handleSubmit() {
        if (!isValid || loading) return;

        let parsedIngredients = [];
        try {
            parsedIngredients = JSON.parse(ingredients);
        } catch (e) {
            // If JSON parsing fails, split by newlines
            parsedIngredients = ingredients.split('\n').filter(i => i.trim());
        }

        const recipeData = {
            title: title.trim(),
            description: description.trim() || null,
            ingredients: parsedIngredients,
            instructions: instructions.trim(),
            prepTime: prepTime ? parseInt(prepTime) : null,
            cookTime: cookTime ? parseInt(cookTime) : null,
            servings: servings ? parseInt(servings) : null,
            tags,
            imageUrl: imageUrl.trim() || null,
            isPublic
        };

        dispatch('submit', recipeData);
    }

    function handleCancel() {
        dispatch('cancel');
    }

    function toggleTag(tag) {
        if (tags.includes(tag)) {
            tags = tags.filter(t => t !== tag);
        } else {
            tags = [...tags, tag];
        }
    }
</script>

<form class="recipe-form" on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
        <label for="recipe-title">Recipe Title *</label>
        <input
            id="recipe-title"
            type="text"
            bind:value={title}
            placeholder="What are you making?"
            maxlength="100"
            required
        />
    </div>

    <div class="form-group">
        <label for="recipe-description">Description</label>
        <textarea
            id="recipe-description"
            bind:value={description}
            placeholder="Brief description of the dish..."
            rows="2"
            maxlength="300"
        ></textarea>
    </div>

    <div class="form-row">
        <div class="form-group">
            <label for="recipe-prep">Prep Time (min)</label>
            <input
                id="recipe-prep"
                type="number"
                bind:value={prepTime}
                min="0"
                max="600"
                placeholder="15"
            />
        </div>

        <div class="form-group">
            <label for="recipe-cook">Cook Time (min)</label>
            <input
                id="recipe-cook"
                type="number"
                bind:value={cookTime}
                min="0"
                max="600"
                placeholder="30"
            />
        </div>

        <div class="form-group">
            <label for="recipe-servings">Servings</label>
            <input
                id="recipe-servings"
                type="number"
                bind:value={servings}
                min="1"
                max="100"
                placeholder="4"
            />
        </div>
    </div>

    <div class="form-group">
        <label for="recipe-ingredients">Ingredients</label>
        <textarea
            id="recipe-ingredients"
            bind:value={ingredients}
            placeholder="Enter ingredients, one per line:&#10;2 cups flour&#10;1 tsp salt&#10;..."
            rows="6"
        ></textarea>
        <span class="helper-text">Enter one ingredient per line, or use JSON format</span>
    </div>

    <div class="form-group">
        <label for="recipe-instructions">Instructions *</label>
        <textarea
            id="recipe-instructions"
            bind:value={instructions}
            placeholder="Step by step instructions..."
            rows="6"
            required
        ></textarea>
    </div>

    <div class="form-group">
        <label for="recipe-image">Image URL</label>
        <input
            id="recipe-image"
            type="url"
            bind:value={imageUrl}
            placeholder="https://example.com/recipe.jpg"
        />
    </div>

    <fieldset class="form-group">
        <legend>Tags</legend>
        <div class="tags-selector">
            {#each RECIPE_TAGS as tag}
                <button
                    type="button"
                    class="tag-option"
                    class:selected={tags.includes(tag)}
                    on:click={() => toggleTag(tag)}
                >
                    {tag}
                </button>
            {/each}
        </div>
    </fieldset>

    <div class="form-group">
        <label class="checkbox-label">
            <input type="checkbox" bind:checked={isPublic} />
            <span>Make this recipe public (others can see and use it)</span>
        </label>
    </div>

    <div class="form-actions">
        <button
            type="button"
            class="btn btn-secondary"
            on:click={handleCancel}
            disabled={loading}
        >
            Cancel
        </button>
        <button
            type="submit"
            class="btn btn-primary"
            disabled={!isValid || loading}
        >
            {loading ? 'Saving...' : recipe ? 'Update Recipe' : 'Create Recipe'}
        </button>
    </div>
</form>

<style>
    .recipe-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    fieldset.form-group {
        border: 0;
        padding: 0;
        margin: 0;
    }

    fieldset.form-group legend {
        font-weight: 600;
        font-size: 13px;
        color: var(--text);
        margin-bottom: 8px;
    }

    .form-group label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
    }

    .form-group input,
    .form-group textarea {
        padding: 12px 16px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-family: inherit;
        transition: border-color 0.2s;
    }

    .form-group input:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: var(--primary);
    }

    .form-group textarea {
        resize: vertical;
        min-height: 80px;
    }

    .helper-text {
        font-size: 12px;
        color: var(--text-muted);
    }

    .form-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
    }

    .tags-selector {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .tag-option {
        padding: 6px 14px;
        border: 1px solid var(--cream-dark);
        border-radius: 20px;
        background: white;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .tag-option:hover {
        border-color: var(--primary);
    }

    .tag-option.selected {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        cursor: pointer;
    }

    .checkbox-label input {
        width: 18px;
        height: 18px;
        cursor: pointer;
    }

    .form-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 8px;
    }

    .btn {
        padding: 12px 24px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background: var(--primary-dark);
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-secondary:hover:not(:disabled) {
        background: var(--cream-dark);
    }
</style>
