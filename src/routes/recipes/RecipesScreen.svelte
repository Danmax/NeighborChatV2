<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
    import {
        recipes,
        recipesLoading,
        recipesError,
        myRecipes,
        publicRecipes,
        RECIPE_TAGS,
        filterByTags,
        searchRecipes
    } from '../../stores/recipes.js';
    import { createRecipe, deleteRecipe, fetchRecipes, updateRecipe } from '../../services/recipes.service.js';
    import RecipeCard from '../../components/recipes/RecipeCard.svelte';
    import RecipeForm from '../../components/recipes/RecipeForm.svelte';
    import { showToast } from '../../stores/toasts.js';

    let searchTerm = '';
    let selectedTags = [];
    let activeTab = 'all';
    let showForm = false;
    let editingRecipe = null;
    let saving = false;

    $: baseRecipes = activeTab === 'mine'
        ? $myRecipes
        : activeTab === 'public'
            ? $publicRecipes
            : $recipes;
    $: filteredRecipes = searchRecipes(filterByTags(baseRecipes || [], selectedTags), searchTerm);

    onMount(() => {
        if ($isAuthenticated) {
            fetchRecipes();
        }
    });

    function toggleTag(tag) {
        if (selectedTags.includes(tag)) {
            selectedTags = selectedTags.filter(t => t !== tag);
        } else {
            selectedTags = [...selectedTags, tag];
        }
    }

    function openCreate() {
        editingRecipe = null;
        showForm = true;
    }

    function openEdit(event) {
        editingRecipe = event.detail;
        showForm = true;
    }

    async function handleSubmit(event) {
        if (saving) return;
        saving = true;
        try {
            if (editingRecipe) {
                await updateRecipe(editingRecipe.id, event.detail);
                showToast('Recipe updated!', 'success');
            } else {
                await createRecipe(event.detail);
                showToast('Recipe created!', 'success');
            }
            showForm = false;
        } catch (err) {
            showToast(err.message || 'Unable to save recipe', 'error');
        } finally {
            saving = false;
        }
    }

    async function handleDelete(event) {
        const recipe = event.detail;
        if (!confirm(`Delete "${recipe.title}"?`)) return;
        try {
            await deleteRecipe(recipe.id);
            showToast('Recipe deleted.', 'success');
        } catch (err) {
            showToast(err.message || 'Unable to delete recipe', 'error');
        }
    }

    function handleOpen(event) {
        push(`/recipes/${event.detail.id}`);
    }
</script>

{#if $isAuthenticated}
<div class="recipes-screen">
    <header class="screen-header">
        <div>
            <h1>Recipes</h1>
            <p class="subtitle">Create and share potluck-friendly recipes.</p>
        </div>
        <button class="btn btn-primary" on:click={openCreate}>
            + New Recipe
        </button>
    </header>

    <section class="filters">
        <div class="tabs">
            <button class="tab" class:active={activeTab === 'all'} on:click={() => activeTab = 'all'}>All</button>
            <button class="tab" class:active={activeTab === 'mine'} on:click={() => activeTab = 'mine'}>My Recipes</button>
            <button class="tab" class:active={activeTab === 'public'} on:click={() => activeTab = 'public'}>Public</button>
        </div>
        <div class="search-row">
            <input
                type="text"
                placeholder="Search recipes..."
                bind:value={searchTerm}
            />
            {#if selectedTags.length}
                <button class="btn btn-secondary btn-small" on:click={() => selectedTags = []}>
                    Clear tags
                </button>
            {/if}
        </div>
        <div class="tag-row">
            {#each RECIPE_TAGS as tag}
                <button
                    class="tag"
                    class:active={selectedTags.includes(tag)}
                    on:click={() => toggleTag(tag)}
                >
                    {tag}
                </button>
            {/each}
        </div>
    </section>

    {#if $recipesLoading}
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading recipes...</p>
        </div>
    {:else if $recipesError}
        <div class="empty-state">
            <p>{$recipesError}</p>
            <button class="btn btn-secondary" on:click={() => fetchRecipes()}>
                Retry
            </button>
        </div>
    {:else if filteredRecipes.length === 0}
        <div class="empty-state">
            <p>No recipes found yet.</p>
            <button class="btn btn-primary" on:click={openCreate}>Create the first recipe</button>
        </div>
    {:else}
        <div class="recipes-grid">
            {#each filteredRecipes as recipe (recipe.id)}
                <RecipeCard
                    {recipe}
                    on:click={handleOpen}
                    on:edit={openEdit}
                    on:delete={handleDelete}
                />
            {/each}
        </div>
    {/if}

    {#if showForm}
        <div class="modal" role="dialog" aria-modal="true" on:click|self={() => showForm = false}>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>{editingRecipe ? 'Edit Recipe' : 'New Recipe'}</h2>
                    <button class="modal-close" on:click={() => showForm = false}>✕</button>
                </div>
                {#key editingRecipe?.id || 'new'}
                    <RecipeForm
                        recipe={editingRecipe}
                        loading={saving}
                        on:submit={handleSubmit}
                        on:cancel={() => showForm = false}
                    />
                {/key}
            </div>
        </div>
    {/if}
    </div>
{/if}

<style>
    .recipes-screen {
        padding-bottom: 40px;
    }

    .screen-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
    }

    .screen-header h1 {
        margin: 0;
    }

    .subtitle {
        margin: 6px 0 0;
        color: var(--text-muted);
        font-size: 14px;
    }

    .filters {
        background: white;
        border-radius: var(--radius-md);
        padding: 16px;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
    }

    .tabs {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .tab {
        border: 1px solid #e0e0e0;
        border-radius: 999px;
        padding: 6px 14px;
        background: white;
        font-weight: 600;
        cursor: pointer;
    }

    .tab.active {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
    }

    .search-row {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .search-row input {
        flex: 1;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        padding: 10px 12px;
    }

    .tag-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .tag {
        border: 1px dashed #c4c4c4;
        border-radius: 999px;
        padding: 6px 12px;
        background: #fafafa;
        font-size: 13px;
        cursor: pointer;
    }

    .tag.active {
        background: color-mix(in srgb, var(--primary) 15%, white);
        border-color: var(--primary);
        color: var(--primary);
        font-weight: 600;
    }

    .recipes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
    }

    .modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 40px 16px;
        z-index: 200;
    }

    .modal-content {
        background: white;
        max-width: 720px;
        width: 100%;
        border-radius: var(--radius-lg);
        padding: 20px;
        box-shadow: var(--shadow-lg);
        max-height: 90vh;
        overflow-y: auto;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .modal-close {
        border: none;
        background: none;
        font-size: 18px;
        cursor: pointer;
    }

    @media (max-width: 640px) {
        .screen-header {
            flex-direction: column;
            align-items: flex-start;
        }

        .search-row {
            flex-direction: column;
            align-items: stretch;
        }
    }
</style>
