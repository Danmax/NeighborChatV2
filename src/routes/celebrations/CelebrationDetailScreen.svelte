<script>
    import { onMount } from 'svelte';
    import { get } from 'svelte/store';
    import { push } from 'svelte-spa-router';
    import { authInitialized } from '../../stores/ui.js';
    import { isAuthenticated } from '../../stores/auth.js';
    import { celebrations } from '../../stores/celebrations.js';
    import { fetchCelebrationById, postComment } from '../../services/celebrations.service.js';
    import CelebrationCard from '../../components/celebrations/CelebrationCard.svelte';
    import GiphyPicker from '../../components/chat/GiphyPicker.svelte';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import { showToast } from '../../stores/toasts.js';

    export let params = {};

    let celebration = null;
    let loading = true;
    let replyMessage = '';
    let replyGif = null;
    let posting = false;
    let showGifPicker = false;

    $: replyCount = celebration?.comments?.length || 0;
    $: if (params?.id) {
        const fromStore = $celebrations.find(item => item.id === params.id);
        if (fromStore) {
            celebration = fromStore;
        }
    }

    $: if ($authInitialized && !$isAuthenticated) {
        push('/auth');
    }

    onMount(async () => {
        if (!$isAuthenticated || !params?.id) return;
        const existing = get(celebrations).find(item => item.id === params.id);
        if (existing) {
            celebration = existing;
            loading = false;
        }

        try {
            const fetched = await fetchCelebrationById(params.id);
            celebration = fetched;
        } catch (err) {
            if (!existing) {
                showToast('Unable to load celebration', 'error');
            }
        } finally {
            loading = false;
        }
    });

    async function handlePostReply() {
        if (posting) return;
        if (!replyMessage.trim() && !replyGif) {
            showToast('Add a message or GIF before posting.', 'error');
            return;
        }

        posting = true;
        try {
            await postComment(celebration.id, replyMessage.trim(), replyGif?.url || null);
            replyMessage = '';
            replyGif = null;
            showToast('Reply posted!', 'success');
        } catch (err) {
            showToast(`Failed to post reply: ${err.message}`, 'error');
        } finally {
            posting = false;
        }
    }

    function handleGifSelect(event) {
        replyGif = event.detail;
        showGifPicker = false;
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString();
    }
</script>

{#if $isAuthenticated}
    <div class="celebration-detail">
        <div class="detail-header">
            <button class="back-btn" on:click={() => push('/celebrations')}>← Back</button>
            <h2 class="card-title">Kudos Detail</h2>
        </div>

        {#if loading}
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading kudos...</p>
            </div>
        {:else if celebration}
            <CelebrationCard {celebration} clickable={false} />

            <div class="reply-card">
                <h3>Replies ({replyCount})</h3>

                <div class="reply-form">
                    <textarea
                        bind:value={replyMessage}
                        placeholder="Write a reply... (GIF optional)"
                        rows="3"
                        maxlength="500"
                    ></textarea>

                    {#if replyGif}
                        <div class="gif-preview">
                            <img src={replyGif.url} alt="Selected GIF" />
                            <button class="btn btn-secondary btn-small" on:click={() => replyGif = null}>
                                Remove
                            </button>
                        </div>
                    {:else}
                        <button class="btn btn-secondary btn-small" on:click={() => showGifPicker = true}>
                            Add GIF
                        </button>
                    {/if}

                    <div class="reply-actions">
                        <button class="btn btn-primary" on:click={handlePostReply} disabled={posting}>
                            {posting ? 'Posting...' : 'Post Reply'}
                        </button>
                    </div>
                </div>

                {#if celebration.comments?.length}
                    <div class="reply-list">
                        {#each celebration.comments as reply (reply.id)}
                            <div class="reply-item">
                                <Avatar avatar={reply.user_avatar} size="sm" />
                                <div class="reply-content">
                                    <div class="reply-meta">
                                        <span class="reply-author">{reply.user_name || 'Neighbor'}</span>
                                        <span class="reply-time">{formatTime(reply.created_at)}</span>
                                    </div>
                                    {#if reply.gif_url}
                                        <img class="reply-gif" src={reply.gif_url} alt="Reply GIF" loading="lazy" />
                                    {/if}
                                    <p class="reply-text">{reply.message || reply.text}</p>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="empty-state">No replies yet. Be the first!</p>
                {/if}
            </div>
        {:else}
            <div class="empty-state">Celebration not found.</div>
        {/if}

        {#if showGifPicker}
            <div class="gif-modal" on:click|self={() => showGifPicker = false}>
                <div class="gif-modal-content">
                    <GiphyPicker
                        show={showGifPicker}
                        on:select={handleGifSelect}
                        on:close={() => showGifPicker = false}
                    />
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .celebration-detail {
        padding-bottom: 20px;
    }

    .detail-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
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

    .reply-card {
        margin-top: 16px;
        background: white;
        border-radius: var(--radius-md);
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .reply-form textarea {
        width: 100%;
        padding: 12px 16px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        min-height: 90px;
    }

    .reply-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
    }

    .reply-list {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .reply-item {
        display: flex;
        gap: 12px;
        background: var(--cream);
        border-radius: var(--radius-sm);
        padding: 12px;
    }

    .reply-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .reply-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--text-muted);
    }

    .reply-author {
        font-weight: 600;
        color: var(--text);
    }

    .reply-gif {
        width: 100%;
        max-height: 240px;
        object-fit: cover;
        border-radius: 10px;
    }

    .reply-text {
        font-size: 14px;
        color: var(--text);
        margin: 0;
    }

    .empty-state {
        text-align: center;
        color: var(--text-muted);
        padding: 20px 0;
    }

    .gif-preview {
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: var(--cream);
        padding: 10px;
        border-radius: var(--radius-sm);
        margin-top: 10px;
    }

    .gif-preview img {
        width: 100%;
        border-radius: 12px;
    }

    .btn {
        padding: 10px 18px;
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

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-small {
        padding: 8px 12px;
        font-size: 12px;
    }

    .gif-modal {
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

    .gif-modal-content {
        width: 100%;
        max-width: 420px;
        background: white;
        border-radius: var(--radius-md);
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .loading-state {
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
</style>
