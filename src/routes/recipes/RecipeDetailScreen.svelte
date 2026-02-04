<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { currentUser, isAuthenticated } from '../../stores/auth.js';
    import { fetchRecipeById, updateRecipe, deleteRecipe } from '../../services/recipes.service.js';
    import RecipeForm from '../../components/recipes/RecipeForm.svelte';
    import { showToast } from '../../stores/toasts.js';
    import { formatRecipeTime, getTotalTime } from '../../stores/recipes.js';

    export let params = {};

    let recipe = null;
    let loading = true;
    let editing = false;
    let saving = false;

    $: isOwner = recipe?.createdById === $currentUser?.user_id;
    $: totalTime = getTotalTime(recipe);

    onMount(async () => {
        if (!$isAuthenticated || !params?.id) return;
        try {
            recipe = await fetchRecipeById(params.id);
        } catch (err) {
            showToast('Recipe not found', 'error');
        } finally {
            loading = false;
        }
    });

    async function handleSubmit(event) {
        if (saving) return;
        saving = true;
        try {
            recipe = await updateRecipe(recipe.id, event.detail);
            editing = false;
            showToast('Recipe updated!', 'success');
        } catch (err) {
            showToast(err.message || 'Unable to update recipe', 'error');
        } finally {
            saving = false;
        }
    }

    async function handleDelete() {
        if (!confirm('Delete this recipe?')) return;
        try {
            await deleteRecipe(recipe.id);
            showToast('Recipe deleted.', 'success');
            push('/recipes');
        } catch (err) {
            showToast(err.message || 'Unable to delete recipe', 'error');
        }
    }
</script>

{#if $isAuthenticated}
    <div class="recipe-detail">
        <div class="detail-header">
            <button class="back-btn" on:click={() => push('/recipes')}>← Back</button>
            <h2 class="card-title">Recipe</h2>
            {#if isOwner}
                <div class="detail-actions">
                    <button class="btn btn-secondary btn-small" on:click={() => editing = !editing}>
                        {editing ? 'Close Edit' : 'Edit'}
                    </button>
                    <button class="btn btn-secondary btn-small" on:click={handleDelete}>
                        Delete
                    </button>
                </div>
            {/if}
        </div>

        {#if loading}
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading recipe...</p>
            </div>
        {:else if recipe}
            {#if recipe.imageUrl}
                <div class="hero">
                    <img src={recipe.imageUrl} alt={recipe.title} />
                </div>
            {/if}
            <div class="card">
                <div class="title-row">
                    <h3>{recipe.title}</h3>
                    {#if recipe.isPublic}
                        <span class="badge">Public</span>
                    {/if}
                </div>
                {#if recipe.description}
                    <p class="description">{recipe.description}</p>
                {/if}
                <div class="meta">
                    {#if totalTime}
                        <span>⏱️ {formatRecipeTime(totalTime)}</span>
                    {/if}
                    {#if recipe.servings}
                        <span>🍽️ {recipe.servings} servings</span>
                    {/if}
                </div>
                {#if recipe.tags?.length}
                    <div class="tags">
                        {#each recipe.tags as tag}
                            <span class="tag">{tag}</span>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="card">
                <h4>Ingredients</h4>
                {#if recipe.ingredients?.length}
                    <ul>
                        {#each recipe.ingredients as item}
                            <li>{item}</li>
                        {/each}
                    </ul>
                {:else}
                    <p class="muted">No ingredients listed.</p>
                {/if}
            </div>

            <div class="card">
                <h4>Instructions</h4>
                <p class="instructions">{recipe.instructions}</p>
            </div>

            {#if editing}
                <div class="card">
                    <h4>Edit Recipe</h4>
                    {#key recipe?.id}
                        <RecipeForm recipe={recipe} loading={saving} on:submit={handleSubmit} on:cancel={() => editing = false} />
                    {/key}
                </div>
            {/if}
        {:else}
            <div class="empty-state">Recipe not found.</div>
        {/if}
    </div>
{/if}

<style>
    .recipe-detail {
        padding-bottom: 40px;
    }

    .detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
    }

    .detail-actions {
        display: flex;
        gap: 8px;
    }

    .back-btn {
        background: none;
        border: none;
        color: var(--primary);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        padding: 8px 0;
    }

    .hero {
        width: 100%;
        border-radius: var(--radius-lg);
        overflow: hidden;
        margin-bottom: 16px;
        box-shadow: var(--shadow-md);
    }

    .hero img {
        width: 100%;
        height: 320px;
        object-fit: cover;
        display: block;
    }

    .card {
        background: white;
        border-radius: var(--radius-md);
        padding: 18px;
        box-shadow: var(--shadow-sm);
        margin-bottom: 16px;
    }

    .title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .badge {
        padding: 4px 10px;
        background: color-mix(in srgb, var(--primary) 15%, white);
        color: var(--primary);
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
    }

    .meta {
        display: flex;
        gap: 16px;
        font-size: 14px;
        color: var(--text-muted);
        margin-top: 12px;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
    }

    .tag {
        padding: 4px 10px;
        border-radius: 999px;
        background: #f5f5f5;
        font-size: 12px;
    }

    .description {
        margin: 8px 0 0;
    }

    .instructions {
        white-space: pre-wrap;
    }

    .muted {
        color: var(--text-muted);
    }

    @media (max-width: 640px) {
        .detail-header {
            flex-direction: column;
            align-items: flex-start;
        }

        .hero img {
            height: 220px;
        }
    }
</style>
