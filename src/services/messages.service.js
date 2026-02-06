import { getSupabase, getAuthUserUuid } from '../lib/supabase.js';
import { currentUser } from '../stores/auth.js';
import {
    setInboxThreads,
    setThreadMessages,
    addThreadMessage,
    messagesLoading,
    setMessagesError,
    updateThreadPreview,
    upsertThread,
    updateMessageRead,
    updateMessageReactions
} from '../stores/messages.js';
import { get } from 'svelte/store';

function normalizeProfile(profile) {
    return {
        user_id: profile.user_id,
        name: profile.display_name || profile.username || 'Neighbor',
        avatar: profile.avatar || { emoji1: '😊', background: '#E8F5E9' },
        username: profile.username || null
    };
}

async function fetchProfilesByIds(userIds) {
    if (!userIds.length) return {};
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, avatar, username')
        .in('user_id', userIds);

    if (error) throw error;

    return (data || []).reduce((acc, profile) => {
        acc[profile.user_id] = normalizeProfile(profile);
        return acc;
    }, {});
}

function buildThreads(messages, authUserId, profilesById) {
    const threads = new Map();

    messages.forEach(message => {
        const otherUserId = message.sender_id === authUserId
            ? message.recipient_id
            : message.sender_id;

        const existing = threads.get(otherUserId);
        const base = {
            user_id: otherUserId,
            profile: profilesById[otherUserId],
            last_message: message.body,
            last_at: message.created_at,
            unread_count: 0
        };

        if (!existing) {
            threads.set(otherUserId, base);
        }

        if (message.recipient_id === authUserId && !message.read) {
            const updated = threads.get(otherUserId);
            updated.unread_count += 1;
            threads.set(otherUserId, updated);
        }
    });

    return Array.from(threads.values())
        .sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
}

