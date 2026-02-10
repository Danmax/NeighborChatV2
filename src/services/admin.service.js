import { getSupabase, getAuthUserUuid } from '../lib/supabase.js';
import { get } from 'svelte/store';
import { currentUser } from '../stores/auth.js';
import { getActiveMembershipId } from './events.service.js';

function makeTextId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`;
}

function makeInviteCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

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

    const uuidIds = userIds.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id)));
    const clerkIds = userIds.map(String);

    const profileQueries = [];
    if (uuidIds.length > 0) {
        profileQueries.push(
            supabase
                .from('user_profiles')
                .select('id, clerk_user_id, username, display_name')
                .in('id', uuidIds)
        );
    }
    if (clerkIds.length > 0) {
        profileQueries.push(
            supabase
                .from('user_profiles')
                .select('id, clerk_user_id, username, display_name')
                .in('clerk_user_id', clerkIds)
        );
    }

    const profileResults = await Promise.all(profileQueries);
    const profiles = profileResults.flatMap((result) => result.data || []);

    const profileMap = new Map();
    for (const profile of profiles || []) {
        if (profile?.id) profileMap.set(String(profile.id), profile);
        if (profile?.clerk_user_id) profileMap.set(String(profile.clerk_user_id), profile);
    }

    const unresolved = userIds.filter((id) => !profileMap.has(String(id)));
    const unresolvedUuidIds = unresolved.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id)));

    if (unresolvedUuidIds.length > 0) {
        const { data: memberships } = await supabase
            .from('instance_memberships')
            .select('user_id, display_name')
            .in('user_id', unresolvedUuidIds)
            .eq('status', 'active');

        for (const membership of memberships || []) {
            const key = String(membership.user_id);
            if (!profileMap.has(key)) {
                profileMap.set(key, {
                    id: membership.user_id,
                    clerk_user_id: null,
                    username: null,
                    display_name: membership.display_name
                });
            }
        }
    }

    return requests.map(req => ({
        ...req,
        username: profileMap.get(String(req.user_id))?.username || null,
        display_name: profileMap.get(String(req.user_id))?.display_name || null
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

export async function fetchMyCommunityInstance() {
    const supabase = getSupabase();
    const membershipId = await getActiveMembershipId();
    if (!membershipId) return null;

    const { data: membership, error: membershipError } = await supabase
        .from('instance_memberships')
        .select('instance_id')
        .eq('id', membershipId)
        .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership?.instance_id) return null;

    const { data, error } = await supabase
        .from('community_instances')
        .select('id,name,description,logo,instance_type,is_public,invite_code,settings,enabled_features')
        .eq('id', membership.instance_id)
        .maybeSingle();
    if (error) throw error;
    return data || null;
}

export async function fetchManagedCommunityInstances() {
    const supabase = getSupabase();
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) return [];

    const { data: memberships, error: membershipsError } = await supabase
        .from('instance_memberships')
        .select('instance_id, role')
        .eq('user_id', authUserUuid)
        .eq('status', 'active')
        .in('role', ['admin', 'moderator']);

    if (membershipsError) throw membershipsError;

    const instanceIds = [...new Set((memberships || []).map(m => m.instance_id).filter(Boolean))];
    if (instanceIds.length === 0) return [];

    const { data, error } = await supabase
        .from('community_instances')
        .select('id,name,description,logo,instance_type,is_public,invite_code,settings,enabled_features')
        .in('id', instanceIds)
        .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function createCommunityInstance({
    name,
    description = '',
    logo = '🏘️',
    instance_type = 'neighborhood',
    is_public = true
}) {
    const supabase = getSupabase();
    const authUserUuid = await getAuthUserUuid();
    const user = get(currentUser);

    if (!authUserUuid) {
        throw new Error('Please sign in.');
    }

    const cleanName = String(name || '').trim();
    if (!cleanName) {
        throw new Error('Community name is required.');
    }

    const now = new Date().toISOString();
    const instanceId = makeTextId('inst');
    const membershipId = makeTextId('mbr');
    const inviteCode = makeInviteCode();

    const defaultSettings = {
        theme: 'default',
        maxMembers: null,
        enableGames: true,
        enableAwards: true,
        enableEvents: true,
        enableSponsors: true,
        enableKnowledge: true,
        requireApproval: false,
        allowGuestAccess: true
    };
    const defaultEnabledFeatures = ['games', 'events', 'celebrations', 'chat', 'awards'];

    const { data: instance, error: instanceError } = await supabase
        .from('community_instances')
        .insert({
            id: instanceId,
            name: cleanName,
            description: description?.trim() || null,
            logo: logo?.trim() || '🏘️',
            instance_type: instance_type || 'neighborhood',
            settings: defaultSettings,
            enabled_features: defaultEnabledFeatures,
            admin_ids: [authUserUuid],
            moderator_ids: [],
            invite_code: inviteCode,
            is_public: !!is_public,
            created_at: now,
            updated_at: now
        })
        .select('id,name,description,logo,instance_type,is_public,invite_code,settings,enabled_features')
        .single();

    if (instanceError) throw instanceError;

    const displayName = user?.username || user?.name || user?.display_name || 'Admin';
    const avatar = user?.avatar || {};

    const { error: membershipError } = await supabase
        .from('instance_memberships')
        .insert({
            id: membershipId,
            user_id: authUserUuid,
            instance_id: instanceId,
            display_name: displayName,
            avatar,
            role: 'admin',
            status: 'active',
            joined_at: now,
            last_active_at: now
        });

    if (membershipError) {
        throw new Error(`Community created but admin membership failed: ${membershipError.message}`);
    }

    return instance;
}

export async function updateMyCommunityInstanceSettings({
    instance_id,
    is_public,
    settings,
    enabled_features
}) {
    const supabase = getSupabase();
    let targetInstanceId = instance_id;

    if (!targetInstanceId) {
        const membershipId = await getActiveMembershipId();
        if (!membershipId) {
            throw new Error('No active community membership found.');
        }

        const { data: membership, error: membershipError } = await supabase
            .from('instance_memberships')
            .select('instance_id')
            .eq('id', membershipId)
            .maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership?.instance_id) {
            throw new Error('Unable to resolve community instance.');
        }
        targetInstanceId = membership.instance_id;
    }

    const updates = {
        updated_at: new Date().toISOString()
    };
    if (is_public !== undefined) updates.is_public = is_public;
    if (settings !== undefined) updates.settings = settings;
    if (enabled_features !== undefined) updates.enabled_features = enabled_features;

    const { data, error } = await supabase
        .from('community_instances')
        .update(updates)
        .eq('id', targetInstanceId)
        .select('id,name,description,logo,instance_type,is_public,invite_code,settings,enabled_features')
        .single();
    if (error) throw error;
    return data;
}
