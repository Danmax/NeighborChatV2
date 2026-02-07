// Realtime service - Supabase presence and channels
import { getSupabase } from '../lib/supabase.js';
import { currentUser } from '../stores/auth.js';
import {
    setOnlineUsers,
    updateOnlineUser,
    removeOnlineUser,
    userStatus,
    setUserStatus
} from '../stores/presence.js';
import { get } from 'svelte/store';

let presenceChannel = null;
let lobbyChannel = null;
let inviteChannel = null;
let chatChannel = null;

/**
 * Set up presence channel to track online users
 */
export function setupPresenceChannel() {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        console.warn('Cannot setup presence: no user');
        return null;
    }

    // Clean up existing channel
    if (presenceChannel) {
        presenceChannel.unsubscribe();
    }

    const channelName = 'online-users';
    presenceChannel = supabase.channel(channelName);

    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const users = {};

            Object.keys(state).forEach(key => {
                state[key].forEach(presence => {
                    if (presence.user_id) {
                        users[presence.user_id] = {
                            user_id: presence.user_id,
                            user_uuid: presence.user_uuid || null,  // Include UUID for room ID generation
                            name: presence.name,
                            avatar: presence.avatar,
                            interests: presence.interests || [],
                            status: presence.status || 'available',
                            joinedAt: presence.online_at
                        };
                    }
                });
            });

            setOnlineUsers(users);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            newPresences.forEach(presence => {
                if (presence.user_id) {
                    updateOnlineUser(presence.user_id, {
                        user_id: presence.user_id,
                        user_uuid: presence.user_uuid || null,  // Include UUID for room ID generation
                        name: presence.name,
                        avatar: presence.avatar,
                        interests: presence.interests || [],
                        status: presence.status || 'available',
                        joinedAt: presence.online_at
                    });
                }
            });
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            leftPresences.forEach(presence => {
                if (presence.user_id) {
                    removeOnlineUser(presence.user_id);
                }
            });
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await trackPresence();
            }
        });

    return presenceChannel;
}

/**
 * Track current user's presence
 */
export async function trackPresence(status = 'available') {
    const user = get(currentUser);

    if (!presenceChannel || !user) return;

    setUserStatus(status);

    await presenceChannel.track({
        user_id: user.user_id,
        user_uuid: user.user_uuid || null,  // Include UUID for consistent room ID generation
        name: user.name,
        avatar: user.avatar,
        interests: user.interests || [],
        status: status,
        online_at: new Date().toISOString()
    });
}

/**
 * Update presence status
 */
export async function updatePresenceStatus(status) {
    await trackPresence(status);
}

/**
 * Untrack presence (go offline)
 */
export async function untrackPresence() {
    if (presenceChannel) {
        await presenceChannel.untrack();
        setUserStatus('offline');
    }
}

/**
 * Set up lobby chat channel
 * @param {Function} onMessage - Callback for new messages
 * @param {string} channelId - Channel ID (general, new-here, tech, pets, community)
 */
export function setupLobbyChannel(onMessage, channelId = 'general') {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) return null;

    if (lobbyChannel) {
        lobbyChannel.unsubscribe();
    }

    // Create channel-specific room name
    const channelName = `lobby-${channelId}`;
    lobbyChannel = supabase.channel(channelName);

    lobbyChannel
        .on('broadcast', { event: 'message' }, ({ payload }) => {
            onMessage?.(payload);
        })
        .subscribe();

    return lobbyChannel;
}

/**
 * Cleanup lobby channel
 */
export function cleanupLobbyChannel() {
    if (lobbyChannel) {
        lobbyChannel.unsubscribe();
        lobbyChannel = null;
    }
}

/**
 * Send message to lobby chat
 * @param {string} message - Message content
 * @param {string} channelId - Channel ID
 * @param {boolean} isGif - Whether the message is a GIF URL
 */
export async function sendLobbyMessage(message, channelId = 'general', isGif = false) {
    const user = get(currentUser);

    if (!lobbyChannel || !user) return null;

    const payload = {
        id: Date.now().toString(),
        user_id: user.user_id,
        name: user.name,
        avatar: user.avatar,
        message: message,
        isGif: isGif,
        channel: channelId,
        timestamp: Date.now()
    };

    await lobbyChannel.send({
        type: 'broadcast',
        event: 'message',
        payload
    });

    // Return the message so it can be added locally (sender doesn't receive own broadcast)
    return payload;
}

