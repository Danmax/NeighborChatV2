import { getSupabase, getAuthUserId } from '../lib/supabase.js';
import { currentUser } from '../stores/auth.js';
import {
    setInboxThreads,
    setThreadMessages,
    addThreadMessage,
    messagesLoading,
    setMessagesError,
    updateThreadPreview,
    upsertThread,
    updateMessageRead
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
        const authUserId = await getAuthUserId();
        if (!authUserId) {
            throw new Error('You must be signed in to view messages.');
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${authUserId},recipient_id.eq.${authUserId}`)
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        const messageList = data || [];
        const userIds = Array.from(new Set(messageList.flatMap(m => [m.sender_id, m.recipient_id])))
            .filter(id => id !== authUserId);
        const profilesById = await fetchProfilesByIds(userIds);

        const threads = buildThreads(messageList, authUserId, profilesById);
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
        const authUserId = await getAuthUserId();
        if (!authUserId) {
            throw new Error('You must be signed in to view messages.');
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(
                `and(sender_id.eq.${authUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${authUserId})`
            )
            .order('created_at', { ascending: true });

        if (error) throw error;

        setThreadMessages(data || []);
        return data || [];
    } catch (error) {
        console.error('Failed to fetch thread:', error);
        setMessagesError(error.message);
        return [];
    } finally {
        messagesLoading.set(false);
    }
}

export async function sendMessageToUser(otherUserId, body) {
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('You must be signed in to send messages.');
    }

    const supabase = getSupabase();
    const payload = {
        sender_id: authUserId,
        recipient_id: otherUserId,
        body: body.trim(),
        message_type: 'direct',
        read: false
    };

    const { data, error } = await supabase
        .from('messages')
        .insert([payload])
        .select()
        .single();

    if (error) throw error;

    addThreadMessage(data);
    updateThreadPreview(otherUserId, {
        last_message: data.body,
        last_at: data.created_at
    });
    return data;
}

export async function markThreadRead(otherUserId) {
    const authUserId = await getAuthUserId();
    if (!authUserId) return;

    const supabase = getSupabase();
    const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('recipient_id', authUserId)
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
    const authUserId = await getAuthUserId();
    if (!authUserId) return null;

    const supabase = getSupabase();
    const channel = supabase.channel('messages-inbox');

    channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${authUserId}` },
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
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${authUserId}` },
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

    channel.subscribe();
    return channel;
}

export async function subscribeToThread(otherUserId, callback) {
    const authUserId = await getAuthUserId();
    if (!authUserId || !otherUserId) return null;

    const supabase = getSupabase();
    const channel = supabase.channel(`messages-thread-${otherUserId}`);

    channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${authUserId}` },
        (payload) => {
            const message = payload.new;
            if (message.sender_id !== otherUserId) return;
            addThreadMessage(message);
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
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${authUserId}` },
        (payload) => {
            const message = payload.new;
            if (message.recipient_id !== otherUserId) return;
            addThreadMessage(message);
            updateThreadPreview(otherUserId, {
                last_message: message.body,
                last_at: message.created_at
            });
            callback?.(payload);
        }
    );

    channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${authUserId}` },
        (payload) => {
            const message = payload.new;
            if (message.recipient_id !== otherUserId) return;
            updateMessageRead(message.id, message.read);
            callback?.(payload);
        }
    );

    channel.subscribe();
    return channel;
}
