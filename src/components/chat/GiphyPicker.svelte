<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { searchGifs, getTrendingGifs } from '../../services/giphy.service.js';

    export let show = false;

    const dispatch = createEventDispatcher();

    let searchQuery = '';
    let gifs = [];
    let loading = false;
    let searchTimeout = null;
    let selectedGif = null;
    let messageWithGif = '';

    onMount(() => {
        if (show) {
            loadTrending();
        }
    });

    $: if (show && gifs.length === 0) {
        loadTrending();
    }

    // Reset when closed
    $: if (!show) {
        selectedGif = null;
        messageWithGif = '';
    }

    async function loadTrending() {
        loading = true;
        gifs = await getTrendingGifs(24);
        loading = false;
    }

    async function handleSearch() {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        if (!searchQuery.trim()) {
            loadTrending();
            return;
        }

        searchTimeout = setTimeout(async () => {
            loading = true;
            gifs = await searchGifs(searchQuery.trim(), 24);
            loading = false;
        }, 300);
    }

    function selectGif(gif) {
        selectedGif = gif;
    }

    function sendGif() {
        if (!selectedGif) return;
        dispatch('select', {
            ...selectedGif,
            message: messageWithGif.trim() || null
        });
        selectedGif = null;
        messageWithGif = '';
    }

    function cancelSelection() {
        selectedGif = null;
        messageWithGif = '';
    }

    function close() {
        selectedGif = null;
        messageWithGif = '';
        dispatch('close');
    }
</script>

{#if show}
    <div class="giphy-picker">
        <div class="giphy-header">
            <input
                type="text"
                class="giphy-search"
                placeholder="Search GIFs..."
                bind:value={searchQuery}
                on:input={handleSearch}
            />
            <button class="close-btn" on:click={close}>✕</button>
        </div>

        {#if selectedGif}
            <!-- Preview selected GIF with message option -->
            <div class="gif-preview">
                <div class="preview-image">
                    <img src={selectedGif.smallUrl || selectedGif.url} alt={selectedGif.title} />
                </div>
                <div class="preview-message">
                    <input
                        type="text"
                        placeholder="Add a message (optional)..."
                        bind:value={messageWithGif}
                        on:keydown={(e) => e.key === 'Enter' && sendGif()}
                    />
                </div>
                <div class="preview-actions">
                    <button class="btn-cancel" on:click={cancelSelection}>
                        ← Back
                    </button>
                    <button class="btn-send" on:click={sendGif}>
                        Send GIF ➤
                    </button>
                </div>
            </div>
        {:else}
            <div class="giphy-grid">
                {#if loading}
                    <div class="loading">
                        <div class="loading-spinner"></div>
                        <p>Loading GIFs...</p>
                    </div>
                {:else if gifs.length === 0}
                    <div class="no-results">
                        <p>No GIFs found</p>
                    </div>
                {:else}
                    {#each gifs as gif (gif.id)}
                        <button
                            class="gif-item"
                            on:click={() => selectGif(gif)}
                            title="Click to select"
                        >
                            <img
                                src={gif.smallUrl || gif.url}
                                alt={gif.title}
                                loading="lazy"
                            />
                        </button>
                    {/each}
                {/if}
            </div>
        {/if}

        <div class="giphy-footer">
            <span class="powered-by">Powered by GIPHY</span>
        </div>
    </div>
{/if}

<style>
    .giphy-picker {
        background: white;
        border-top: 1px solid var(--cream-dark);
        animation: slideUp 0.2s ease;
    }

    @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .giphy-header {
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--cream-dark);
    }

    .giphy-search {
        flex: 1;
        padding: 8px 14px;
        border: 1px solid var(--cream-dark);
        border-radius: 20px;
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s;
    }

    .giphy-search:focus {
        border-color: var(--primary);
    }

    .close-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .close-btn:hover {
        background: var(--cream-dark);
    }

    .giphy-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        padding: 6px;
        max-height: 320px;
        overflow-y: auto;
    }

    .gif-item {
        aspect-ratio: auto;
        min-height: 110px;
        border: none;
        background: #fff;
        border-radius: 6px;
        overflow: hidden;
        cursor: pointer;
        padding: 0;
        border: 1px solid var(--cream-dark);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .gif-item:hover {
        border-color: var(--primary);
        box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.15);
    }

    .gif-item img {
        width: 100%;
        height: 120px;
        object-fit: contain;
        background: #f7f7f7;
    }

    /* Preview Styles */
    .gif-preview {
        padding: 12px;
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .preview-image {
        display: flex;
        justify-content: center;
        margin-bottom: 12px;
    }

    .preview-image img {
        width: 100%;
        max-width: 280px;
        max-height: 220px;
        border-radius: 8px;
        object-fit: contain;
        background: #f7f7f7;
    }

    .preview-message {
        margin-bottom: 12px;
    }

    .preview-message input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid var(--cream-dark);
        border-radius: 20px;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
    }

    .preview-message input:focus {
        border-color: var(--primary);
    }

    .preview-actions {
        display: flex;
        gap: 10px;
    }

    .btn-cancel, .btn-send {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .btn-cancel {
        background: var(--cream);
        color: var(--text);
    }

    .btn-cancel:hover {
        background: var(--cream-dark);
    }

    .btn-send {
        background: var(--primary);
        color: white;
    }

    .btn-send:hover {
        background: var(--primary-dark);
    }

    .loading, .no-results {
        grid-column: 1 / -1;
        text-align: center;
        padding: 20px;
        color: var(--text-muted);
    }

    .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid var(--cream-dark);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 8px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .giphy-footer {
        padding: 6px 12px;
        border-top: 1px solid var(--cream-dark);
        text-align: center;
    }

    .powered-by {
        font-size: 9px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    @media (max-width: 520px) {
        .giphy-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }
</style>
