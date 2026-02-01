// Username utility functions for generation, validation, and availability checking

/**
 * Generate a random username in the format: adjective_noun_number
 * @returns {string} Generated username like "friendly_neighbor_4285"
 */
export function generateRandomUsername() {
    const adjectives = [
        'friendly', 'happy', 'cheerful', 'kind', 'sunny', 'bright',
        'gentle', 'caring', 'helpful', 'amazing', 'awesome', 'cool',
        'smart', 'clever', 'wise', 'peaceful', 'joyful', 'lively',
        'vibrant', 'active', 'energetic', 'creative', 'artistic', 'musical',
        'sporty', 'outdoorsy', 'cozy', 'warm', 'sweet', 'lovely'
    ];

    const nouns = [
        'neighbor', 'friend', 'buddy', 'explorer', 'adventurer', 'dreamer',
        'thinker', 'maker', 'builder', 'gardener', 'chef', 'reader',
        'writer', 'artist', 'musician', 'dancer', 'runner', 'hiker',
        'cyclist', 'swimmer', 'cook', 'baker', 'traveler', 'wanderer',
        'seeker', 'learner', 'teacher', 'helper', 'listener', 'speaker'
    ];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(1000 + Math.random() * 9000); // 4-digit number

    return `${adj}_${noun}_${num}`;
}

/**
 * Generate multiple username suggestions
 * @param {number} count - Number of suggestions to generate (default: 3)
 * @returns {Array<string>} Array of username suggestions
 */
export function generateUsernameSuggestions(count = 3) {
    const suggestions = new Set();

    // Generate unique suggestions
    while (suggestions.size < count) {
        suggestions.add(generateRandomUsername());
    }

    return Array.from(suggestions);
}

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username is required' };
    }

    const trimmed = username.trim();

    if (trimmed.length < 3) {
        return { valid: false, error: 'Username must be at least 3 characters' };
    }

    if (trimmed.length > 30) {
        return { valid: false, error: 'Username must be 30 characters or less' };
    }

    // Must be lowercase alphanumeric + underscores only
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
        return {
            valid: false,
            error: 'Username can only contain lowercase letters, numbers, and underscores'
        };
    }

    // Cannot start or end with underscore
    if (trimmed.startsWith('_') || trimmed.endsWith('_')) {
        return {
            valid: false,
            error: 'Username cannot start or end with an underscore'
        };
    }

    // Cannot have consecutive underscores
    if (trimmed.includes('__')) {
        return {
            valid: false,
            error: 'Username cannot contain consecutive underscores'
        };
    }

    return { valid: true, error: null };
}

/**
 * Check if username is available in the database
 * @param {string} username - Username to check
 * @param {Object} supabase - Supabase client instance
 * @param {string} currentUserId - Current user's ID (to exclude from check when editing)
 * @returns {Promise<Object>} { available: boolean, error: string|null }
 */
export async function checkUsernameAvailability(username, supabase, currentUserId = null) {
    if (!username || !supabase) {
        return { available: false, error: 'Invalid parameters' };
    }

    // First validate format
    const validation = validateUsername(username);
    if (!validation.valid) {
        return { available: false, error: validation.error };
    }

    try {
        const trimmed = username.trim().toLowerCase();

        // Query with case-insensitive match
        let query = supabase
            .from('public_profiles')
            .select('username, user_id')
            .ilike('username', trimmed)
            .limit(1);

        const { data, error } = await query;

        if (error) {
            console.error('Username availability check failed:', error);
            return { available: false, error: 'Failed to check username availability' };
        }

        // If no results, username is available
        if (!data || data.length === 0) {
            return { available: true, error: null };
        }

        // If editing own profile, exclude current user's username
        if (currentUserId && data[0].user_id === currentUserId) {
            return { available: true, error: null };
        }

        return { available: false, error: 'Username is already taken' };
    } catch (err) {
        console.error('Username availability check error:', err);
        return { available: false, error: 'An error occurred while checking availability' };
    }
}

/**
 * Sanitize username input (convert to lowercase, remove invalid chars)
 * @param {string} input - Raw username input
 * @returns {string} Sanitized username
 */
export function sanitizeUsernameInput(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '') // Remove invalid characters
        .replace(/_{2,}/g, '_')      // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '')     // Remove leading/trailing underscores
        .slice(0, 30);               // Enforce max length
}

/**
 * Format username for display (add @ prefix for display purposes)
 * @param {string} username - Username to format
 * @returns {string} Formatted username with @ prefix
 */
export function formatUsernameDisplay(username) {
    if (!username) return '';
    return `@${username}`;
}
