<script>
    import { createEventDispatcher } from 'svelte';
    import Avatar from '../avatar/Avatar.svelte';
    import { saveContact } from '../../services/contacts.service.js';
    import { isContact } from '../../stores/contacts.js';
    import { showToast } from '../../stores/toasts.js';
    import { fetchFavoriteMovies } from '../../services/profile.service.js';

    export let show = false;
    export let user = null;

    const dispatch = createEventDispatcher();
    let saving = false;
    let favoriteMovies = [];
    let loadingFavorites = false;

    $: alreadySaved = user?.user_id ? isContact(user.user_id) : false;
    $: if (show && user?.user_id) {
        loadFavorites(user.user_id);
    }

    async function loadFavorites(userId) {
        loadingFavorites = true;
        try {
            favoriteMovies = await fetchFavoriteMovies(userId);
        } catch (err) {
            favoriteMovies = [];
        } finally {
            loadingFavorites = false;
        }
    }

    async function handleSave() {
        if (!user || saving || alreadySaved) return;

        // Validate user_id before saving
        if (!user.user_id) {
            console.error('[ContactQuickCard] Cannot save contact - no user_id:', user);
            showToast('Cannot save contact - user information is incomplete.', 'error');
            return;
        }

        saving = true;
        try {
            console.log('[ContactQuickCard] Saving contact with user_id:', user.user_id);
            await saveContact({
                user_id: user.user_id,
                name: user.name,
                avatar: user.avatar,
                interests: user.interests || []
            });
            showToast(`${user.name} added to contacts`, 'success');
            dispatch('saved');
        } catch (err) {
            showToast(`Failed to save contact: ${err.message}`, 'error');
        } finally {
            saving = false;
        }
    }

    function close() {
        dispatch('close');
    }
</script>

{#if show && user}
    <div
        class="modal-overlay"
        on:click|self={close}
        on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && close()}
        role="button"
        tabindex="0"
        aria-label="Close contact card"
    >
        <div class="modal-content">
            <div class="modal-header">
                <h3>Contact</h3>
                <button class="modal-close" on:click={close}>✕</button>
            </div>
            <div class="modal-body">
                <div class="contact-preview">
                    <Avatar avatar={user.avatar} size="lg" />
                    <div class="contact-details">
                        <h4>{user.name}</h4>
                        {#if user.username}
                            <span class="username">@{user.username}</span>
                        {/if}
                    </div>
                </div>

                {#if user.interests?.length}
                    <div class="contact-interests">
                        Interests: {user.interests.join(', ')}
                    </div>
                {/if}

                <div class="contact-favorites">
                    <div class="favorites-title">Favorite Movies</div>
                    {#if loadingFavorites}
                        <div class="favorites-loading">Loading...</div>
                    {:else if favoriteMovies.length === 0}
                        <div class="favorites-empty">No favorites yet.</div>
                    {:else}
                        <div class="favorites-grid">
                            {#each favoriteMovies.slice(0, 4) as movie (movie.id)}
                                <div class="favorite-tile">
                                    {#if movie.poster_url}
                                        <img src={movie.poster_url} alt={movie.title} />
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <button
                    class="btn btn-primary btn-full"
                    on:click={handleSave}
                    disabled={saving || alreadySaved}
                >
                    {alreadySaved ? 'Already in Contacts' : saving ? 'Saving...' : 'Add to Contacts'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }

    .modal-content {
        background: white;
        border-radius: var(--radius-lg, 16px);
        max-width: 360px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--cream-dark, #E0E0E0);
    }

    .modal-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
    }

    .modal-close {
        width: 28px;
        height: 28px;
        border: none;
        background: var(--cream, #F5F5DC);
        border-radius: 50%;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .contact-preview {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .contact-details h4 {
        margin: 0;
        font-size: 16px;
        color: var(--text);
    }

    .username {
        font-size: 12px;
        color: var(--text-muted);
    }

    .contact-interests {
        font-size: 12px;
        color: var(--text-muted);
    }

    .contact-favorites {
        display: grid;
        gap: 8px;
    }

    .favorites-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
    }

    .favorites-loading,
    .favorites-empty {
        font-size: 12px;
        color: var(--text-muted);
    }

    .favorites-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
    }

    .favorite-tile {
        width: 100%;
        aspect-ratio: 2 / 3;
        border-radius: 8px;
        overflow: hidden;
        background: var(--cream);
        border: 1px solid var(--cream-dark);
    }

    .favorite-tile img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-full {
        width: 100%;
    }
</style>
