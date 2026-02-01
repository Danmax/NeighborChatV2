<script>
    import Avatar from '../avatar/Avatar.svelte';
    import { push } from 'svelte-spa-router';
    import { currentUser } from '../../stores/auth.js';
    import { highlightMentions } from '../../lib/utils/mentions.js';

    export let message;
    export let showAvatar = true;
    export let compact = false;

    $: isOwn = message.user_id === $currentUser?.user_id;
    $: formattedTime = formatTime(message.timestamp);
    $: showRead = isOwn && message.read;
    $: formattedMessage = highlightMentions(escapeHtml(message.message));
    $: gifUrl = message.gif_url || (message.isGif ? message.message : null);
    $: caption = message.caption || (message.gif_url ? message.message : '');

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Escape HTML to prevent XSS, but allow our mention highlights
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
</script>

<div class="message" class:own={isOwn} class:compact>
    {#if showAvatar && !isOwn}
        <button
            class="message-avatar"
            type="button"
            on:click={() => message.user_id && push(`/profile/view/${message.user_id}`)}
            aria-label="View profile"
        >
            <Avatar avatar={message.avatar} size="sm" />
        </button>
    {/if}

    <div class="message-content">
        {#if !isOwn && !compact}
            <button
                class="message-sender"
                type="button"
                on:click={() => message.user_id && push(`/profile/view/${message.user_id}`)}
            >
                {message.name}
            </button>
        {/if}

        <div class="message-bubble">
            {#if message.isGif}
                <img
                    src={gifUrl}
                    alt="GIF"
                    class="message-gif"
                    loading="lazy"
                />
                {#if caption}
                    <div class="message-text">{@html highlightMentions(escapeHtml(caption))}</div>
                {/if}
            {:else}
                <div class="message-text">{@html formattedMessage}</div>
            {/if}
            <div class="message-time">
                {formattedTime}
                {#if showRead}
                    <span class="message-read">Read</span>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .message {
        display: flex;
        gap: 10px;
        margin-bottom: 16px;
        align-items: flex-end;
    }

    .message.compact {
        margin-bottom: 8px;
    }

    .message.own {
        flex-direction: row-reverse;
    }

    .message-avatar {
        flex-shrink: 0;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
    }

    .message-content {
        max-width: 80%;
        display: flex;
        flex-direction: column;
    }

    .message.own .message-content {
        align-items: flex-end;
    }

    .message-sender {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
        margin-bottom: 4px;
        margin-left: 4px;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-align: left;
    }

    .message-bubble {
        padding: 10px 14px;
        border-radius: 18px;
        background: var(--cream);
        color: var(--text);
        word-wrap: break-word;
        overflow-wrap: break-word;
        min-width: 200px;
        max-width: 500px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .message.own .message-bubble {
        background: var(--primary);
        color: white;
        border-bottom-right-radius: 4px;
    }

    .message:not(.own) .message-bubble {
        border-bottom-left-radius: 4px;
    }

    .message-text {
        font-size: 16px;
        line-height: 1.4;
        white-space: pre-wrap;
    }

    .message-gif {
        max-width: 420px;
        border-radius: 12px;
        display: block;
    }

    .message-time {
        font-size: 12px;
        opacity: 1;
        text-align: right;
        margin-top: 2px;
    }

    .message-read {
        margin-left: 8px;
        font-size: 11px;
        opacity: 0.8;
    }

    .message.own .message-time {
        text-align: right;
    }

    .message:not(.own) .message-time {
        text-align: right;
    }

    /* Mention highlighting */
    :global(.message-text .mention) {
        background: rgba(45, 90, 71, 0.15);
        color: var(--primary-dark, #1e4d35);
        padding: 1px 4px;
        border-radius: 4px;
        font-weight: 600;
    }

    .message.own :global(.message-text .mention) {
        background: rgba(255, 255, 255, 0.25);
        color: white;
    }
</style>
