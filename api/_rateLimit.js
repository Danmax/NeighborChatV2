// api/_rateLimit.js - Simple in-memory rate limiting
const rateLimitStore = new Map();

const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_MAX_REQUESTS = 100;

/**
 * Clean up expired entries from rate limit store
 */
function cleanupExpiredEntries() {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now > data.windowEnd) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Check rate limit for a user
 * @param {string} userId - User identifier
 * @param {object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds (default: 1 hour)
 * @param {number} options.maxRequests - Max requests per window (default: 100)
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function checkRateLimit(userId, options = {}) {
    const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
    const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
    const now = Date.now();

    // Periodically clean up (every 100 checks)
    if (Math.random() < 0.01) {
        cleanupExpiredEntries();
    }

    const key = `rate:${userId}`;
    let data = rateLimitStore.get(key);

    // Initialize or reset if window expired
    if (!data || now > data.windowEnd) {
        data = {
            count: 0,
            windowEnd: now + windowMs
        };
    }

    data.count++;
    rateLimitStore.set(key, data);

    const allowed = data.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - data.count);

    return {
        allowed,
        remaining,
        resetAt: data.windowEnd
    };
}

/**
 * Rate limit middleware for API endpoints
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {string} userId - User identifier
 * @param {object} options - Rate limit options
 * @returns {boolean} - True if allowed, false if rate limited (response already sent)
 */
export function rateLimitMiddleware(req, res, userId, options = {}) {
    const result = checkRateLimit(userId, options);

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