export async function fetchInbox() {
    messagesLoading.set(true);
    setMessagesError(null);

    try {
        const authUserUuid = await getAuthUserUuid();
        if (!authUserUuid) {
            throw new Error('You must be signed in to view messages.');
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${authUserUuid},recipient_id.eq.${authUserUuid}`)
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        const messageList = data || [];
        const userIds = Array.from(new Set(messageList.flatMap(m => [m.sender_id, m.recipient_id])))
            .filter(id => id !== authUserUuid);
        const profilesById = await fetchProfilesByIds(userIds);

        const threads = buildThreads(messageList, authUserUuid, profilesById);
        setInboxThreads(threads);
        return threads;
    } catch (error) {
        console.error('Failed to fetch inbox:', error);
        setMessagesError(error.message);
        return [];
    } finally {
        messagesLoading.set(false);
    }
}

export async function fetchThread(otherUserId) {
    messagesLoading.set(true);
    setMessagesError(null);

    try {
        const authUserUuid = await getAuthUserUuid();
        if (!authUserUuid) {
            throw new Error('You must be signed in to view messages.');
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(
                `and(sender_id.eq.${authUserUuid},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${authUserUuid})`
            )
            .order('created_at', { ascending: true });

        if (error) throw error;

        const messagesWithReactions = await attachMessageReactions(data || []);
        setThreadMessages(messagesWithReactions);
        return messagesWithReactions;
    } catch (error) {
        console.error('Failed to fetch thread:', error);
        setMessagesError(error.message);
        return [];
    } finally {
        messagesLoading.set(false);
    }
}

async function fetchMessageReactions(messageIds) {
    if (!messageIds.length) return {};
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', messageIds);

    if (error) throw error;

    return (data || []).reduce((acc, row) => {
        if (!acc[row.message_id]) acc[row.message_id] = {};
        if (!acc[row.message_id][row.emoji]) acc[row.message_id][row.emoji] = [];
        acc[row.message_id][row.emoji].push(row.user_id);
        return acc;
    }, {});
}

export async function refreshMessageReactions(messageId) {
    const reactionsByMessage = await fetchMessageReactions([messageId]);
    updateMessageReactions(messageId, reactionsByMessage[messageId] || {});
    return reactionsByMessage[messageId] || {};
}

async function attachMessageReactions(messages) {
    if (!messages.length) return messages;
    const reactionsByMessage = await fetchMessageReactions(messages.map(m => m.id));
    return messages.map(message => ({
        ...message,
        reactions: reactionsByMessage[message.id] || {}
    }));
}

export async function reactToMessage(messageId, emoji) {
    const supabase = getSupabase();
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('You must be signed in to react to messages.');
    }

    const { data, error } = await supabase.rpc('add_message_reaction', {
        p_message_id: messageId,
        p_emoji: emoji
    });

    if (error) throw error;

    updateMessageReactions(messageId, data || {});
    return data;
}

export async function subscribeToMessageReactions(callback) {
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) return null;
    const supabase = getSupabase();
    const channel = supabase.channel('message-reactions');

    channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
            callback?.(payload);
        }
    );

    try {
        await channel.subscribe();
    } catch (error) {
        console.error('Failed to subscribe to message reactions:', error);
        return null;
    }
    return channel;
}

export async function sendMessageToUser(otherUserId, body, isGif = false, gifUrl = null) {
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('You must be signed in to send messages.');
    }

    const supabase = getSupabase();
    const payload = {
        sender_id: authUserUuid,
        recipient_id: otherUserId,
        body: body.trim(),
        message_type: isGif ? 'gif' : 'direct',
        read: false,
        metadata: isGif && gifUrl ? { gif_url: gifUrl } : {}
    };

    const { data, error } = await supabase
        .from('messages')
        .insert([payload])
        .select()
        .single();

    if (error) throw error;

    addThreadMessage({ ...data, reactions: {} });
    updateThreadPreview(otherUserId, {
        last_message: data.body,
        last_at: data.created_at
    });
    return data;
}

export async function markThreadRead(otherUserId) {
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) return;

    const supabase = getSupabase();
    const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('recipient_id', authUserUuid)
        .eq('sender_id', otherUserId)
        .eq('read', false);

    if (error) {
        console.error('Failed to mark thread read:', error);
    } else {
        updateThreadPreview(otherUserId, { unread_count: 0 });
    }
}

export async function fetchProfileForUser(otherUserId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, avatar, username')
        .eq('user_id', otherUserId)
        .single();

    if (error) throw error;
    return normalizeProfile(data);
}

export async function subscribeToInbox(callback) {
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) return null;

    const supabase = getSupabase();
    const channel = supabase.channel('messages-inbox');

    channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${authUserUuid}` },
        async (payload) => {
            const message = payload.new;
            const otherUserId = message.sender_id;
            const profilesById = await fetchProfilesByIds([otherUserId]);
            const profile = profilesById[otherUserId];
            upsertThread({
                user_id: otherUserId,
                profile,
                last_message: message.body,
                last_at: message.created_at,
                unread_count: 1
            });
            callback?.(payload);
        }
    );

    channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${authUserUuid}` },
        async (payload) => {
            const message = payload.new;
            const otherUserId = message.recipient_id;
            const profilesById = await fetchProfilesByIds([otherUserId]);
            const profile = profilesById[otherUserId];
            upsertThread({
                user_id: otherUserId,
                profile,
                last_message: message.body,
                last_at: message.created_at
            });
            callback?.(payload);
        }
    );

    try {
        await channel.subscribe();
    } catch (error) {
        console.error('Failed to subscribe to inbox:', error);
        return null;
    }
    return channel;
}

export async function subscribeToThread(otherUserId, callback) {
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid || !otherUserId) return null;

    const supabase = getSupabase();
    const channel = supabase.channel(`messages-thread-${otherUserId}`);

    channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${authUserUuid}` },
        (payload) => {
            const message = payload.new;
            if (message.sender_id !== otherUserId) return;
            addThreadMessage({ ...message, reactions: {} });
            updateThreadPreview(otherUserId, {
                last_message: message.body,
                last_at: message.created_at,
                unread_count: 0
            });
            callback?.(payload);
        }
    );

    channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${authUserUuid}` },
        (payload) => {
            const message = payload.new;
            if (message.recipient_id !== otherUserId) return;
            addThreadMessage({ ...message, reactions: {} });
            updateThreadPreview(otherUserId, {
                last_message: message.body,
                last_at: message.created_at
            });
            callback?.(payload);
        }
    );

    channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${authUserUuid}` },
        (payload) => {
            const message = payload.new;
            if (message.recipient_id !== otherUserId) return;
            updateMessageRead(message.id, message.read);
            callback?.(payload);
        }
    );

    try {
        await channel.subscribe();
    } catch (error) {
        console.error('Failed to subscribe to thread:', error);
        return null;
    }
    return channel;
}
