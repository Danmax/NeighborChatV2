<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { getSupabase, getAuthUserUuid } from '../../lib/supabase.js';
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
    import { showToast } from '../../stores/toasts.js';

    export let params = {};

    let recipientProfile = null;
    let loadingProfile = true;
    let subscription = null;
    let showGifPicker = false;
    let reactionsSubscription = null;

    $: otherUserId = params.id;
    let resolvedUserId = null;

    let localUserUuid = null;

    // Helper to check if a value is a valid UUID
    function isValidUuid(val) {
        if (!val) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    }

    // Get current user ID - prioritize localUserUuid, then user_uuid, then validate other IDs
    $: currentId =
        (localUserUuid && isValidUuid(localUserUuid)) ? localUserUuid :
        ($currentUser?.user_uuid && isValidUuid($currentUser.user_uuid)) ? $currentUser.user_uuid :
        ($currentUser?.user_id && isValidUuid($currentUser.user_id)) ? $currentUser.user_id :
        ($currentUser?.id && isValidUuid($currentUser.id)) ? $currentUser.id :
        null;
    $: mappedMessages = ($threadMessages || []).map(msg => {
        const isOwn = currentId && msg.sender_id === currentId;

        // Defensive: Log type mismatch errors in development
        if (import.meta.env.DEV && currentId && typeof msg.sender_id !== typeof currentId) {
            console.error('Type mismatch in message ownership check:', {
                sender_id: msg.sender_id,
                sender_type: typeof msg.sender_id,
                currentId,
                currentId_type: typeof currentId
            });
        }

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
            reactions: msg.reactions || {},
            _isOwn: isOwn  // Pass the correct ownership calculation to prevent Message component from recalculating
        };
    });

    async function resolveUserId(value) {
        if (!value) return null;

        // If already a UUID, return it
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        if (isUuid) return value;

        // Resolve Clerk ID to UUID
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('clerk_user_id', value)
            .maybeSingle();

        if (error) {
            console.error('Failed to resolve user ID to UUID:', {
                input: value,
                error: error.message
            });
            return null;
        }

        if (!data?.id) {
            console.warn('No user profile found for ID:', value);
            return null;
        }

        return data.id;
    }

    onMount(async () => {
        if (!$isAuthenticated || !otherUserId) return;

        // Ensure we have the current user's UUID
        localUserUuid = await getAuthUserUuid();
        if (!localUserUuid) {
            console.error('Failed to resolve current user UUID');
            showToast('Authentication error. Please sign in again.', 'error');
            return;
        }

        // Resolve the other user's UUID
        resolvedUserId = await resolveUserId(otherUserId);
        if (!resolvedUserId) {
            console.error('Failed to resolve recipient user ID:', otherUserId);
            showToast('Unable to load this conversation.', 'error');
            return;
        }

        try {
            loadingProfile = true;
            recipientProfile = await fetchProfileForUser(resolvedUserId);
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            loadingProfile = false;
        }

        await fetchThread(resolvedUserId);
        await markThreadRead(resolvedUserId);

        subscription = await subscribeToThread(resolvedUserId, () => {
            markThreadRead(resolvedUserId);
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
        if (subscription && typeof subscription.unsubscribe === 'function') {
            try {
                subscription.unsubscribe();
            } catch (error) {
                console.error('Error unsubscribing from thread:', error);
            }
        }
        if (reactionsSubscription && typeof reactionsSubscription.unsubscribe === 'function') {
            try {
                reactionsSubscription.unsubscribe();
            } catch (error) {
                console.error('Error unsubscribing from reactions:', error);
            }
        }
    });

    async function handleSendMessage(event) {
        const { message, isGif } = event.detail;
        if (!message.trim()) return;
        if (!resolvedUserId) return;
        await sendMessageToUser(resolvedUserId, message, isGif);
    }

    async function handleGifSelect(event) {
        const gif = event.detail;
        const caption = gif.message ? gif.message.trim() : '';
        if (!resolvedUserId) return;
        await sendMessageToUser(resolvedUserId, caption, true, gif.url);
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
