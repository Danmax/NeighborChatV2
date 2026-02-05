import { createClient } from '@supabase/supabase-js';
import { requireClerkUser } from './_clerk.js';
import { rateLimitMiddleware } from './_rateLimit.js';

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

async function readCache(cacheKey) {
    const supabase = getSupabaseAdmin();
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

async function writeCache(cacheKey, payload, ttlHours = 24) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    await supabase.from('movie_cache').upsert({
        cache_key: cacheKey,
        data: payload,
        expires_at: expiresAt
    });
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        res.status(500).json({ error: 'Server misconfigured' });
        return;
    }
    const authResult = await requireClerkUser(req);
    if (authResult?.error) {
        res.status(authResult.status || 401).json({ error: authResult.error });
        return;
    }

    // Rate limit: 100 requests per hour per user
    if (!rateLimitMiddleware(req, res, authResult.userId)) {
        return;
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'TMDB_API_KEY not configured' });
        return;
    }

    const query = (req.query?.q || '').toString().trim();
    if (!query) {
        res.status(400).json({ error: 'Missing query' });
        return;
    }

    const cacheKey = `tmdb:search:${query.toLowerCase()}`;
    const cached = await readCache(cacheKey);
    if (cached) {
        res.status(200).json(cached);
        return;
    }

    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('include_adult', 'false');

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            const text = await response.text();
            res.status(response.status).json({ error: 'TMDB error', details: text });
            return;
        }
        const data = await response.json();
        const results = (data.results || []).map(item => ({
            id: String(item.id),
            title: item.title,
            year: item.release_date ? parseInt(item.release_date.slice(0, 4), 10) : null,
            poster_url: item.poster_path
                ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
                : null,
            overview: item.overview
        }));
        const payload = { results };
        await writeCache(cacheKey, payload, 12);
        res.status(200).json(payload);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch movies' });
    }
}
