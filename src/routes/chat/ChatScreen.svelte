<script>
    import { authInitialized } from '../../stores/ui.js';
    import { onMount, onDestroy } from 'svelte';
    import { push, querystring } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import {
        chatPartner,
        chatMessages,
        addMessage,
        startChat,
        endChat,
        setTypingStatus,
        isPartnerTyping
    } from '../../stores/chat.js';
    import { onlineUsers, availableUsers } from '../../stores/presence.js';
    import {
        setupChatChannel,
        sendChatMessage,
        sendTypingIndicator,
        leaveChat
    } from '../../services/realtime.service.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import MessageList from '../../components/chat/MessageList.svelte';
    import MessageInput from '../../components/chat/MessageInput.svelte';
    import GiphyPicker from '../../components/chat/GiphyPicker.svelte';

    export let params = {};

    let showGifPicker = false;
    let partnerLeft = false;
    let localPartner = null; // Fallback partner info

    // Redirect if not authenticated
    $: if ($authInitialized && !$isAuthenticated) {
        console.log('🔐 ChatScreen: Not authenticated, redirecting to /auth');
        push('/auth');
    }

    // Get partner from URL params
    $: partnerId = params.id;
    $: partner = $chatPartner || findPartner(partnerId) || localPartner;

    function findPartner(id) {
        if (!id) return null;
        // Check onlineUsers map first
        if ($onlineUsers[id]) return $onlineUsers[id];
        // Then check availableUsers list
        const found = $availableUsers.find(u => u.user_id === id);
        return found || null;
    }

    onMount(() => {
        if (partnerId && $isAuthenticated) {
            initializeChat();
        }
    });

    onDestroy(() => {
        handleLeave();
    });

    function initializeChat() {
        let foundPartner = findPartner(partnerId);

        // If partner not found in presence, create temporary partner info
        // This handles the case where invitor navigates before presence syncs
        if (!foundPartner && partnerId) {
            foundPartner = {
                user_id: partnerId,
                name: 'Connecting...',
                avatar: { emoji1: '💬', background: '#E8F5E9' },
                status: 'available'
            };
            localPartner = foundPartner;
        }

        if (!foundPartner) {
            console.warn('Chat partner not found');
            return;
        }

        const roomId = startChat(foundPartner);
        if (roomId) {
            setupChatChannel(roomId, {
                onMessage: handleMessage,
                onTyping: handleTyping,
                onLeave: handlePartnerLeave,
                onJoin: handlePartnerJoin
            });
        }
    }

    function handlePartnerJoin(payload) {
        // Update partner info when they join
        if (payload.user_id === partnerId && localPartner) {
            localPartner = {
                ...localPartner,
                name: payload.name || localPartner.name,
                avatar: payload.avatar || localPartner.avatar
            };
        }
    }

    function handleMessage(payload) {
        // Don't add own messages (they're added locally)
        if (payload.user_id === $currentUser?.user_id) return;
        addMessage(payload);
    }

    function handleTyping(payload) {
        if (payload.user_id !== $currentUser?.user_id) {
            setTypingStatus(payload.user_id, payload.isTyping);
        }
    }

    function handlePartnerLeave(payload) {
        if (payload.user_id === partnerId) {
            partnerLeft = true;
        }
    }

    async function handleSendMessage(event) {
        const { message, isGif } = event.detail;

        const msg = await sendChatMessage(message, isGif);
        if (msg) {
            addMessage(msg);
        }
    }

    function handleTypingChange(event) {
        sendTypingIndicator(event.detail);
    }

    async function handleGifSelect(event) {
        const gif = event.detail;
        // If there's a message with the GIF, send it first
        if (gif.message) {
            await handleSendMessage({ detail: { message: gif.message, isGif: false } });
        }
        // Then send the GIF
        await handleSendMessage({ detail: { message: gif.url, isGif: true } });
        showGifPicker = false;
    }

    function handleLeave() {
        leaveChat();
        endChat();
    }

    function goBack() {
        handleLeave();
        push('/find-match');
    }
</script>

{#if $isAuthenticated}
    <div class="chat-screen">
        <!-- Chat Header -->
        <div class="chat-header">
            <button class="back-btn" on:click={goBack}>←</button>

            {#if partner}
                <div class="partner-info">
                    <Avatar avatar={partner.avatar} size="sm" />
                    <div class="partner-details">
                        <span class="partner-name">{partner.name}</span>
                        <span class="partner-status">
                            {#if partnerLeft}
                                Left the chat
                            {:else if $isPartnerTyping}
                                typing...
                            {:else}
                                Online
                            {/if}
                        </span>
                    </div>
                </div>
            {:else}
                <div class="partner-info">
                    <div class="partner-details">
                        <span class="partner-name">Loading...</span>
                    </div>
                </div>
            {/if}

            <button class="menu-btn" title="Options">⋮</button>
        </div>

        {#if partnerLeft}
            <div class="partner-left-notice">
                <p>😢 {partner?.name || 'Your partner'} has left the chat</p>
                <button class="btn btn-primary" on:click={goBack}>
                    Find New Partner
                </button>
            </div>
        {/if}

        <!-- Messages -->
        <MessageList
            messages={$chatMessages}
            typingUser={$isPartnerTyping ? partner : null}
        />

        <!-- GIF Picker -->
        <GiphyPicker
            show={showGifPicker}
            on:select={handleGifSelect}
            on:close={() => showGifPicker = false}
        />

        <!-- Input -->
        <MessageInput
            placeholder="Message {partner?.name || 'partner'}..."
            disabled={partnerLeft}
            on:send={handleSendMessage}
            on:typing={handleTypingChange}
            on:openGif={() => showGifPicker = !showGifPicker}
        />
    </div>
{/if}

<style>
    .chat-screen {
        display: flex;
        flex-direction: column;
        background: white;
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        bottom: 10px;
        z-index: 500; /* Higher than footer (z-index: 100) */
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
        min-width: 0; /* Allow text truncation */
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

    .menu-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: none;
        font-size: 20px;
        cursor: pointer;
        color: var(--text-muted, #666);
        border-radius: 50%;
        transition: all 0.2s ease;
    }

    .menu-btn:hover {
        background: var(--cream, #F5F5DC);
        color: var(--text, #333);
    }

    .partner-left-notice {
        background: #FFF3E0;
        padding: 20px;
        text-align: center;
        border-bottom: 1px solid var(--cream-dark, #E0E0E0);
        flex-shrink: 0;
    }

    .partner-left-notice p {
        color: #E65100;
        font-size: 14px;
        margin-bottom: 12px;
    }

    .partner-left-notice .btn {
        margin: 0 auto;
    }

    /* Ensure messages area takes remaining space */
    :global(.chat-screen > .message-list) {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    /* Ensure input stays at bottom */
    :global(.chat-screen > .message-input-container) {
        flex-shrink: 0;
    }
</style>
