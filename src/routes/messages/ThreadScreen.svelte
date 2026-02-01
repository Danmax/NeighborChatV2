<script>
    import { authInitialized } from '../../stores/ui.js';
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { threadMessages, messagesLoading } from '../../stores/messages.js';
    import {
        fetchThread,
        sendMessageToUser,
        markThreadRead,
        fetchProfileForUser,
        subscribeToThread
    } from '../../services/messages.service.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import MessageList from '../../components/chat/MessageList.svelte';
    import MessageInput from '../../components/chat/MessageInput.svelte';

    export let params = {};

    let recipientProfile = null;
    let loadingProfile = true;
    let subscription = null;

    $: otherUserId = params.id;

    // Redirect if not authenticated
    $: if ($authInitialized && !$isAuthenticated) {
        console.log('🔐 ThreadScreen: Not authenticated, redirecting to /auth');
        push('/auth');
    }

    $: mappedMessages = ($threadMessages || []).map(msg => {
        const isOwn = msg.sender_id === $currentUser?.user_id;
        return {
            id: msg.id,
            user_id: msg.sender_id,
            name: isOwn ? $currentUser?.name : recipientProfile?.name || 'Neighbor',
            avatar: isOwn ? $currentUser?.avatar : recipientProfile?.avatar,
            message: msg.body,
            isGif: false,
            timestamp: msg.created_at,
            read: msg.read
        };
    });

    onMount(async () => {
        if (!$isAuthenticated || !otherUserId) return;
        try {
            loadingProfile = true;
            recipientProfile = await fetchProfileForUser(otherUserId);
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            loadingProfile = false;
        }

        await fetchThread(otherUserId);
        await markThreadRead(otherUserId);

        subscription = await subscribeToThread(otherUserId, () => {
            markThreadRead(otherUserId);
        });
    });

    onDestroy(() => {
        if (subscription) {
            subscription.unsubscribe();
        }
    });

    async function handleSendMessage(event) {
        const { message } = event.detail;
        if (!message.trim()) return;
        await sendMessageToUser(otherUserId, message);
    }
</script>

{#if $isAuthenticated}
    <div class="thread-screen">
        <div class="chat-header">
            <button class="back-btn" on:click={() => push('/messages')}>←</button>

            <div class="partner-info">
                {#if recipientProfile}
                    <Avatar avatar={recipientProfile.avatar} size="sm" />
                {/if}
                <div class="partner-details">
                    <span class="partner-name">
                        {loadingProfile ? 'Loading...' : recipientProfile?.name || 'Neighbor'}
                    </span>
                    <span class="partner-status">Direct message</span>
                </div>
            </div>
        </div>

        <div class="message-area">
            <MessageList messages={mappedMessages} />
        </div>

        <MessageInput
            placeholder={`Message ${recipientProfile?.name || 'neighbor'}...`}
            on:send={handleSendMessage}
        />
    </div>
{/if}

<style>
    .thread-screen {
        display: flex;
        flex-direction: column;
        background: white;
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        bottom: 10px;
        z-index: 500;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        overflow: hidden;
    }

    .chat-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: white;
        border-bottom: 1px solid var(--cream-dark, #E0E0E0);
        flex-shrink: 0;
    }

    .back-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: var(--cream, #F5F5DC);
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text, #333);
        transition: all 0.2s ease;
    }

    .back-btn:hover {
        background: var(--primary, #4CAF50);
        color: white;
    }

    .partner-info {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }

    .partner-details {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .partner-name {
        font-weight: 600;
        color: var(--text, #333);
        font-size: 15px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .partner-status {
        font-size: 12px;
        color: var(--text-muted, #666);
    }

    .message-area {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    :global(.thread-screen .message-area > *) {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }
    :global(.thread-screen > .message-input-container) {
        flex-shrink: 0;
    }
</style>
