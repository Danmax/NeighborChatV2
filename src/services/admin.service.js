import { getSupabase, getAuthUserUuid } from '../lib/supabase.js';
import { get } from 'svelte/store';
import { currentUser } from '../stores/auth.js';

export async function isPlatformAdmin() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('is_platform_admin');
    if (error) throw error;
    return !!data;
}

export async function canManageEventAccess() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('can_manage_event_access');
    if (error) throw error;
    return !!data;
}

export async function fetchAppSettings() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('app_settings')
        .select('key,value,updated_at,updated_by')
        .order('key');
    if (error) throw error;
    return data || [];
}

export async function upsertAppSetting(key, value) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('app_settings')
        .upsert({ key, value }, { onConflict: 'key' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function fetchStatusOptions() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('status_options')
        .select('*')
        .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function upsertStatusOption(option) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('status_options')
        .upsert(option, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteStatusOption(id) {
    const supabase = getSupabase();
    const { error } = await supabase.from('status_options').delete().eq('id', id);
    if (error) throw error;
    return true;
}

export async function fetchInterestOptions() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('interest_options')
        .select('*')
        .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function upsertInterestOption(option) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('interest_options')
        .upsert(option, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteInterestOption(id) {
    const supabase = getSupabase();
    const { error } = await supabase.from('interest_options').delete().eq('id', id);
    if (error) throw error;
    return true;
}

export async function fetchEventManagerRequests() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('event_manager_requests')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;

    const requests = data || [];
    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];
    if (userIds.length === 0) return requests;

    const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, username, display_name')
        .in('id', userIds);

    if (profileError) {
        return requests;
    }

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    return requests.map(req => ({
        ...req,
        username: profileMap.get(req.user_id)?.username || null,
        display_name: profileMap.get(req.user_id)?.display_name || null
    }));
}

export async function submitEventManagerRequest(reason) {
    const supabase = getSupabase();
    const user = get(currentUser);
    const authUserUuid = await getAuthUserUuid();
    if (!user?.user_id || !authUserUuid) {
        throw new Error('Please sign in.');
    }
    const { data, error } = await supabase
        .from('event_manager_requests')
        .insert({ user_id: authUserUuid, reason })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function reviewEventManagerRequest(requestId, status) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('review_event_manager_request', {
        p_request_id: String(requestId),
        p_status: status
    });
    if (error) throw error;
    return data;
}

export async function setUserRole(userId, role) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('set_user_role', {
        p_user_id: userId,
        p_role: role
    });
    if (error) throw error;
    return data;
}

export async function getUsageMetrics() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_usage_metrics');
    if (error) throw error;
    return data;
}

export async function getDatabaseStatus() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_database_status');
    if (error) throw error;
    return data;
}