/**
 * Set up invite listener channel
 */
export function setupInviteChannel(onInvite) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) return null;

    if (inviteChannel) {
        inviteChannel.unsubscribe();
    }

    // Listen for invites to this user
    inviteChannel = supabase.channel(`invites-${user.user_id}`);

    inviteChannel
        .on('broadcast', { event: 'chat-invite' }, ({ payload }) => {
            onInvite?.(payload);
        })
        .subscribe();

    return inviteChannel;
}

/**
 * Send chat invite to another user
 */
export async function sendChatInvite(targetUserId) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) return;

    const targetChannel = supabase.channel(`invites-${targetUserId}`);

    // Wait for channel to be subscribed before sending
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            targetChannel.unsubscribe();
            reject(new Error('Channel subscription timeout'));
        }, 5000);

        targetChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                clearTimeout(timeout);
                resolve();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                clearTimeout(timeout);
                reject(new Error(`Channel error: ${status}`));
            }
        });
    });

    await targetChannel.send({
        type: 'broadcast',
        event: 'chat-invite',
        payload: {
            from: {
                user_id: user.user_id,
                name: user.name,
                avatar: user.avatar,
                interests: user.interests || []
            },
            timestamp: Date.now()
        }
    });

    // Cleanup the temporary channel
    targetChannel.unsubscribe();
}

/**
 * Send chat invite with response handling
 * Returns a cleanup function to unsubscribe from the response channel
 */
export async function sendChatInviteWithResponse(targetUserId, onResponse) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        throw new Error('No user logged in');
    }

    // Create a unique response channel for this invite
    const responseChannelName = `invite-response-${user.user_id}-${Date.now()}`;
    const responseChannel = supabase.channel(responseChannelName);

    // Set up listener for invite response
    responseChannel
        .on('broadcast', { event: 'invite-response' }, ({ payload }) => {
            if (payload.targetUserId === user.user_id && payload.fromUserId === targetUserId) {
                onResponse?.(payload.accepted, payload.from);
            }
        })
        .subscribe();

    // Send the invite with response channel info
    const targetChannel = supabase.channel(`invites-${targetUserId}`);

    // Wait for target channel to be subscribed
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            targetChannel.unsubscribe();
            responseChannel.unsubscribe();
            reject(new Error('Channel subscription timeout'));
        }, 5000);

        targetChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                clearTimeout(timeout);
                resolve();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                clearTimeout(timeout);
                targetChannel.unsubscribe();
                responseChannel.unsubscribe();
                reject(new Error(`Channel error: ${status}`));
            }
        });
    });

    // Send invite with response channel info
    await targetChannel.send({
        type: 'broadcast',
        event: 'chat-invite',
        payload: {
            from: {
                user_id: user.user_id,
                name: user.name,
                avatar: user.avatar,
                interests: user.interests || []
            },
            responseChannel: responseChannelName,
            timestamp: Date.now()
        }
    });

    // Cleanup target channel (we only need the response channel now)
    targetChannel.unsubscribe();

    // Return cleanup function
    return () => {
        responseChannel.unsubscribe();
    };
}

/**
 * Send invite response (accept or decline)
 */
export async function sendInviteResponse(responseChannelName, accepted, fromUser) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user || !responseChannelName) return;

    const responseChannel = supabase.channel(responseChannelName);

    // Wait for channel to be subscribed
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            responseChannel.unsubscribe();
            reject(new Error('Response channel timeout'));
        }, 5000);

        responseChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                clearTimeout(timeout);
                resolve();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                clearTimeout(timeout);
                reject(new Error(`Channel error: ${status}`));
            }
        });
    });

    // Send response
    await responseChannel.send({
        type: 'broadcast',
        event: 'invite-response',
        payload: {
            accepted: accepted,
            targetUserId: fromUser.user_id,
            fromUserId: user.user_id,
            from: {
                user_id: user.user_id,
                name: user.name,
                avatar: user.avatar
            },
            timestamp: Date.now()
        }
    });

    // Cleanup
    responseChannel.unsubscribe();
}

/**
 * Set up P2P chat channel
 */
