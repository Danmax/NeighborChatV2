import { getSupabase } from '../lib/supabase.js';
import { get } from 'svelte/store';
import { currentUser } from '../stores/auth.js';

export async function submitFeedback({ category, title, message }) {
    const supabase = getSupabase();
    const user = get(currentUser);
    const currentId = user?.user_uuid || user?.user_id;
    if (!currentId) {
        throw new Error('Please sign in to submit feedback.');
    }

    const payload = {
        user_id: currentId,
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
    const currentId = user?.user_uuid || user?.user_id;
    if (!currentId) return [];

    const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', currentId)
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

export async function updateFeedbackStatus(id, status, resolutionNote = null) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('admin_update_feedback', {
        p_id: id,
        p_status: status,
        p_resolution_note: resolutionNote || null
    });

    if (error) throw error;
    return data;
}

export async function isPlatformAdmin() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('is_platform_admin');
    if (error) throw error;
    return !!data;
}
