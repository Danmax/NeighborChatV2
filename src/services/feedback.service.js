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
    let metadata = null;
    if (resolutionNote && resolutionNote.trim()) {
        const { data: current, error: fetchError } = await supabase
            .from('feedback')
            .select('metadata')
            .eq('id', id)
            .single();
        if (fetchError) throw fetchError;
        metadata = {
            ...(current?.metadata || {}),
            resolution_note: resolutionNote.trim(),
            resolved_at: new Date().toISOString()
        };
    }
    const { data, error } = await supabase
        .from('feedback')
        .update(metadata ? { status, metadata } : { status })
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
