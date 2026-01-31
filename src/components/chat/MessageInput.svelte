<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import 'emoji-picker-element';

    export let placeholder = 'Type a message...';
    export let disabled = false;
    export let maxLength = 1000;

    const dispatch = createEventDispatcher();

    let message = '';
    let textareaEl;
    let showEmojiPicker = false;
    let typingTimeout = null;
    let recentEmojis = [];
    let emojiPickerEl;

    function handleInput() {
        // Auto-resize textarea
        if (textareaEl) {
            textareaEl.style.height = 'auto';
            textareaEl.style.height = Math.min(textareaEl.scrollHeight, 120) + 'px';
        }

        // Typing indicator
        dispatch('typing', true);

        // Clear previous timeout
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        // Stop typing after 2 seconds of no input
        typingTimeout = setTimeout(() => {
            dispatch('typing', false);
        }, 2000);
    }

    function handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function sendMessage() {
        const trimmed = message.trim();
        if (!trimmed || disabled) return;

        dispatch('send', { message: trimmed, isGif: false });
        message = '';
        showEmojiPicker = false;

        // Reset textarea height
        if (textareaEl) {
            textareaEl.style.height = 'auto';
        }

        // Clear typing indicator
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        dispatch('typing', false);
    }

    onMount(() => {
        // Load recent emojis from localStorage
        const stored = localStorage.getItem('recentEmojis');
        if (stored) {
            try {
                recentEmojis = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse recent emojis:', e);
                recentEmojis = [];
            }
        }
    });

    function insertEmoji(emoji) {
        message += emoji;
        textareaEl?.focus();

        // Track recent emoji
        trackRecentEmoji(emoji);
    }

    function trackRecentEmoji(emoji) {
        // Remove if already exists and add to front
        recentEmojis = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 20);

        // Save to localStorage
        try {
            localStorage.setItem('recentEmojis', JSON.stringify(recentEmojis));
        } catch (e) {
            console.error('Failed to save recent emojis:', e);
        }
    }

    function handleEmojiSelect(event) {
        const emoji = event.detail.unicode;
        insertEmoji(emoji);
    }

    function toggleEmojiPicker() {
        showEmojiPicker = !showEmojiPicker;
    }

    function openGifPicker() {
        dispatch('openGif');
    }
</script>

<div class="message-input-container">
    {#if showEmojiPicker}
        <div class="emoji-picker-container">
            <div class="emoji-picker-header">
                <h4>Choose Emoji</h4>
                <button class="close-picker-btn" on:click={toggleEmojiPicker} type="button">✕</button>
            </div>

            {#if recentEmojis.length > 0}
                <div class="recent-emojis">
                    <span class="recent-label">Recent:</span>
                    <div class="recent-emoji-grid">
                        {#each recentEmojis.slice(0, 8) as emoji}
                            <button
                                class="recent-emoji-btn"
                                on:click={() => insertEmoji(emoji)}
                                type="button"
                            >
                                {emoji}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <emoji-picker
                class="light"
                bind:this={emojiPickerEl}
                on:emoji-click={handleEmojiSelect}
            ></emoji-picker>
        </div>
    {/if}

    <div class="input-row">
        <div class="input-actions-left">
            <button
                class="action-btn"
                class:active={showEmojiPicker}
                on:click={toggleEmojiPicker}
                title="Emoji"
            >
                😊
            </button>
            <button
                class="action-btn"
                on:click={openGifPicker}
                title="GIF"
            >
                GIF
            </button>
        </div>

        <div class="input-wrapper">
            <textarea
                bind:this={textareaEl}
                bind:value={message}
                on:input={handleInput}
                on:keydown={handleKeydown}
                {placeholder}
                {disabled}
                maxlength={maxLength}
                rows="1"
            ></textarea>
        </div>

        <button
            class="send-btn"
            on:click={sendMessage}
            disabled={!message.trim() || disabled}
            title="Send"
        >
            <span class="send-icon">➤</span>
        </button>
    </div>

    {#if message.length > maxLength - 100}
        <div class="char-count" class:warning={message.length > maxLength - 50}>
            {message.length}/{maxLength}
        </div>
    {/if}
</div>

<style>
    .message-input-container {
        border-top: 1px solid var(--cream-dark, #E0E0E0);
        background: white;
        padding-bottom: env(safe-area-inset-bottom, 0); /* Handle iPhone notch */
    }

    .emoji-picker-container {
        padding: 12px;
        border-bottom: 1px solid var(--cream-dark);
        animation: slideUp 0.2s ease;
        background: white;
        position: relative;
        z-index: 10;
        max-height: 400px;
        overflow-y: auto;
    }

    @keyframes slideUp {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .emoji-picker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .emoji-picker-header h4 {
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        margin: 0;
    }

    .close-picker-btn {
        width: 28px;
        height: 28px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 14px;
        color: var(--text-muted);
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .close-picker-btn:hover {
        background: var(--cream-dark);
        color: var(--text);
    }

    .recent-emojis {
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--cream-dark);
    }

    .recent-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: block;
        margin-bottom: 8px;
    }

    .recent-emoji-grid {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }

    .recent-emoji-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: var(--cream);
        border-radius: 10px;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }

    .recent-emoji-btn:hover {
        background: var(--cream-dark);
        transform: scale(1.1);
    }

    .recent-emoji-btn:active {
        transform: scale(0.95);
    }

    /* Style the emoji-picker-element */
    emoji-picker {
        width: 100%;
        --border-radius: 12px;
        --category-emoji-size: 1.25rem;
        --emoji-size: 1.5rem;
        --indicator-color: var(--primary, #2D5A47);
        --input-border-color: var(--cream-dark, #E0E0E0);
        --input-border-radius: 16px;
        --input-font-size: 14px;
        --input-padding: 8px 12px;
        --outline-color: var(--primary-light, #4CAF50);
    }

    .input-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 12px;
    }

    .input-actions-left {
        display: flex;
        gap: 4px;
    }

    .action-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .action-btn:hover {
        background: var(--cream-dark);
    }

    .action-btn.active {
        background: var(--primary);
        color: white;
    }

    .input-wrapper {
        flex: 1;
        min-width: 0; /* Allow flex item to shrink */
        background: var(--cream, #F5F5DC);
        border-radius: 20px;
        padding: 8px 16px;
    }

    /* Override global textarea styles from app.css */
    .input-wrapper textarea {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        padding: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        background: transparent !important;
        font-family: inherit !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        resize: none !important;
        outline: none !important;
        box-shadow: none !important;
        max-height: 120px !important;
        box-sizing: border-box !important;
        overflow-wrap: break-word !important;
        word-wrap: break-word !important;
        white-space: pre-wrap !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        direction: ltr !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
    }

    .input-wrapper textarea::placeholder {
        color: var(--text-muted, #888);
    }

    .input-wrapper textarea:focus {
        outline: none !important;
        border: none !important;
        box-shadow: none !important;
    }

    .send-btn {
        width: 40px;
        height: 40px;
        border: none;
        background: var(--primary);
        border-radius: 50%;
        color: white;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .send-btn:hover:not(:disabled) {
        background: var(--primary-dark);
        transform: scale(1.05);
    }

    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .send-icon {
        display: inline-block;
        transform: rotate(0deg);
    }

    .char-count {
        font-size: 11px;
        color: var(--text-muted);
        text-align: right;
        padding: 0 16px 8px;
    }

    .char-count.warning {
        color: #F44336;
    }
</style>
