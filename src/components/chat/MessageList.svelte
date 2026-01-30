<script>
    import { onMount, afterUpdate } from 'svelte';
    import Message from './Message.svelte';
    import TypingIndicator from './TypingIndicator.svelte';

    export let messages = [];
    export let typingUser = null;
    export let autoScroll = true;

    let containerEl;
    let isUserScrolling = false;

    onMount(() => {
        scrollToBottom();
    });

    afterUpdate(() => {
        if (autoScroll && !isUserScrolling) {
            scrollToBottom();
        }
    });

    function scrollToBottom() {
        if (containerEl) {
            containerEl.scrollTop = containerEl.scrollHeight;
        }
    }

    function handleScroll() {
        if (!containerEl) return;
        const { scrollTop, scrollHeight, clientHeight } = containerEl;
        // User is scrolling if not at bottom
        isUserScrolling = scrollHeight - scrollTop - clientHeight > 100;
    }

    // Group consecutive messages from same user
    function shouldShowAvatar(index) {
        if (index === 0) return true;
        const current = messages[index];
        const prev = messages[index - 1];
        return current.user_id !== prev.user_id;
    }

    function isCompact(index) {
        if (index === messages.length - 1) return false;
        const current = messages[index];
        const next = messages[index + 1];
        return current.user_id === next.user_id;
    }
</script>

<div
    class="message-list"
    bind:this={containerEl}
    on:scroll={handleScroll}
>
    {#if messages.length === 0}
        <div class="empty-chat">
            <div class="empty-icon">💬</div>
            <p>No messages yet</p>
            <p class="empty-hint">Start the conversation!</p>
        </div>
    {:else}
        {#each messages as message, i (message.id)}
            <Message
                {message}
                showAvatar={shouldShowAvatar(i)}
                compact={isCompact(i)}
            />
        {/each}
    {/if}

    {#if typingUser}
        <TypingIndicator user={typingUser} />
    {/if}
</div>

<style>
    .message-list {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
    }

    .empty-chat {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        color: var(--text-muted);
        padding: 40px 20px;
    }

    .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    .empty-chat p {
        font-size: 14px;
        margin: 0;
    }

    .empty-hint {
        font-size: 13px;
        opacity: 0.7;
        margin-top: 4px;
    }
</style>
