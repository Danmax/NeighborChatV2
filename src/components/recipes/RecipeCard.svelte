<script>
    import { createEventDispatcher } from 'svelte';
    import { formatRecipeTime, getTotalTime } from '../../stores/recipes.js';
    import { currentUser } from '../../stores/auth.js';

    export let recipe;
    export let compact = false;
    export let selectable = false;
    export let selected = false;

    const dispatch = createEventDispatcher();

    $: currentId = $currentUser?.user_uuid || $currentUser?.user_id;
    $: isOwner = recipe.createdById === currentId;
    $: totalTime = getTotalTime(recipe);

    function handleClick() {
        if (selectable) {
            dispatch('select', recipe);
        } else {
            dispatch('click', recipe);
        }
    }

    function handleEdit(e) {
        e.stopPropagation();
        dispatch('edit', recipe);
    }

    function handleDelete(e) {
        e.stopPropagation();
        dispatch('delete', recipe);
    }
</script>

<div
    class="recipe-card"
    class:compact
    class:selectable
    class:selected
    on:click={handleClick}
    on:keypress={(e) => e.key === 'Enter' && handleClick()}
    role="button"
    tabindex="0"
>
    {#if recipe.imageUrl && !compact}
        <div class="recipe-image">
            <img src={recipe.imageUrl} alt={recipe.title} loading="lazy" />
        </div>
    {/if}

    <div class="recipe-content">
        <h4 class="recipe-title">{recipe.title}</h4>

        {#if !compact && recipe.description}
            <p class="recipe-description">{recipe.description}</p>
        {/if}

        <div class="recipe-meta">
            {#if totalTime}
                <span class="meta-item">
                    <span class="meta-icon">⏱️</span>
                    {formatRecipeTime(totalTime)}
                </span>
            {/if}
            {#if recipe.servings}
                <span class="meta-item">
                    <span class="meta-icon">🍽️</span>
                    {recipe.servings} servings
                </span>
            {/if}
        </div>

        {#if recipe.tags && recipe.tags.length > 0 && !compact}
            <div class="recipe-tags">
                {#each recipe.tags.slice(0, 3) as tag}
                    <span class="tag">{tag}</span>
                {/each}
                {#if recipe.tags.length > 3}
                    <span class="tag more">+{recipe.tags.length - 3}</span>
                {/if}
            </div>
        {/if}
    </div>

    {#if selectable}
        <div class="select-indicator">
            {#if selected}
                <span class="check">✓</span>
            {/if}
        </div>
    {:else if isOwner}
        <div class="recipe-actions" class:compact-actions={compact}>
            <button class="action-btn" on:click={handleEdit} title="Edit">
                ✏️
            </button>
            <button class="action-btn delete" on:click={handleDelete} title="Delete">
                🗑️
            </button>
        </div>
    {/if}
</div>

<style>
    .recipe-card {
        display: flex;
        flex-direction: column;
        background: white;
        border-radius: var(--radius-md);
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
    }

    .recipe-card:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        transform: translateY(-2px);
    }

    .recipe-card.compact {
        flex-direction: row;
        align-items: center;
        padding: 12px;
        gap: 12px;
    }

    .recipe-card.selectable {
        border: 2px solid transparent;
    }

    .recipe-card.selected {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 5%, white);
    }

    .recipe-image {
        width: 100%;
        height: 150px;
        background: var(--cream);
        overflow: hidden;
    }

    .recipe-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .recipe-content {
        padding: 16px;
        flex: 1;
    }

    .compact .recipe-content {
        padding: 0;
    }

    .recipe-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
        margin: 0 0 8px;
    }

    .compact .recipe-title {
        font-size: 14px;
        margin-bottom: 4px;
    }

    .recipe-description {
        font-size: 13px;
        color: var(--text-light);
        line-height: 1.4;
        margin: 0 0 12px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .recipe-meta {
        display: flex;
        gap: 16px;
        margin-bottom: 8px;
    }

    .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--text-muted);
    }

    .meta-icon {
        font-size: 14px;
    }

    .recipe-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .tag {
        padding: 4px 10px;
        background: var(--cream);
        border-radius: 12px;
        font-size: 11px;
        color: var(--text-muted);
    }

    .tag.more {
        background: var(--cream-dark);
    }

    .select-indicator {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 24px;
        height: 24px;
        border: 2px solid var(--cream-dark);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
    }

    .selected .select-indicator {
        background: var(--primary);
        border-color: var(--primary);
    }

    .check {
        color: white;
        font-size: 14px;
        font-weight: bold;
    }

    .recipe-actions {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 8px;
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    .recipe-card:hover .recipe-actions {
        opacity: 1;
    }

    .recipe-actions.compact-actions {
        position: static;
        margin-left: auto;
        opacity: 1;
    }

    .action-btn {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
    }

    .action-btn:hover {
        background: var(--cream);
    }

    .action-btn.delete:hover {
        background: #FFEBEE;
    }
</style>
