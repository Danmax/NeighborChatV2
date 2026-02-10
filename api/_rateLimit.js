import { getSupabaseAdmin } from './_shared.js';

const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_MAX_REQUESTS = 100;

/**
 * Check rate limit for a user
 * @param {string} userId - User identifier
 * @param {object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds (default: 1 hour)
 * @param {number} options.maxRequests - Max requests per window (default: 100)
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export async function checkRateLimit(userId, options = {}) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        // Fail open if DB is not configured
        return { allowed: true, remaining: 1, resetAt: Date.now() + 1000 };
    }

    const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
    const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
    const key = `rate:${userId}`;

    const { data, error } = await supabase.rpc('check_rate_limit', {
        p_key: key,
        p_window_ms: windowMs,
        p_max_requests: maxRequests
    });

    if (error) {
        console.error('Rate limit error:', error);
        // Fail open on error so we don't block users if the DB hiccups
        return { allowed: true, remaining: 1, resetAt: Date.now() + windowMs };
    }

    return data;
}

/**
 * Rate limit middleware for API endpoints
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {string} userId - User identifier
 * @param {object} options - Rate limit options
 * @returns {boolean} - True if allowed, false if rate limited (response already sent)
 */
export async function rateLimitMiddleware(req, res, userId, options = {}) {
    const result = await checkRateLimit(userId, options);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
        res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
        });
        return false;
    }

    return true;
}
