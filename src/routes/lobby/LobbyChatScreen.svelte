<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { lobbyMessages, addLobbyMessage } from '../../stores/chat.js';
    import { onlineCount } from '../../stores/presence.js';
    import { setupLobbyChannel, sendLobbyMessage, cleanupLobbyChannel } from '../../services/realtime.service.js';
    import MessageList from '../../components/chat/MessageList.svelte';
    import MessageInput from '../../components/chat/MessageInput.svelte';

    // Available channels
    const CHANNELS = [
        { id: 'general', label: 'General', icon: '💬', description: 'General neighborhood chat' },
        { id: 'new-here', label: 'New Here', icon: '👋', description: 'Welcome new neighbors!' },
        { id: 'tech', label: 'Tech', icon: '💻', description: 'Tech talk and help' },
        { id: 'pets', label: 'Pets', icon: '🐾', description: 'Share your furry friends' },
        { id: 'community', label: 'Community', icon: '🏘️', description: 'Local news and events' },
    ];

    const STORAGE_KEY = 'neighbor_chat_lobby_messages';
    const MAX_MESSAGES_PER_CHANNEL = 50;

    // Redirect if not authenticated
    $: if (!$isAuthenticated) {
        push('/auth');
    }

    let currentChannel = CHANNELS[0];
    let lobbyChannel = null;
    let channelMessages = {};
    let showChannelPicker = false;

    // Load messages from localStorage
    function loadMessagesFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Validate and filter old messages (keep last 24 hours)
                const cutoff = Date.now() - (24 * 60 * 60 * 1000);
                CHANNELS.forEach(ch => {
                    if (parsed[ch.id]) {
                        channelMessages[ch.id] = parsed[ch.id].filter(m => m.timestamp > cutoff);
                    } else {
                        channelMessages[ch.id] = [];
                    }
                });
                return;
            }
        } catch (e) {
            console.warn('Failed to load messages from storage:', e);
        }
        // Initialize empty
        CHANNELS.forEach(ch => {
            channelMessages[ch.id] = [];
        });
    }

    // Save messages to localStorage
    function saveMessagesToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(channelMessages));
        } catch (e) {
            console.warn('Failed to save messages to storage:', e);
        }
    }

    $: currentMessages = channelMessages[currentChannel.id] || [];

    onMount(() => {
        loadMessagesFromStorage();
        if ($isAuthenticated) {
            connectToChannel(currentChannel.id);
        }
    });

    onDestroy(() => {
        saveMessagesToStorage();
        if (lobbyChannel) {
            lobbyChannel.unsubscribe();
        }
    });

    function connectToChannel(channelId) {
        // Cleanup previous channel
        if (lobbyChannel) {
            lobbyChannel.unsubscribe();
        }

        // Setup new channel
        lobbyChannel = setupLobbyChannel(handleNewMessage, channelId);
    }

    function handleNewMessage(payload) {
        // Add message to the appropriate channel
        const channelId = payload.channel || currentChannel.id;
        if (!channelMessages[channelId]) {
            channelMessages[channelId] = [];
        }

        // Avoid duplicates
        if (!channelMessages[channelId].some(m => m.id === payload.id)) {
            channelMessages[channelId] = [...channelMessages[channelId], payload].slice(-MAX_MESSAGES_PER_CHANNEL);
            channelMessages = channelMessages; // Trigger reactivity
            // Save to localStorage
            saveMessagesToStorage();
        }
    }

    function switchChannel(channel) {
        currentChannel = channel;
        showChannelPicker = false;
        connectToChannel(channel.id);
    }

    async function handleSendMessage(event) {
        const { message } = event.detail;
        const sentMessage = await sendLobbyMessage(message, currentChannel.id);
        // Add own message locally (sender doesn't receive own broadcast)
        if (sentMessage) {
            handleNewMessage(sentMessage);
        }
    }

    function handleTyping(event) {
        // Could implement lobby typing indicators
    }

    function toggleChannelPicker() {
        showChannelPicker = !showChannelPicker;
    }
</script>

{#if $isAuthenticated}
    <div class="lobby-chat-screen">
        <div class="chat-header">
            <button class="back-btn" on:click={() => push('/')}>←</button>
            <div class="header-info" on:click={toggleChannelPicker} role="button" tabindex="0" on:keypress={(e) => e.key === 'Enter' && toggleChannelPicker()}>
                <h2>{currentChannel.icon} {currentChannel.label}</h2>
                <span class="online-count">{$onlineCount} neighbors online • tap to switch</span>
            </div>
            <button class="channel-btn" on:click={toggleChannelPicker} title="Switch Channel">
                📺
            </button>
        </div>

        <!-- Channel Picker -->
        {#if showChannelPicker}
            <div class="channel-picker">
                <div class="channel-picker-header">
                    <h3>Select Channel</h3>
                    <button class="close-picker" on:click={() => showChannelPicker = false}>✕</button>
                </div>
                <div class="channel-list">
                    {#each CHANNELS as channel}
                        <button
                            class="channel-item"
                            class:active={currentChannel.id === channel.id}
                            on:click={() => switchChannel(channel)}
                        >
                            <span class="channel-icon">{channel.icon}</span>
                            <div class="channel-info">
                                <span class="channel-name">{channel.label}</span>
                                <span class="channel-desc">{channel.description}</span>
                            </div>
                            {#if channelMessages[channel.id]?.length > 0}
                                <span class="channel-badge">{channelMessages[channel.id].length}</span>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="chat-container">
            <MessageList messages={currentMessages} />
        </div>

        <MessageInput
            placeholder="Message #{currentChannel.label}..."
            on:send={handleSendMessage}
            on:typing={handleTyping}
        />
    </div>
{/if}

<style>
    .lobby-chat-screen {
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
        background: var(--primary, #4CAF50);
        color: white;
        flex-shrink: 0;
        border-radius: 12px 12px 0 0;
    }

    .back-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        color: white;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .back-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
    }

    .header-info {
        flex: 1;
        min-width: 0;
        cursor: pointer;
    }

    .header-info h2 {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .online-count {
        font-size: 12px;
        opacity: 0.9;
    }

    .channel-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        color: white;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .channel-btn:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    /* Channel Picker Styles */
    .channel-picker {
        background: white;
        border-bottom: 1px solid var(--cream-dark, #E0E0E0);
        animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .channel-picker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--cream, #F5F5DC);
    }

    .channel-picker-header h3 {
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        margin: 0;
    }

    .close-picker {
        width: 28px;
        height: 28px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .close-picker:hover {
        background: var(--cream-dark);
    }

    .channel-list {
        padding: 8px;
        max-height: 250px;
        overflow-y: auto;
    }

    .channel-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px;
        border: none;
        background: transparent;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: left;
    }

    .channel-item:hover {
        background: var(--cream);
    }

    .channel-item.active {
        background: var(--primary-light, #E8F5E9);
    }

    .channel-icon {
        font-size: 24px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--cream);
        border-radius: 10px;
    }

    .channel-item.active .channel-icon {
        background: var(--primary);
    }

    .channel-info {
        flex: 1;
        min-width: 0;
    }

    .channel-name {
        display: block;
        font-weight: 600;
        color: var(--text);
        font-size: 14px;
    }

    .channel-desc {
        display: block;
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .channel-badge {
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        background: var(--primary);
        color: white;
        font-size: 11px;
        font-weight: 600;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .chat-container {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    :global(.lobby-chat-screen .chat-container > *) {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    :global(.lobby-chat-screen > .message-input-container) {
        flex-shrink: 0;
        border-radius: 0 0 12px 12px;
    }
</style>
