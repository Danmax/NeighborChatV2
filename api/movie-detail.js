import { requireClerkUser } from './_clerk.js';
import { rateLimitMiddleware } from './_rateLimit.js';
import { getSupabaseAdmin, readCache, writeCache } from './_shared.js';

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
    if (!await rateLimitMiddleware(req, res, authResult.userId)) {
        return;
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'TMDB_API_KEY not configured' });
        return;
    }

    const movieId = (req.query?.id || '').toString().trim();
    if (!movieId) {
        res.status(400).json({ error: 'Missing id' });
        return;
    }

    const cacheKey = `tmdb:detail:${movieId}`;
    const cached = await readCache(supabase, cacheKey);
    if (cached) {
        res.status(200).json(cached);
        return;
    }

    const url = new URL(`https://api.themoviedb.org/3/movie/${movieId}`);
    url.searchParams.set('api_key', apiKey);

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            const text = await response.text();
            res.status(response.status).json({ error: 'TMDB error', details: text });
            return;
        }
        const item = await response.json();
        const result = {
            id: String(item.id),
            title: item.title,
            year: item.release_date ? parseInt(item.release_date.slice(0, 4), 10) : null,
            poster_url: item.poster_path
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : null,
            overview: item.overview,
            runtime: item.runtime,
            genres: (item.genres || []).map(g => g.name)
        };
        const payload = { result };
        await writeCache(supabase, cacheKey, payload, 168);
        res.status(200).json(payload);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch movie detail' });
    }
}
