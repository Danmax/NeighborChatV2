<script>
    import { onMount } from 'svelte';
    import { get } from 'svelte/store';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { celebrations, CELEBRATION_CATEGORIES } from '../../stores/celebrations.js';
    import { fetchCelebrationById, postComment, reactToCelebration, updateCelebrationInDb, uploadCelebrationImage } from '../../services/celebrations.service.js';
    import CelebrationCard from '../../components/celebrations/CelebrationCard.svelte';
    import GiphyPicker from '../../components/chat/GiphyPicker.svelte';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import { showToast } from '../../stores/toasts.js';
    import { toDateInputUtc } from '../../lib/utils/date.js';

    export let params = {};

    let celebration = null;
    let loading = true;
    let replyMessage = '';
    let replyGif = null;
    let posting = false;
    let showGifPicker = false;
    let isEditing = false;
    let editCategory = 'milestone';
    let editTitle = '';
    let editMessage = '';
    let editDate = '';
    let editGif = null;
    let editImageUrl = '';
    let editMusicUrl = '';
    let savingEdit = false;
    let showEditGifPicker = false;
    let uploadingEditImage = false;

    $: replyCount = celebration?.comments?.length || 0;
    $: currentUuid = $currentUser?.user_uuid;
    $: currentClerkId = $currentUser?.user_id;
    $: isOwner = (celebration?.authorId && celebration.authorId === currentUuid)
        || (celebration?.user_id && celebration.user_id === currentClerkId);
    $: isAdmin = $currentUser?.role === 'admin';
    $: canEdit = isOwner || isAdmin;
    $: if (params?.id) {
        const fromStore = $celebrations.find(item => item.id === params.id);
        if (fromStore) {
            celebration = fromStore;
        }
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

    function isValidSpotifyUrl(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) return true;
        return /spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+/.test(trimmed)
            || /spotify:(track|album|playlist):[a-zA-Z0-9]+/.test(trimmed);
    }

    function getSpotifyEmbedUrl(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) return null;
        const webMatch = trimmed.match(/spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
        if (webMatch) {
            return `https://open.spotify.com/embed/${webMatch[1]}/${webMatch[2]}`;
        }
        const uriMatch = trimmed.match(/spotify:(track|album|playlist):([a-zA-Z0-9]+)/);
        if (uriMatch) {
            return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}`;
        }
        return null;
    }

    async function handleReaction(event) {
        const { celebration: target, emoji } = event.detail;
        try {
            await reactToCelebration(target.id, emoji);
        } catch (err) {
            showToast('Failed to update reaction.', 'error');
        }
    }

    function handleEditStart(event) {
        const target = event.detail || celebration;
        if (!target) return;
        editCategory = target.category || target.type || 'milestone';
        editTitle = target.title || '';
        editMessage = target.message || '';
        editDate = toDateInputUtc(target.celebration_date) || '';
        editGif = target.gif_url ? { url: target.gif_url } : null;
        editImageUrl = target.image_url || '';
        editMusicUrl = target.music_url || '';
        isEditing = true;
    }

    async function handleEditSave() {
        if (savingEdit || !celebration) return;
        if ((editCategory === 'birthday' || editCategory === 'anniversary') && !editDate) {
            showToast('Please select a date for this celebration.', 'error');
            return;
        }
        if (!isValidSpotifyUrl(editMusicUrl)) {
            showToast('Please use a valid Spotify track/album/playlist link.', 'error');
            return;
        }
        savingEdit = true;
        try {
            await updateCelebrationInDb(celebration.id, {
                category: editCategory,
                title: editTitle.trim() || null,
                message: editMessage.trim() || null,
                gif_url: editGif?.url || null,
                image_url: editImageUrl || null,
                music_url: editMusicUrl.trim() || null,
                celebration_date: toDateInputUtc(editDate) || null
            });
            celebration = await fetchCelebrationById(celebration.id);
            showToast('Celebration updated!', 'success');
            isEditing = false;
        } catch (err) {
            showToast(`Failed to update celebration: ${err.message}`, 'error');
        } finally {
            savingEdit = false;
        }
    }

    function handleEditCancel() {
        isEditing = false;
        showEditGifPicker = false;
    }

    function handleEditGifSelect(event) {
        editGif = event.detail;
        showEditGifPicker = false;
    }

    async function handleEditImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        uploadingEditImage = true;
        try {
            editImageUrl = await uploadCelebrationImage(file);
        } catch (err) {
            showToast(`Failed to upload image: ${err.message}`, 'error');
        } finally {
            uploadingEditImage = false;
        }
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
            {#if canEdit}
                <div class="edit-header">
                    <button class="btn btn-secondary btn-small" on:click={() => (isEditing ? handleEditCancel() : handleEditStart({ detail: celebration }))}>
                        {isEditing ? 'Cancel Edit' : 'Edit'}
                    </button>
                </div>
            {/if}

            {#if isEditing}
                <div class="edit-card">
                    <h3>Edit Celebration</h3>
                    <label>
                        Type
                        <select bind:value={editCategory}>
                            {#each CELEBRATION_CATEGORIES as option}
                                <option value={option.id}>{option.emoji} {option.label}</option>
                            {/each}
                        </select>
                    </label>
                    <label>
                        Title
                        <input type="text" bind:value={editTitle} placeholder="Celebration title" maxlength="120" />
                    </label>
                    <label>
                        Message
                        <textarea bind:value={editMessage} rows="3" maxlength="500"></textarea>
                    </label>
                    <label>
                        Image
                        {#if editImageUrl}
                            <div class="gif-preview">
                                <img src={editImageUrl} alt="Celebration image" />
                                <button class="btn btn-secondary btn-small" on:click={() => editImageUrl = ''}>
                                    Remove
                                </button>
                            </div>
                        {:else}
                            <input type="file" accept="image/*" on:change={handleEditImageUpload} />
                            {#if uploadingEditImage}
                                <span class="helper-text">Uploading image…</span>
                            {/if}
                        {/if}
                    </label>
                    <label>
                        Music (Spotify link)
                        <input
                            type="url"
                            bind:value={editMusicUrl}
                            placeholder="https://open.spotify.com/track/..."
                        />
                        <span class="helper-text">Supports track, album, or playlist links.</span>
                    </label>
                    {#if editCategory === 'birthday' || editCategory === 'anniversary'}
                        <label>
                            Date
                            <input type="date" bind:value={editDate} />
                        </label>
                    {/if}
                    <div class="gif-row">
                        {#if editGif}
                            <div class="gif-preview">
                                <img src={editGif.url} alt="Selected GIF" />
                                <button class="btn btn-secondary btn-small" on:click={() => editGif = null}>
                                    Remove
                                </button>
                            </div>
                        {:else}
                            <button class="btn btn-secondary btn-small" on:click={() => showEditGifPicker = true}>
                                Add GIF
                            </button>
                        {/if}
                    </div>
                    <div class="edit-actions">
                        <button class="btn btn-secondary" on:click={handleEditCancel}>Cancel</button>
                        <button class="btn btn-primary" on:click={handleEditSave} disabled={savingEdit}>
                            {savingEdit ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            {/if}

            <CelebrationCard
                {celebration}
                clickable={false}
                showCommentsPreview={false}
                on:reaction={handleReaction}
                on:edit={handleEditStart}
            />

            {#if celebration.music_url}
                {@const musicEmbed = getSpotifyEmbedUrl(celebration.music_url)}
                {#if musicEmbed}
                    <div class="music-embed">
                        <iframe
                            title="Celebration music"
                            src={musicEmbed}
                            width="100%"
                            height="152"
                            frameborder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                        ></iframe>
                    </div>
                {/if}
            {/if}

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
                                <button class="reply-avatar" type="button" on:click={() => reply.user_id && push(`/profile/view/${reply.user_id}`)}>
                                    <Avatar avatar={reply.user_avatar} size="sm" />
                                </button>
                                <div class="reply-content">
                                    <div class="reply-meta">
                                        <button class="reply-author" type="button" on:click={() => reply.user_id && push(`/profile/view/${reply.user_id}`)}>
                                            {reply.user_name || 'Neighbor'}
                                        </button>
                                        <span class="reply-time">{formatTime(reply.created_at)}</span>
                                    </div>
                                    {#if reply.gif_url}
                                        <img class="reply-gif" src={reply.gif_url} alt="Reply GIF" loading="lazy" />
                                    {/if}
                                    {#if reply.message || reply.text}
                                        <p class="reply-text">{reply.message || reply.text}</p>
                                    {/if}
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
            <div
                class="gif-modal"
                role="button"
                tabindex="0"
                on:click|self={() => showGifPicker = false}
                on:keydown={(e) => (e.key === 'Enter' || e.key === 'Escape') && (showGifPicker = false)}
            >
                <div class="gif-modal-content">
                    <GiphyPicker
                        show={showGifPicker}
                        on:select={handleGifSelect}
                        on:close={() => showGifPicker = false}
                    />
                </div>
            </div>
        {/if}

        {#if showEditGifPicker}
            <div
                class="gif-modal"
                role="button"
                tabindex="0"
                on:click|self={() => showEditGifPicker = false}
                on:keydown={(e) => (e.key === 'Enter' || e.key === 'Escape') && (showEditGifPicker = false)}
            >
                <div class="gif-modal-content">
                    <GiphyPicker
                        show={showEditGifPicker}
                        on:select={handleEditGifSelect}
                        on:close={() => showEditGifPicker = false}
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

    .edit-header {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 12px;
    }

    .edit-card {
        background: white;
        border-radius: var(--radius-md);
        padding: 20px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .edit-card label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        color: var(--text-muted);
    }

    .edit-card input,
    .edit-card textarea,
    .edit-card select {
        padding: 10px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        font-size: 14px;
    }

    .gif-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }

    .helper-text {
        font-size: 12px;
        color: var(--text-muted);
    }

    .music-embed {
        margin: 12px 0 20px;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        background: #fff;
    }

    .edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
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
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
    }

    .reply-avatar {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
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
