<script>
    import { createEventDispatcher } from 'svelte';
    import { push } from 'svelte-spa-router';
    import {
        ITEM_CATEGORIES,
        getItemCategory,
        calculateAvailableSlots,
        calculateClaimedQuantity,
        getUserClaim,
        groupItemsByCategory,
        getEventSettings
    } from '../../stores/events.js';
    import { currentUser } from '../../stores/auth.js';
    import RecipeForm from '../recipes/RecipeForm.svelte';

    export let event;
    export let isOwner = false;

    const dispatch = createEventDispatcher();

    let selectedCategory = 'all';
    let showAddForm = false;
    let newItemName = '';
    let newItemCategory = 'main';
    let newItemSlots = 1;
    let claimQuantity = 1;
    let claimingItemId = null;
    let showRecipeModal = false;
    let recipeItem = null;

    $: settings = getEventSettings(event);
    $: canAddItems = isOwner || settings.potluck_allow_new_items;
    $: items = event?.items || [];
    $: groupedItems = groupItemsByCategory(items);

    $: filteredItems = selectedCategory === 'all'
        ? items
        : items.filter(item => item.category === selectedCategory);

    function handleAddItem() {
        if (!newItemName.trim()) return;

        dispatch('addItem', {
            name: newItemName.trim(),
            category: newItemCategory,
            slots: newItemSlots
        });

        newItemName = '';
        newItemCategory = 'main';
        newItemSlots = 1;
        showAddForm = false;
    }

    function handleClaim(itemId) {
        dispatch('claim', { itemId, quantity: claimQuantity });
        claimingItemId = null;
        claimQuantity = 1;
    }

    function handleUnclaim(itemId, claimId) {
        dispatch('unclaim', { itemId, claimId });
    }

    function handleRemoveItem(itemId) {
        dispatch('removeItem', { itemId });
    }

    function openRecipeModal(item) {
        recipeItem = item;
        showRecipeModal = true;
    }

    function handleRecipeSubmit(event) {
        if (!recipeItem) return;
        dispatch('createRecipe', { itemId: recipeItem.id, recipe: event.detail });
        showRecipeModal = false;
        recipeItem = null;
    }

    function handleRecipeCancel() {
        showRecipeModal = false;
        recipeItem = null;
    }

    function getProgressPercent(item) {
        const claimed = calculateClaimedQuantity(item);
        const total = item.slots || 1;
        return Math.min(100, (claimed / total) * 100);
    }
</script>

