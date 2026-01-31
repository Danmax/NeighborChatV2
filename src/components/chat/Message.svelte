<script>
    import Avatar from '../avatar/Avatar.svelte';
    import { currentUser } from '../../stores/auth.js';
    import { highlightMentions } from '../../lib/utils/mentions.js';

    export let message;
    export let showAvatar = true;
    export let compact = false;

    $: isOwn = message.user_id === $currentUser?.user_id;
    $: formattedTime = formatTime(message.timestamp);
    $: formattedMessage = highlightMentions(escapeHtml(message.message));

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
        <div class="message-avatar">
            <Avatar avatar={message.avatar} size="sm" />
        </div>
    {/if}

    <div class="message-content">
        {#if !isOwn && !compact}
            <div class="message-sender">{message.name}</div>
        {/if}

        <div class="message-bubble">
            {#if message.isGif}
                <img
                    src={message.message}
                    alt="GIF"
                    class="message-gif"
                    loading="lazy"
                />
            {:else}
                <div class="message-text">{@html formattedMessage}</div>
            {/if}
            <div class="message-time">{formattedTime}</div>
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
