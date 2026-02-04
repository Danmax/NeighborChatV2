<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { threadMessages, messagesLoading } from '../../stores/messages.js';
    import {
        fetchThread,
        sendMessageToUser,
        markThreadRead,
        fetchProfileForUser,
        subscribeToThread,
        reactToMessage,
        refreshMessageReactions,
        subscribeToMessageReactions
    } from '../../services/messages.service.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import MessageList from '../../components/chat/MessageList.svelte';
    import MessageInput from '../../components/chat/MessageInput.svelte';
    import GiphyPicker from '../../components/chat/GiphyPicker.svelte';

    export let params = {};

    let recipientProfile = null;
    let loadingProfile = true;
    let subscription = null;
    let showGifPicker = false;
    let reactionsSubscription = null;

    $: otherUserId = params.id;

    $: mappedMessages = ($threadMessages || []).map(msg => {
        const isOwn = msg.sender_id === $currentUser?.user_id;
        return {
            id: msg.id,
            user_id: msg.sender_id,
            name: isOwn ? $currentUser?.name : recipientProfile?.name || 'Neighbor',
            avatar: isOwn ? $currentUser?.avatar : recipientProfile?.avatar,
            message: msg.body,
            isGif: msg.message_type === 'gif',
            gif_url: msg.metadata?.gif_url,
            caption: msg.body,
            timestamp: msg.created_at,
            read: msg.read,
            reactions: msg.reactions || {}
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

        reactionsSubscription = await subscribeToMessageReactions(async (payload) => {
            const messageId = payload?.new?.message_id || payload?.old?.message_id;
            if (!messageId) return;
            const exists = ($threadMessages || []).some(m => m.id === messageId);
            if (exists) {
                await refreshMessageReactions(messageId);
            }
        });
    });

    onDestroy(() => {
        if (subscription) {
            subscription.unsubscribe();
        }
        if (reactionsSubscription) {
            reactionsSubscription.unsubscribe();
        }
    });

    async function handleSendMessage(event) {
        const { message, isGif } = event.detail;
        if (!message.trim()) return;
        await sendMessageToUser(otherUserId, message, isGif);
    }

    async function handleGifSelect(event) {
        const gif = event.detail;
        const caption = gif.message ? gif.message.trim() : '';
        await sendMessageToUser(otherUserId, caption, true, gif.url);
        showGifPicker = false;
    }

    async function handleMessageReaction(event) {
        const { message, emoji } = event.detail;
        try {
            await reactToMessage(message.id, emoji);
        } catch (error) {
            console.error('Failed to react to message:', error);
        }
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
            <MessageList
                messages={mappedMessages}
                enableReactions={true}
                onReaction={handleMessageReaction}
            />
        </div>

        <GiphyPicker
            show={showGifPicker}
            on:select={handleGifSelect}
            on:close={() => showGifPicker = false}
        />

        <MessageInput
            placeholder={`Message ${recipientProfile?.name || 'neighbor'}...`}
            on:send={handleSendMessage}
            on:openGif={() => showGifPicker = !showGifPicker}
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