export function setupChatChannel(roomId, callbacks = {}) {
    const supabase = getSupabase();
    const user = get(currentUser);

    console.log('[setupChatChannel] roomId:', roomId, 'user:', user?.user_id);
    if (!user || !roomId) {
        console.warn('[setupChatChannel] Missing user or roomId');
        return null;
    }

    // Clean up existing chat channel
    if (chatChannel) {
        console.log('[setupChatChannel] Cleaning up existing channel');
        chatChannel.unsubscribe();
    }

    chatChannel = supabase.channel(roomId);
    console.log('[setupChatChannel] Created new channel:', roomId);

    chatChannel
        .on('broadcast', { event: 'message' }, ({ payload }) => {
            console.log('[setupChatChannel] Received message event:', payload);
            callbacks.onMessage?.(payload);
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
            console.log('[setupChatChannel] Received typing event:', payload);
            callbacks.onTyping?.(payload);
        })
        .on('broadcast', { event: 'read' }, ({ payload }) => {
            console.log('[setupChatChannel] Received read event:', payload);
            callbacks.onRead?.(payload);
        })
        .on('broadcast', { event: 'leave' }, ({ payload }) => {
            console.log('[setupChatChannel] Received leave event:', payload);
            callbacks.onLeave?.(payload);
        })
        .subscribe((status) => {
            console.log('[setupChatChannel] Subscribe status:', status);
        });

    return chatChannel;
}

/**
 * Send message to P2P chat
 */
export async function sendChatMessage(message, isGif = false) {
    const user = get(currentUser);

    console.log('[sendChatMessage] message:', message, 'isGif:', isGif, 'chatChannel:', !!chatChannel, 'user:', user?.user_id);
    if (!chatChannel || !user) {
        console.error('[sendChatMessage] Failed: chatChannel=', !!chatChannel, 'user=', !!user);
        return null;
    }

    // Use Clerk ID for user_id (consistent with presence system)
    // Also include user_uuid for potential future use
    const broadcastPayload = {
        id: `${user.user_id}-${Date.now()}`,
        user_id: user.user_id,
        user_uuid: user.user_uuid || null,
        name: user.name,
        avatar: user.avatar,
        message: message,
        isGif: isGif,
        timestamp: new Date().toISOString()
        // NOTE: Do NOT include _isOwn in broadcast - it would make receivers think it's their own message
    };

    try {
        console.log('[sendChatMessage] Sending message:', broadcastPayload);
        await chatChannel.send({
            type: 'broadcast',
            event: 'message',
            payload: broadcastPayload
        });
        console.log('[sendChatMessage] Message sent successfully');
    } catch (error) {
        console.error('[sendChatMessage] Failed to send:', error);
        return null;
    }

    // Return with _isOwn: true for local display (sender sees their message on the right side)
    return { ...broadcastPayload, _isOwn: true };
}

/**
 * Send typing indicator
 */
export async function sendTypingIndicator(isTyping = true) {
    const user = get(currentUser);

    if (!chatChannel || !user) return;

    await chatChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
            user_id: user.user_id,
            name: user.name,
            isTyping: isTyping
        }
    });
}

/**
 * Send read receipt
 */
export async function sendReadReceipt() {
    const user = get(currentUser);

    if (!chatChannel || !user) return;

    await chatChannel.send({
        type: 'broadcast',
        event: 'read',
        payload: {
            user_id: user.user_id,
            timestamp: new Date().toISOString()
        }
    });
}

/**
 * Leave chat room
 */
export async function leaveChat() {
    const user = get(currentUser);

    console.log('[leaveChat] Called - chatChannel:', !!chatChannel, 'user:', user?.user_id);
    if (chatChannel && user) {
        try {
            console.log('[leaveChat] Sending leave event for user:', user.user_id);
            await chatChannel.send({
                type: 'broadcast',
                event: 'leave',
                payload: {
                    user_id: user.user_id,
                    name: user.name
                }
            });
            console.log('[leaveChat] Leave event sent successfully');
        } catch (error) {
            console.error('[leaveChat] Failed to send leave event:', error);
        }
        chatChannel.unsubscribe();
        chatChannel = null;
        console.log('[leaveChat] Channel unsubscribed and cleared');
    }
}

/**
 * Clean up all channels
 */
export function cleanupChannels() {
    if (presenceChannel) {
        presenceChannel.unsubscribe();
        presenceChannel = null;
    }
    if (lobbyChannel) {
        lobbyChannel.unsubscribe();
        lobbyChannel = null;
    }
    if (chatChannel) {
        chatChannel.unsubscribe();
        chatChannel = null;
    }
}

export function cleanupInviteChannel() {
    if (inviteChannel) {
        inviteChannel.unsubscribe();
        inviteChannel = null;
    }
}
