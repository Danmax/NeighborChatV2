import { createClient } from '@supabase/supabase-js';

export function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

export function parseBody(body) {
    try {
        return typeof body === 'string' ? JSON.parse(body) : (body || {});
    } catch (e) {
        return {};
    }
}

export async function getOrCreateUserProfile(supabase, userId) {
    const { data: existing, error: findError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_user_id', userId)
        .maybeSingle();

    if (findError) throw new Error('Failed to resolve user profile');
    if (existing?.id) return existing.id;

    const { data: inserted, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
            clerk_user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

    if (insertError) throw new Error('Failed to create user profile');
    return inserted.id;
}

export async function readCache(supabase, cacheKey) {
    if (!supabase) return null;
    const { data } = await supabase
        .from('movie_cache')
        .select('data, expires_at')
        .eq('cache_key', cacheKey)
        .single();
    if (!data) return null;
    if (new Date(data.expires_at) < new Date()) return null;
    return data.data;
}

export async function writeCache(supabase, cacheKey, payload, ttlHours) {
    if (!supabase) return;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    await supabase.from('movie_cache').upsert({
        cache_key: cacheKey,
        data: payload,
        expires_at: expiresAt
    });
}