<div class="potluck-section">
    <div class="section-header">
        <h3>What to Bring</h3>
        {#if canAddItems}
            <button class="add-btn" on:click={() => showAddForm = !showAddForm}>
                {showAddForm ? 'Cancel' : '+ Add Item'}
            </button>
        {/if}
    </div>

    <!-- Add Item Form -->
    {#if showAddForm}
        <div class="add-item-form">
            <input
                type="text"
                bind:value={newItemName}
                placeholder="Item name (e.g., Caesar Salad)"
                maxlength="100"
            />
            <div class="form-row">
                <select bind:value={newItemCategory}>
                    {#each ITEM_CATEGORIES as cat}
                        <option value={cat.id}>{cat.emoji} {cat.label}</option>
                    {/each}
                </select>
                <div class="slots-input">
                    <label>Slots:</label>
                    <input
                        type="number"
                        bind:value={newItemSlots}
                        min="1"
                        max="10"
                    />
                </div>
            </div>
            <button class="submit-btn" on:click={handleAddItem} disabled={!newItemName.trim()}>
                Add Item
            </button>
        </div>
    {/if}

    <!-- Category Tabs -->
    <div class="category-tabs">
        <button
            class="tab"
            class:active={selectedCategory === 'all'}
            on:click={() => selectedCategory = 'all'}
        >
            All ({items.length})
        </button>
        {#each ITEM_CATEGORIES as cat}
            {#if groupedItems[cat.id]?.length > 0}
                <button
                    class="tab"
                    class:active={selectedCategory === cat.id}
                    on:click={() => selectedCategory = cat.id}
                >
                    {cat.emoji} {groupedItems[cat.id].length}
                </button>
            {/if}
        {/each}
    </div>

    <!-- Items List -->
    {#if filteredItems.length === 0}
        <div class="empty-state">
            <p>No items yet. {canAddItems ? 'Add the first item!' : ''}</p>
        </div>
    {:else}
        <div class="items-list">
            {#each filteredItems as item (item.id)}
                {@const category = getItemCategory(item.category)}
                {@const available = calculateAvailableSlots(item)}
                {@const claimed = calculateClaimedQuantity(item)}
                {@const myClaim = getUserClaim(item, $currentUser?.user_id)}
                {@const progressPercent = getProgressPercent(item)}
                {@const canAttachRecipe = settings.potluck_allow_recipes && item.allow_recipe !== false}
                {@const canSuggestRecipe = canAttachRecipe && (canAddItems || myClaim)}

                <div class="item-card" class:claimed-full={available === 0}>
                    <div class="item-header">
                        <span class="item-category">{category.emoji}</span>
                        <span class="item-name">{item.name}</span>
                        {#if isOwner}
                            <button class="remove-btn" on:click={() => handleRemoveItem(item.id)}>
                                ✕
                            </button>
                        {/if}
                    </div>

                    <!-- Progress Bar -->
                    <div class="progress-container">
                        <div class="progress-bar" style="width: {progressPercent}%"></div>
                    </div>
                    <div class="progress-text">
                        {claimed} / {item.slots || 1} claimed
                    </div>

                    <!-- Claims List -->
                    {#if item.claims && item.claims.length > 0}
                        <div class="claims-list">
                            {#each item.claims as claim (claim.id)}
                                <div class="claim" class:my-claim={claim.user_id === $currentUser?.user_id}>
                                    <span class="claim-user">{claim.user_name}</span>
                                    <span class="claim-qty">×{claim.quantity_claimed || 1}</span>
                                    {#if claim.status === 'fulfilled'}
                                        <span class="fulfilled-badge">Fulfilled</span>
                                    {/if}
                                    {#if claim.user_id === $currentUser?.user_id}
                                        <button class="unclaim-btn" on:click={() => handleUnclaim(item.id, claim.id)}>
                                            Remove
                                        </button>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}

                    {#if canAttachRecipe}
                        <div class="recipe-row">
                            {#if item.recipe_id}
                                <button class="recipe-btn" on:click={() => push(`/recipes/${item.recipe_id}`)}>
                                    📖 View Recipe
                                </button>
                            {/if}
                            {#if canSuggestRecipe}
                                <button class="recipe-btn secondary" on:click={() => openRecipeModal(item)}>
                                    {item.recipe_id ? 'Replace Recipe' : 'Add Recipe'}
                                </button>
                            {/if}
                        </div>
                    {/if}

                    <!-- Claim Button -->
                    {#if available > 0 && !myClaim}
                        {#if claimingItemId === item.id}
                            <div class="claim-form">
                                <label>
                                    Quantity:
                                    <input
                                        type="number"
                                        bind:value={claimQuantity}
                                        min="1"
                                        max={available}
                                    />
                                </label>
                                <div class="claim-actions">
                                    <button class="cancel-btn" on:click={() => claimingItemId = null}>
                                        Cancel
                                    </button>
                                    <button class="confirm-btn" on:click={() => handleClaim(item.id)}>
                                        Claim
                                    </button>
                                </div>
                            </div>
                        {:else}
                            <button class="claim-btn" on:click={() => claimingItemId = item.id}>
                                I'll bring this
                            </button>
                        {/if}
                    {:else if available === 0 && !myClaim}
                        <div class="claimed-message">All claimed!</div>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    {#if showRecipeModal}
        <div class="recipe-modal" role="dialog" aria-modal="true" on:click|self={handleRecipeCancel}>
            <div class="recipe-modal-content">
                <div class="recipe-modal-header">
                    <h4>{recipeItem?.name ? `Recipe for ${recipeItem.name}` : 'Add Recipe'}</h4>
                    <button class="modal-close" on:click={handleRecipeCancel}>✕</button>
                </div>
                <RecipeForm on:submit={handleRecipeSubmit} on:cancel={handleRecipeCancel} />
            </div>
        </div>
    {/if}
</div>

<style>
    .potluck-section {
        background: var(--cream);
        border-radius: var(--radius-md);
        padding: 20px;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .section-header h3 {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
    }

    .add-btn {
        padding: 8px 16px;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }

    .add-btn:hover {
        background: var(--primary-dark);
    }

    .add-item-form {
        background: white;
        padding: 16px;
        border-radius: var(--radius-sm);
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .add-item-form input[type="text"] {
        padding: 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
    }

    .form-row {
        display: flex;
        gap: 12px;
    }

    .form-row select {
        flex: 1;
        padding: 10px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
    }

    .slots-input {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .slots-input input {
        width: 60px;
        padding: 10px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        text-align: center;
    }

    .submit-btn {
        padding: 12px;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: var(--radius-sm);
        font-weight: 600;
        cursor: pointer;
    }

    .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .category-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        overflow-x: auto;
        padding-bottom: 4px;
    }

    .tab {
        padding: 8px 14px;
        background: white;
        border: 1px solid var(--cream-dark);
        border-radius: 20px;
        font-size: 13px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s ease;
    }

    .tab:hover {
        border-color: var(--primary);
    }

    .tab.active {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
    }

    .empty-state {
        text-align: center;
        padding: 30px;
        color: var(--text-muted);
    }

    .items-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .item-card {
        background: white;
        border-radius: var(--radius-sm);
        padding: 16px;
        border: 1px solid var(--cream-dark);
    }

    .item-card.claimed-full {
        opacity: 0.7;
    }

    .item-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    }

    .item-category {
        font-size: 18px;
    }

    .item-name {
        font-weight: 600;
        flex: 1;
    }

    .remove-btn {
        width: 24px;
        height: 24px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 12px;
        cursor: pointer;
    }

    .remove-btn:hover {
        background: #F44336;
        color: white;
    }

    .progress-container {
        height: 6px;
        background: var(--cream-dark);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 4px;
    }

    .progress-bar {
        height: 100%;
        background: #4CAF50;
        border-radius: 3px;
        transition: width 0.3s ease;
    }

    .progress-text {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 12px;
    }

    .claims-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 12px;
    }

    .claim {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        padding: 6px 10px;
        background: var(--cream);
        border-radius: 6px;
    }

    .claim.my-claim {
        background: color-mix(in srgb, var(--primary) 10%, white);
        border: 1px solid var(--primary);
    }

    .claim-user {
        font-weight: 500;
    }

    .claim-qty {
        color: var(--text-muted);
    }

    .fulfilled-badge {
        background: #4CAF50;
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
    }

    .unclaim-btn {
        margin-left: auto;
        padding: 4px 8px;
        background: #F44336;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
    }

    .claim-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--cream);
        border-radius: 6px;
    }

    .claim-form label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
    }

    .claim-form input {
        width: 60px;
        padding: 6px;
        border: 1px solid var(--cream-dark);
        border-radius: 4px;
        text-align: center;
    }

    .claim-actions {
        display: flex;
        gap: 8px;
    }

    .cancel-btn {
        flex: 1;
        padding: 8px;
        background: var(--cream-dark);
        border: none;
        border-radius: 6px;
        cursor: pointer;
    }

    .confirm-btn {
        flex: 1;
        padding: 8px;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
    }

    .claim-btn {
        width: 100%;
        padding: 10px;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
    }

    .claim-btn:hover {
        background: var(--primary-dark);
    }

    .claimed-message {
        text-align: center;
        padding: 10px;
        color: #4CAF50;
        font-weight: 600;
        font-size: 13px;
    }

    .recipe-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 10px;
    }

    .recipe-btn {
        border: none;
        background: #fff3e0;
        color: #e65100;
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }

    .recipe-btn.secondary {
        background: #e8f5e9;
        color: #2e7d32;
    }

    .recipe-modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        z-index: 300;
    }

    .recipe-modal-content {
        width: min(720px, 100%);
        background: white;
        border-radius: var(--radius-lg);
        padding: 20px;
        box-shadow: var(--shadow-lg);
        max-height: 90vh;
        overflow-y: auto;
    }

    .recipe-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .modal-close {
        border: none;
        background: none;
        font-size: 18px;
        cursor: pointer;
    }
</style>
