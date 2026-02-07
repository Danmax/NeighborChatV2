<script>
    import { createEventDispatcher } from 'svelte';
    import Avatar from '../avatar/Avatar.svelte';
    import { push } from 'svelte-spa-router';
    import { currentUser } from '../../stores/auth.js';
    import { highlightMentions } from '../../lib/utils/mentions.js';
    import { REACTIONS } from '../../lib/utils/reactions.js';

    export let message;
    export let showAvatar = true;
    export let compact = false;
    export let enableReactions = false;

    const dispatch = createEventDispatcher();

    // State variables
    let isOwn = false;

    // Helper to check if a value is a valid UUID
    function isValidUuid(val) {
        if (!val) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    }

    // Get current user ID - validate that it's a UUID, not a Clerk text ID
    $: currentId =
        ($currentUser?.user_uuid && isValidUuid($currentUser.user_uuid)) ? $currentUser.user_uuid :
        ($currentUser?.user_id && isValidUuid($currentUser.user_id)) ? $currentUser.user_id :
        ($currentUser?.id && isValidUuid($currentUser.id)) ? $currentUser.id :
        null;
    // Use passed _isOwn value if available (from parent component), otherwise calculate from currentId
    $: {
        const shouldUsePassedIsOwn = message._isOwn !== undefined;
        isOwn = shouldUsePassedIsOwn ? message._isOwn : (currentId && message.user_id === currentId);
        if (import.meta.env.DEV) {
            console.log('[Message] Message ownership check:', {
                message_id: message.id,
                message_user_id: message.user_id,
                currentId,
                _isOwn: message._isOwn,
                shouldUsePassedIsOwn,
                calculated_isOwn: currentId && message.user_id === currentId,
                final_isOwn: isOwn
            });
        }
    }
    $: formattedTime = formatTime(message.timestamp);
    $: showRead = isOwn && message.read;
    $: formattedMessage = highlightMentions(escapeHtml(message.message));
    $: gifUrl = message.gif_url || (message.isGif ? message.message : null);
    $: caption = message.caption || (message.gif_url ? message.message : '');
    $: reactionCounts = getReactionCounts(message.reactions);
    $: totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);

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

    function getReactionCounts(reactions = {}) {
        const counts = {};
        Object.entries(reactions).forEach(([emoji, users]) => {
            counts[emoji] = users.length;
        });
        return counts;
    }

    function hasUserReacted(emoji) {
        if (!$currentUser) return false;
        // Use the same UUID validation as above
        const validId =
            ($currentUser?.user_uuid && isValidUuid($currentUser.user_uuid)) ? $currentUser.user_uuid :
            ($currentUser?.user_id && isValidUuid($currentUser.user_id)) ? $currentUser.user_id :
            ($currentUser?.id && isValidUuid($currentUser.id)) ? $currentUser.id :
            null;
        if (!validId) return false;
        return message.reactions?.[emoji]?.includes(validId);
    }

    function handleReaction(emoji) {
        dispatch('reaction', { message, emoji });
    }

    let showReactions = false;

    function toggleReactions(event) {
        event.stopPropagation();
        showReactions = !showReactions;
    }

    function pickReaction(emoji, event) {
        event.stopPropagation();
        showReactions = false;
        handleReaction(emoji);
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

        {#if enableReactions}
            <div class="message-reactions">
                {#if totalReactions > 0}
                    <div class="reactions-summary">
                        {#each Object.entries(reactionCounts) as [emoji, count]}
                            <button
                                class="reaction-badge"
                                class:active={hasUserReacted(emoji)}
                                type="button"
                                on:click={() => handleReaction(emoji)}
                            >
                                {emoji} {count}
                            </button>
                        {/each}
                    </div>
                {/if}
                <div class="reaction-picker">
                    <button class="reaction-toggle" type="button" on:click={toggleReactions}>
                        😊 React
                    </button>
                    {#if showReactions}
                        <div class="reaction-menu">
                            {#each REACTIONS as emoji}
                                <button
                                    class="reaction-btn"
                                    class:active={hasUserReacted(emoji)}
                                    on:click={(event) => pickReaction(emoji, event)}
                                    title={emoji}
                                    type="button"
                                >
                                    {emoji}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
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

    .message-reactions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 6px;
        align-items: center;
    }

    .reactions-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .reaction-badge {
        background: var(--cream);
        border: 1px solid var(--cream-dark);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }

    .reaction-badge.active {
        background: rgba(76, 175, 80, 0.15);
        border-color: rgba(76, 175, 80, 0.4);
        color: var(--primary);
    }

    .reaction-picker {
        position: relative;
    }

    .reaction-toggle {
        background: none;
        border: 1px dashed var(--cream-dark);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        color: var(--text-muted);
    }

    .reaction-menu {
        position: absolute;
        bottom: 120%;
        left: 0;
        background: white;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        padding: 8px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        z-index: 5;
    }

    .reaction-btn {
        border: none;
        background: var(--cream);
        border-radius: 8px;
        padding: 6px;
        cursor: pointer;
        font-size: 16px;
    }

    .reaction-btn.active {
        background: rgba(76, 175, 80, 0.2);
    }
</style>
