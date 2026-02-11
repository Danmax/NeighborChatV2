<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import {
        celebrations,
        celebrationsLoading,
        CELEBRATION_CATEGORIES,
        getCelebrationCategory,
        addReaction,
        removeReaction
    } from '../../stores/celebrations.js';
    import {
        fetchCelebrations,
        createCelebration,
        updateCelebrationInDb,
        updateReactions,
        reactToCelebration,
        postComment,
        uploadCelebrationImage
    } from '../../services/celebrations.service.js';
    import GiphyPicker from '../../components/chat/GiphyPicker.svelte';
    import { showToast } from '../../stores/toasts.js';
    import { toDateInputUtc } from '../../lib/utils/date.js';
    import { getClerkToken } from '../../lib/clerk.js';
    import { getCelebrationPseudoDate } from '../../lib/utils/celebrationDates.js';

    let showCreateForm = false;
    let creating = false;
    let showGifPicker = false;
    let selectedGif = null;
    let editingCelebration = null;
    let imageUrl = '';
    let uploadingImage = false;
    let musicUrl = '';
    let spotifyQuery = '';
    let spotifyResults = [];
    let searchingSpotify = false;
    let spotifyError = '';
    let spotifyEmbedPreviewTrackId = null;

    // Form fields
    let category = 'milestone';
    let title = '';
    let message = '';
    let celebrationDate = '';

    function isValidSpotifyUrl(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) return true;
        return /spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+/.test(trimmed)
            || /spotify:(track|album|playlist):[a-zA-Z0-9]+/.test(trimmed);
    }

    async function searchSpotifyTracks() {
        if (!spotifyQuery.trim()) return;
        searchingSpotify = true;
        spotifyError = '';
        try {
            const accessToken = await getClerkToken();
            const res = await fetch(`/api/spotify-search?q=${encodeURIComponent(spotifyQuery.trim())}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Search failed');
            }
            spotifyResults = data.results || [];
            spotifyEmbedPreviewTrackId = null;
        } catch (err) {
            spotifyError = err.message || 'Search failed';
        } finally {
            searchingSpotify = false;
        }
    }

    function handleSpotifyPreviewPlay(event) {
        const currentAudio = event.currentTarget;
        const resultsContainer = currentAudio?.closest('.spotify-results');
        if (!resultsContainer) return;
        resultsContainer.querySelectorAll('audio').forEach(audio => {
            if (audio !== currentAudio) {
                audio.pause();
            }
        });
    }

    function toggleSpotifyEmbedPreview(trackId) {
        spotifyEmbedPreviewTrackId = spotifyEmbedPreviewTrackId === trackId ? null : trackId;
    }

    function getSpotifyTrackEmbedUrl(track) {
        if (track?.id) {
            return `https://open.spotify.com/embed/track/${track.id}`;
        }
        const uriMatch = (track?.uri || '').match(/^spotify:track:([a-zA-Z0-9]+)$/);
        if (uriMatch) {
            return `https://open.spotify.com/embed/track/${uriMatch[1]}`;
        }
        const webMatch = (track?.url || '').match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
        if (webMatch) {
            return `https://open.spotify.com/embed/track/${webMatch[1]}`;
        }
        return null;
    }

    function handleSelectSpotifyTrack(track) {
        musicUrl = track?.url || track?.uri || '';
        spotifyResults = [];
        spotifyQuery = '';
        spotifyError = '';
        spotifyEmbedPreviewTrackId = null;
    }

    onMount(() => {
        if ($isAuthenticated) {
            fetchCelebrations();
        }
    });

    async function handleCreate() {
        if (!message.trim() || creating) return;
        if ((category === 'birthday' || category === 'anniversary') && !celebrationDate) {
            showToast('Please select a date for this celebration.', 'error');
            return;
        }
        if (!isValidSpotifyUrl(musicUrl)) {
            showToast('Please use a valid Spotify track/album/playlist link.', 'error');
            return;
        }

        creating = true;
        try {
            const payload = {
                category,
                title: title.trim() || null,
                message: message.trim(),
                gif_url: selectedGif?.url || null,
                image_url: imageUrl || null,
                music_url: musicUrl.trim() || null,
                celebration_date: toDateInputUtc(celebrationDate) || null
            };

            if (editingCelebration) {
                await updateCelebrationInDb(editingCelebration.id, payload);
                showToast('Kudos updated!', 'success');
            } else {
                await createCelebration(payload);
                showToast('Kudos posted!', 'success');
            }

            // Reset form
            category = 'milestone';
            title = '';
            message = '';
            celebrationDate = '';
            selectedGif = null;
            imageUrl = '';
            musicUrl = '';
            spotifyQuery = '';
            spotifyResults = [];
            spotifyError = '';
            editingCelebration = null;
            showCreateForm = false;
        } catch (err) {
            console.error('Failed to create celebration:', err);
            showToast(`Failed to post kudos: ${err.message}`, 'error');
        } finally {
            creating = false;
        }
    }

    function handleGifSelect(event) {
        selectedGif = event.detail;
        if (!message.trim() && selectedGif?.message) {
            message = selectedGif.message;
        }
        showGifPicker = false;
    }

    function handleEdit(event) {
        const celebration = event.detail;
        editingCelebration = celebration;
        category = celebration.category || celebration.type || 'milestone';
        title = celebration.title || '';
        message = celebration.message || '';
        celebrationDate = toDateInputUtc(celebration.celebration_date) || '';
        selectedGif = celebration.gif_url ? { url: celebration.gif_url } : null;
        imageUrl = celebration.image_url || '';
        musicUrl = celebration.music_url || '';
        spotifyQuery = '';
        spotifyResults = [];
        spotifyError = '';
        showCreateForm = true;
    }

    async function handleImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        uploadingImage = true;
        try {
            imageUrl = await uploadCelebrationImage(file);
        } catch (err) {
            showToast(`Failed to upload image: ${err.message}`, 'error');
        } finally {
            uploadingImage = false;
        }
    }

    async function handleArchive() {
        if (!editingCelebration) return;
        creating = true;
        try {
            await updateCelebrationInDb(editingCelebration.id, { archived: true });
            showToast('Kudos archived', 'success');
            editingCelebration = null;
            showCreateForm = false;
        } catch (err) {
            showToast(`Failed to archive: ${err.message}`, 'error');
        } finally {
            creating = false;
        }
    }

    function handleShareBoard() {
        const url = `${window.location.origin}/#/celebrations`;
        navigator.clipboard?.writeText(url);
        showToast('Kudos board link copied!', 'success');
    }

    async function handleReaction(event) {
        const { celebration, emoji } = event.detail;
        try {
            await reactToCelebration(celebration.id, emoji);
            showToast('Reaction added!', 'success');
        } catch (err) {
            console.error('Failed to update reactions:', err);
            showToast(err.message || 'Failed to add reaction. Please try again.', 'error');
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
                Kudos Board
            </h2>
            <button class="btn btn-secondary btn-small" on:click={handleShareBoard}>
                🔗 Share
            </button>
        </div>

        <!-- Create Celebration Button -->
        {#if !showCreateForm}
            <button
                class="create-celebration-btn"
                on:click={() => showCreateForm = true}
            >
                <span class="create-icon">✨</span>
                Give kudos to your community
            </button>
        {/if}

        <!-- Create Form -->
        {#if showCreateForm}
            <div class="card create-form">
                <h3 class="card-title">
                    <span class="icon">✨</span>
                    New Kudos
                </h3>

                <fieldset class="form-group">
                    <legend>Category</legend>
                    <div class="category-selector" role="group" aria-label="Category">
                        {#each CELEBRATION_CATEGORIES as cat}
                            <button
                                type="button"
                                class="category-btn"
                                class:selected={category === cat.id}
                                on:click={() => category = cat.id}
                            >
                                <span class="category-emoji">{cat.emoji}</span>
                                <span class="category-label">{cat.label}</span>
                            </button>
                        {/each}
                    </div>
                </fieldset>

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
                        placeholder="Share a shout-out or thank you... (use @username to mention)"
                        rows="3"
                        maxlength="500"
                    ></textarea>
                </div>

                {#if category === 'birthday' || category === 'anniversary'}
                    <div class="form-group">
                        <label for="celebration-date">Date *</label>
                        <input
                            id="celebration-date"
                            type="date"
                            bind:value={celebrationDate}
                            required
                        />
                    </div>
                {/if}

                <fieldset class="form-group">
                    <legend>GIF (optional)</legend>
                    {#if selectedGif}
                        <div class="gif-preview">
                            <img src={selectedGif.url} alt="Selected GIF" />
                            <button class="btn btn-secondary btn-small" on:click={() => selectedGif = null}>
                                Remove
                            </button>
                        </div>
                    {:else}
                        <button class="btn btn-secondary btn-small" on:click={() => showGifPicker = true}>
                            Add GIF
                        </button>
                    {/if}
                </fieldset>

                <fieldset class="form-group">
                    <legend>Image (optional)</legend>
                    {#if imageUrl}
                        <div class="gif-preview">
                            <img src={imageUrl} alt="Celebration image" />
                            <button class="btn btn-secondary btn-small" on:click={() => imageUrl = ''}>
                                Remove
                            </button>
                        </div>
                    {:else}
                        <input type="file" accept="image/*" on:change={handleImageUpload} />
                        {#if uploadingImage}
                            <span class="helper-text">Uploading image…</span>
                        {/if}
                    {/if}
                </fieldset>

                <div class="form-group">
                    <label for="music_url">Music (Spotify link)</label>
                    <input
                        id="music_url"
                        type="url"
                        bind:value={musicUrl}
                        placeholder="https://open.spotify.com/track/..."
                    />
                    <span class="helper-text">Supports track, album, or playlist links.</span>
                </div>

                <div class="spotify-search">
                    <div class="spotify-search-row">
                        <input
                            type="text"
                            placeholder="Search for a song..."
                            bind:value={spotifyQuery}
                            on:keydown={(e) => e.key === 'Enter' && searchSpotifyTracks()}
                        />
                        <button
                            class="btn btn-secondary"
                            on:click={searchSpotifyTracks}
                            disabled={searchingSpotify || !spotifyQuery.trim()}
                        >
                            {searchingSpotify ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                    {#if spotifyError}
                        <div class="spotify-error">{spotifyError}</div>
                    {/if}
                    {#if spotifyResults.length > 0}
                        <div class="spotify-results">
                            {#each spotifyResults as track (track.id)}
                                <div class="spotify-track-card">
                                    {#if track.image_url}
                                        <img src={track.image_url} alt={track.title} />
                                    {/if}
                                    <div class="spotify-track-info">
                                        <div class="spotify-track-title">{track.title}</div>
                                        <div class="spotify-track-meta">
                                            {track.artists}{#if track.album} • {track.album}{/if}
                                        </div>
                                        {#if track.preview_url}
                                            <audio
                                                class="spotify-preview"
                                                controls
                                                preload="none"
                                                src={track.preview_url}
                                                on:play={handleSpotifyPreviewPlay}
                                            ></audio>
                                        {:else}
                                            <button
                                                class="btn btn-secondary btn-small spotify-preview-fallback-btn"
                                                type="button"
                                                on:click={() => toggleSpotifyEmbedPreview(track.id)}
                                            >
                                                {spotifyEmbedPreviewTrackId === track.id ? 'Hide Preview' : 'Preview'}
                                            </button>
                                            {#if spotifyEmbedPreviewTrackId === track.id}
                                                {@const embedUrl = getSpotifyTrackEmbedUrl(track)}
                                                {#if embedUrl}
                                                    <iframe
                                                        class="spotify-preview-embed"
                                                        title={`Spotify preview ${track.title}`}
                                                        src={embedUrl}
                                                        width="100%"
                                                        height="80"
                                                        frameborder="0"
                                                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                                        loading="lazy"
                                                    ></iframe>
                                                {/if}
                                            {/if}
                                        {/if}
                                    </div>
                                    <button
                                        class="btn btn-secondary btn-small"
                                        on:click={() => handleSelectSpotifyTrack(track)}
                                    >
                                        Use
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="form-actions">
                    <button
                        class="btn btn-secondary"
                        on:click={() => showCreateForm = false}
                        disabled={creating}
                    >
                        Cancel
                    </button>
                    {#if editingCelebration}
                        <button class="btn btn-secondary" on:click={handleArchive} disabled={creating}>
                            Archive
                        </button>
                    {/if}
                    <button
                        class="btn btn-primary"
                        on:click={handleCreate}
                        disabled={!message.trim() || creating}
                    >
                        {creating ? 'Posting...' : editingCelebration ? 'Save' : '🎉 Post Kudos'}
                    </button>
                </div>
            </div>
        {/if}

        <!-- Celebrations Feed -->
        {#if !showCreateForm}
            <div class="celebrations-feed">
                {#if $celebrationsLoading}
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading kudos...</p>
                    </div>
                {:else if $celebrations.length === 0}
                    <div class="empty-state">
                        <div class="empty-icon">🎊</div>
                        <p>No kudos yet</p>
                        <p class="empty-hint">Be the first to share a shout-out!</p>
                    </div>
                {:else}
                    <div class="celebrations-grid">
                        {#each $celebrations as celebration (celebration.id)}
                            {@const pseudoDate = getCelebrationPseudoDate(
                                celebration.category || celebration.type,
                                celebration.celebration_date
                            )}
                            <button
                                type="button"
                                class="celebration-feed-card"
                                on:click={() => push(`/celebrations/${celebration.id}`)}
                            >
                                <div class="feed-media">
                                    {#if celebration.gif_url || celebration.image || celebration.image_url}
                                        <img
                                            src={celebration.gif_url || celebration.image || celebration.image_url}
                                            alt="Celebration media"
                                            loading="lazy"
                                        />
                                    {:else}
                                        <div class="media-fallback">
                                            <span>{getCelebrationCategory(celebration.category).emoji}</span>
                                        </div>
                                    {/if}
                                    <div class="feed-type">
                                        <span class="feed-emoji">{getCelebrationCategory(celebration.category).emoji}</span>
                                        <span class="feed-type-label">{getCelebrationCategory(celebration.category).label}</span>
                                    </div>
                                </div>

                                <div class="feed-body">
                                    {#if celebration.title}
                                        <h3 class="feed-title">{celebration.title}</h3>
                                    {:else}
                                        <h3 class="feed-title">Kudos</h3>
                                    {/if}

                                    {#if pseudoDate}
                                        <div class="feed-pseudo-date">
                                            <span class="feed-pseudo-primary">{pseudoDate.primary}</span>
                                            <span class="feed-pseudo-secondary">{pseudoDate.secondary}</span>
                                        </div>
                                    {/if}

                                    {#if celebration.message}
                                        <p class="feed-message">
                                            {celebration.message}
                                        </p>
                                    {/if}

                                    {#if celebration.message && celebration.message.includes('@')}
                                        <div class="feed-mentions">
                                            {celebration.message.match(/@[a-zA-Z0-9_-]+/g)?.slice(0, 3).join(' ')}
                                        </div>
                                    {/if}
                                </div>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
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

    .helper-text {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 6px;
        display: block;
    }

    .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 8px;
    }

    .form-group legend {
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
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border: 2px solid var(--cream-dark);
        border-radius: 999px;
        background: white;
        font-size: 13px;
        font-weight: 600;
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

    .category-emoji {
        font-size: 18px;
        line-height: 1;
    }

    .category-label {
        color: var(--text);
    }

    .form-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
    }

    .gif-preview {
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: var(--cream);
        padding: 10px;
        border-radius: var(--radius-sm);
    }

    .gif-preview img {
        width: 100%;
        border-radius: 12px;
    }

    .spotify-search {
        margin: 12px 0 16px;
    }

    .spotify-search-row {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .spotify-search-row input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
    }

    .spotify-error {
        color: #c62828;
        font-size: 12px;
        margin-top: 6px;
    }

    .spotify-results {
        display: grid;
        gap: 10px;
        margin-top: 12px;
    }

    .spotify-track-card {
        display: grid;
        grid-template-columns: 54px 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 10px;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        background: white;
    }

    .spotify-track-card img {
        width: 54px;
        height: 54px;
        object-fit: cover;
        border-radius: 8px;
    }

    .spotify-track-title {
        font-weight: 600;
        font-size: 14px;
    }

    .spotify-track-meta {
        font-size: 12px;
        color: var(--text-muted);
    }

    .spotify-preview {
        margin-top: 8px;
        width: 100%;
        max-width: 260px;
        height: 32px;
    }

    .spotify-preview-fallback-btn {
        margin-top: 8px;
    }

    .spotify-preview-embed {
        margin-top: 8px;
        border: 0;
        border-radius: 10px;
        overflow: hidden;
        width: 100%;
        max-width: 320px;
        background: #fff;
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

    .celebrations-feed {
        width: 100%;
        max-width: 980px;
        margin: 0 auto;
    }

    .celebrations-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
    }

    .celebration-feed-card {
        background: white;
        border-radius: var(--radius-md);
        overflow: hidden;
        border: 1px solid var(--cream-dark);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        text-align: left;
        padding: 0;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        display: flex;
        flex-direction: column;
    }

    .celebration-feed-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
    }

    .feed-media {
        position: relative;
        aspect-ratio: 4 / 3;
        background: #f4f4f4;
        overflow: hidden;
    }

    .feed-media img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        background: #f4f4f4;
    }

    .media-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 42px;
        color: var(--text-muted);
        background: linear-gradient(135deg, #f5f5f5, #e9e9e9);
    }

    .feed-type {
        position: absolute;
        left: 12px;
        bottom: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 0, 0, 0.65);
        color: white;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
    }

    .feed-emoji {
        font-size: 14px;
    }

    .feed-body {
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .feed-title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--text);
    }

    .feed-message {
        margin: 0;
        font-size: 13px;
        color: var(--text-light);
        line-height: 1.5;
        max-height: 3.6em;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    .feed-pseudo-date {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--cream-dark);
        background: var(--cream);
    }

    .feed-pseudo-primary {
        font-size: 12px;
        font-weight: 700;
        color: var(--text);
    }

    .feed-pseudo-secondary {
        font-size: 11px;
        color: var(--text-muted);
    }

    .feed-mentions {
        font-size: 12px;
        color: var(--primary);
        font-weight: 600;
        display: inline-flex;
        gap: 6px;
        flex-wrap: wrap;
    }

    @media (max-width: 720px) {
        .celebrations-grid {
            grid-template-columns: 1fr;
        }
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
