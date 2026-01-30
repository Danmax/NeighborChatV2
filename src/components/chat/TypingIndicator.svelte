<script>
    import Avatar from '../avatar/Avatar.svelte';

    export let user = null;
</script>

{#if user}
    <div class="typing-indicator">
        <div class="typing-avatar">
            <Avatar avatar={user.avatar} size="sm" />
        </div>
        <div class="typing-bubble">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>
        <span class="typing-text">{user.name} is typing...</span>
    </div>
{/if}

<style>
    .typing-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .typing-avatar {
        flex-shrink: 0;
    }

    .typing-bubble {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        background: var(--cream);
        border-radius: 18px;
        border-bottom-left-radius: 4px;
    }

    .typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--text-muted);
        animation: typingBounce 1.4s ease-in-out infinite;
    }

    .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
    }

    .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
    }

    @keyframes typingBounce {
        0%, 60%, 100% {
            transform: translateY(0);
        }
        30% {
            transform: translateY(-4px);
        }
    }

    .typing-text {
        font-size: 12px;
        color: var(--text-muted);
        font-style: italic;
    }
</style>
