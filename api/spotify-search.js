import { requireClerkUser } from './_clerk.js';
import { rateLimitMiddleware } from './_rateLimit.js';
import { getSupabaseAdmin, readCache, writeCache } from './_shared.js';

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getSpotifyToken() {
    const now = Date.now();
    if (cachedToken && cachedTokenExpiresAt > now + 10_000) {
        return cachedToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    cachedToken = data.access_token;
    cachedTokenExpiresAt = now + (data.expires_in || 3600) * 1000;
    return cachedToken;
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

    if (!await rateLimitMiddleware(req, res, authResult.userId)) {
        return;
    }

    const query = (req.query?.q || '').toString().trim();
    if (!query) {
        res.status(400).json({ error: 'Missing query' });
        return;
    }

    const offset = parseInt(req.query?.offset || '0', 10);
    const cacheKey = `spotify:track:${query.toLowerCase()}:${offset}`;
    const cached = await readCache(supabase, cacheKey);
    if (cached) {
        res.status(200).json(cached);
        return;
    }

    const token = await getSpotifyToken();
    if (!token) {
        res.status(500).json({ error: 'Spotify credentials not configured' });
        return;
    }

    const url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'track');
    url.searchParams.set('limit', '10');
    url.searchParams.set('offset', offset.toString());

    try {
        const response = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
            const text = await response.text();
            res.status(response.status).json({ error: 'Spotify error', details: text });
            return;
        }
        const data = await response.json();
        const results = (data.tracks?.items || []).map(item => ({
            id: item.id,
            title: item.name,
            artists: (item.artists || []).map(a => a.name).join(', '),
            album: item.album?.name || null,
            image_url: item.album?.images?.[1]?.url || item.album?.images?.[0]?.url || null,
            url: item.external_urls?.spotify || null,
            preview_url: item.preview_url || null,
            uri: item.uri
        }));
        const payload = { results };
        await writeCache(supabase, cacheKey, payload, 6);
        res.status(200).json(payload);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tracks' });
    }
}
