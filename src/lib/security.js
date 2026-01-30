// Security utilities - Rate limiting & validation

/**
 * Security Manager for rate limiting and input sanitization
 */
class SecurityManager {
    constructor() {
        this.rateLimiters = new Map();
    }

    /**
     * Check if action is within rate limits
     */
    checkRateLimit(action, maxAttempts = 10, windowMs = 60000) {
        const now = Date.now();
        const key = action;

        if (!this.rateLimiters.has(key)) {
            this.rateLimiters.set(key, { attempts: [], blocked: false, blockedUntil: null });
        }

        const limiter = this.rateLimiters.get(key);

        if (limiter.blocked && now < limiter.blockedUntil) {
            const remainingSec = Math.ceil((limiter.blockedUntil - now) / 1000);
            throw new Error(`Rate limit exceeded. Wait ${remainingSec} seconds.`);
        }

        limiter.attempts = limiter.attempts.filter(t => now - t < windowMs);

        if (limiter.attempts.length >= maxAttempts) {
            limiter.blocked = true;
            limiter.blockedUntil = now + windowMs;
            throw new Error(`Rate limit: Max ${maxAttempts} per ${windowMs / 1000}s.`);
        }

        limiter.attempts.push(now);
        limiter.blocked = false;
        return { allowed: true, remaining: maxAttempts - limiter.attempts.length };
    }

    /**
     * Sanitize HTML to prevent XSS
     */
    sanitizeHTML(html) {
        if (typeof document !== 'undefined') {
            const div = document.createElement('div');
            div.textContent = html;
            return div.innerHTML;
        }
        // SSR fallback - basic escaping
        return String(html)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Validate input against rules
     */
    validateInput(value, rules = {}) {
        const { minLength = 0, maxLength = 5000, required = false } = rules;

        if (required && (!value || value.trim().length === 0)) {
            throw new Error('This field is required');
        }

        if (!value && !required) return '';

        value = value.trim();

        if (value.length < minLength) {
            throw new Error(`Minimum ${minLength} characters required`);
        }
        if (value.length > maxLength) {
            throw new Error(`Maximum ${maxLength} characters allowed`);
        }

        return this.sanitizeHTML(value);
    }
}

export const securityManager = new SecurityManager();

/**
 * Input validation helpers
 */
export const InputValidator = {
    validateMessage: (text) => securityManager.validateInput(text, {
        minLength: 1,
        maxLength: 5000,
        required: true
    }),

    validateDisplayName: (name) => securityManager.validateInput(name, {
        minLength: 2,
        maxLength: 50,
        required: true
    }),

    validateEmail: (email) => {
        if (!email || !email.trim()) {
            throw new Error('Email is required');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            throw new Error('Please enter a valid email address');
        }
        return email.trim().toLowerCase();
    },

    sanitize: (text) => securityManager.sanitizeHTML(text)
};
