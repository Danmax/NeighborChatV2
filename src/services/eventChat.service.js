import { getSupabase, getAuthUserId } from '../lib/supabase.js';

async function fetchProfilesByIds(userIds) {
    if (!userIds.length) return {};
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, avatar, username')
        .in('user_id', userIds);

    if (error) throw error;

    return (data || []).reduce((acc, profile) => {
        acc[profile.user_id] = {
            user_id: profile.user_id,
            name: profile.display_name || profile.username || 'Neighbor',
            avatar: profile.avatar || { emoji1: '😊', background: '#E8F5E9' },
            username: profile.username || null
        };
        return acc;
    }, {});
}

function transformEventChatMessage(row, profile) {
    const isGif = row.message_type === 'gif';
    const gifUrl = row.metadata?.gif_url || null;
    return {
        id: row.id,
        user_id: row.user_id,
        name: profile?.name || 'Neighbor',
        avatar: profile?.avatar,
        message: row.body,
        isGif,
        gif_url: gifUrl,
        caption: row.body,
        timestamp: row.created_at,
        reactions: {}
    };
}

export async function fetchEventChatMessages(eventId, limit = 200) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('event_chat_messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) throw error;

    const messages = data || [];
    const profilesById = await fetchProfilesByIds([...new Set(messages.map(m => m.user_id))]);
    return messages.map(row => transformEventChatMessage(row, profilesById[row.user_id]));
}

export async function sendEventChatMessage(eventId, body, isGif = false, gifUrl = null) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('You must be signed in to send messages.');
    }

    const { data, error } = await supabase.rpc('add_event_chat_message', {
        p_event_id: eventId,
        p_body: body,
        p_message_type: isGif ? 'gif' : 'text',
        p_gif_url: gifUrl
    });

    if (error) throw error;

    if (data) {
        const profilesById = await fetchProfilesByIds([data.user_id]);
        return transformEventChatMessage(data, profilesById[data.user_id]);
    }

    return null;
}

export async function subscribeToEventChat(eventId, onMessage) {
    const supabase = getSupabase();
    const channel = supabase.channel(`event-chat-${eventId}`);

    channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_chat_messages', filter: `event_id=eq.${eventId}` },
        async (payload) => {
            const row = payload.new;
            const profilesById = await fetchProfilesByIds([row.user_id]);
            const message = transformEventChatMessage(row, profilesById[row.user_id]);
            onMessage?.(message);
        }
    );

    channel.subscribe();
    return channel;
}
