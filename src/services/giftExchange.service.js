import { getSupabase, getAuthUserId } from '../lib/supabase.js';

export async function fetchWishlist(eventId, userId = null) {
    const supabase = getSupabase();
    let query = supabase
        .from('gift_exchange_wishlist_items')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
    if (userId) {
        query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function addWishlistItem(eventId, item) {
    const authUserId = await getAuthUserId();
    if (!authUserId) throw new Error('Please sign in to add items.');
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('gift_exchange_wishlist_items')
        .insert([{
            event_id: eventId,
            user_id: authUserId,
            title: item.title,
            description: item.description || null,
            url: item.url || null,
            price_range: item.price_range || null
        }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function removeWishlistItem(itemId) {
    const supabase = getSupabase();
    const { error } = await supabase
        .from('gift_exchange_wishlist_items')
        .delete()
        .eq('id', itemId);
    if (error) throw error;
    return true;
}

export async function fetchWishlistTemplates() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('gift_exchange_wishlist_templates')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function addWishlistTemplate(item) {
    const authUserId = await getAuthUserId();
    if (!authUserId) throw new Error('Please sign in to save templates.');
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('gift_exchange_wishlist_templates')
        .insert([{
            user_id: authUserId,
            title: item.title,
            description: item.description || null,
            url: item.url || null,
            price_range: item.price_range || null
        }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function fetchMatchForUser(eventId) {
    const authUserId = await getAuthUserId();
    if (!authUserId) throw new Error('Please sign in.');
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('gift_exchange_matches')
        .select('*')
        .eq('event_id', eventId)
        .or(`giver_user_id.eq.${authUserId},receiver_user_id.eq.${authUserId}`)
        .limit(1)
        .single();
    if (error) return null;
    return data;
}

export async function generateMatches(eventId) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('generate_gift_exchange_matches', {
        p_event_id: eventId
    });
    if (error) throw error;
    return data;
}

export async function assignMatch(eventId, giverUserId, receiverUserId) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('assign_gift_exchange_match', {
        p_event_id: eventId,
        p_giver_user_id: giverUserId,
        p_receiver_user_id: receiverUserId
    });
    if (error) throw error;
    return data;
}

export async function sendGiftExchangeMessage(eventId, receiverId, kind, body) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('send_gift_exchange_message', {
        p_event_id: eventId,
        p_receiver_id: receiverId,
        p_kind: kind,
        p_body: body
    });
    if (error) throw error;
    return data;
}
