import { getSupabase } from '../lib/supabase.js';
import { get } from 'svelte/store';
import { currentUser } from '../stores/auth.js';

export async function submitFeedback({ category, title, message }) {
    const supabase = getSupabase();
    const user = get(currentUser);
    if (!user?.user_id) {
        throw new Error('Please sign in to submit feedback.');
    }

    const payload = {
        user_id: user.user_id,
        username: user.username || user.name || null,
        category,
        title: title?.trim() || null,
        message: message?.trim()
    };

    const { data, error } = await supabase
        .from('feedback')
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function fetchMyFeedback() {
    const supabase = getSupabase();
    const user = get(currentUser);
    if (!user?.user_id) return [];

    const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function fetchAllFeedback() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function updateFeedbackStatus(id, status) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('feedback')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function isPlatformAdmin() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('is_platform_admin');
    if (error) throw error;
    return !!data;
}
