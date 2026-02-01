<script>
    import { authInitialized } from '../../stores/ui.js';
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import {
        celebrations,
        celebrationsLoading,
        CELEBRATION_CATEGORIES,
        addReaction,
        removeReaction
    } from '../../stores/celebrations.js';
    import {
        fetchCelebrations,
        createCelebration,
        updateReactions,
        postComment
    } from '../../services/celebrations.service.js';
    import CelebrationCard from '../../components/celebrations/CelebrationCard.svelte';

    // Redirect if not authenticated
    $: if ($authInitialized && !$isAuthenticated) {
        console.log('🔐 CelebrationsScreen: Not authenticated, redirecting to /auth');
        push('/auth');
    }

    let showCreateForm = false;
    let creating = false;

    // Form fields
    let category = 'milestone';
    let title = '';
    let message = '';

    onMount(() => {
        if ($isAuthenticated) {
            fetchCelebrations();
        }
    });

    async function handleCreate() {
        if (!message.trim() || creating) return;

        creating = true;
        try {
            await createCelebration({
                category,
                title: title.trim() || null,
                message: message.trim()
            });
            // Reset form
            category = 'milestone';
            title = '';
            message = '';
            showCreateForm = false;
        } catch (err) {
            console.error('Failed to create celebration:', err);
        } finally {
            creating = false;
        }
    }

    async function handleReaction(event) {
        const { celebration, emoji, remove } = event.detail;

        if (remove) {
            removeReaction(celebration.id, emoji);
        } else {
            addReaction(celebration.id, emoji);
        }

        // Sync to database
        const updatedReactions = { ...(celebration.reactions || {}) };
        const userId = $currentUser.user_id;

        if (remove) {
            if (updatedReactions[emoji]) {
                updatedReactions[emoji] = updatedReactions[emoji].filter(id => id !== userId);
                if (updatedReactions[emoji].length === 0) {
                    delete updatedReactions[emoji];
                }
            }
        } else {
            if (!updatedReactions[emoji]) {
                updatedReactions[emoji] = [];
            }
            if (!updatedReactions[emoji].includes(userId)) {
                updatedReactions[emoji] = [...updatedReactions[emoji], userId];
            }
        }

        try {
            await updateReactions(celebration.id, updatedReactions);
        } catch (err) {
            console.error('Failed to update reactions:', err);
        }
    }

    function handleComment(event) {
        // Could open a comment modal
        console.log('Comment on:', event.detail);
    }
</script>

{#if $isAuthenticated}
    <div class="celebrations-screen">
        <div class="screen-header">
            <button class="back-btn" on:click={() => push('/')}>← Back</button>
            <h2 class="card-title">
                <span class="icon">🎉</span>
                Celebration Wall
            </h2>
        </div>

        <!-- Create Celebration Button -->
        {#if !showCreateForm}
            <button
                class="create-celebration-btn"
                on:click={() => showCreateForm = true}
            >
                <span class="create-icon">✨</span>
                Share something to celebrate!
            </button>
        {/if}

        <!-- Create Form -->
        {#if showCreateForm}
            <div class="card create-form">
                <h3 class="card-title">
                    <span class="icon">✨</span>
                    New Celebration
                </h3>

                <div class="form-group">
                    <label>Category</label>
                    <div class="category-selector">
                        {#each CELEBRATION_CATEGORIES as cat}
                            <button
                                type="button"
                                class="category-btn"
                                class:selected={category === cat.id}
                                on:click={() => category = cat.id}
                            >
                                {cat.emoji}
                            </button>
                        {/each}
                    </div>
                </div>

                <div class="form-group">
                    <label for="title">Title (optional)</label>
                    <input
                        id="title"
                        type="text"
                        bind:value={title}
                        placeholder="What are we celebrating?"
                        maxlength="100"
                    />
                </div>

                <div class="form-group">
                    <label for="message">Message *</label>
                    <textarea
                        id="message"
                        bind:value={message}
                        placeholder="Share your good news..."
                        rows="3"
                        maxlength="500"
                    ></textarea>
                </div>

                <div class="form-actions">
                    <button
                        class="btn btn-secondary"
                        on:click={() => showCreateForm = false}
                        disabled={creating}
                    >
                        Cancel
                    </button>
                    <button
                        class="btn btn-primary"
                        on:click={handleCreate}
                        disabled={!message.trim() || creating}
                    >
                        {creating ? 'Posting...' : '🎉 Celebrate!'}
                    </button>
                </div>
            </div>
        {/if}

        <!-- Celebrations Feed -->
        <div class="celebrations-feed">
            {#if $celebrationsLoading}
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading celebrations...</p>
                </div>
            {:else if $celebrations.length === 0}
                <div class="empty-state">
                    <div class="empty-icon">🎊</div>
                    <p>No celebrations yet</p>
                    <p class="empty-hint">Be the first to share something to celebrate!</p>
                </div>
            {:else}
                {#each $celebrations as celebration (celebration.id)}
                    <CelebrationCard
                        {celebration}
                        on:reaction={handleReaction}
                        on:comment={handleComment}
                    />
                {/each}
            {/if}
        </div>
    </div>
{/if}

<style>
    .celebrations-screen {
        padding-bottom: 20px;
    }

    .screen-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
    }

    .screen-header .card-title {
        margin: 0;
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

    .create-celebration-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 16px;
        border: 2px dashed var(--cream-dark);
        border-radius: var(--radius-md);
        background: white;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.2s ease;
        margin-bottom: 20px;
    }

    .create-celebration-btn:hover {
        border-color: var(--primary);
        color: var(--primary);
    }

    .create-icon {
        font-size: 20px;
    }

    .card {
        background: white;
        border-radius: var(--radius-md);
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .card-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 18px;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 16px;
    }

    .icon {
        font-size: 24px;
    }

    .form-group {
        margin-bottom: 16px;
    }

    .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 8px;
    }

    .form-group input,
    .form-group textarea {
        width: 100%;
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

    .category-selector {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .category-btn {
        width: 44px;
        height: 44px;
        border: 2px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        background: white;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .category-btn:hover {
        border-color: var(--primary-light);
    }

    .category-btn.selected {
        border-color: var(--primary);
        background: var(--cream);
    }

    .form-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
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

    .celebrations-feed {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .loading-state, .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
    }

    .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--cream-dark);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
    }

    .empty-hint {
        font-size: 13px;
        opacity: 0.7;
        margin-top: 4px;
    }
</style>
