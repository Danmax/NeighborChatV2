// Phone number formatting utilities

/**
 * Format phone number for display
 * - If starts with +, preserve as-is (international format)
 * - 10 digits: Format as +1 (XXX) XXX-XXXX
 * - 11 digits starting with 1: Format as +1 (XXX) XXX-XXXX
 * - Other formats: Return as-is
 *
 * @param {string} input - Raw phone number input
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    const trimmed = input.trim();

    // If already starts with +, preserve international format
    if (trimmed.startsWith('+')) {
        return trimmed;
    }

    // Extract only digits
    const digits = trimmed.replace(/\D/g, '');

    // 10 digits: US format
    if (digits.length === 10) {
        return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // 11 digits starting with 1: US format
    if (digits.length === 11 && digits.startsWith('1')) {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    // Other lengths or formats: return original input
    return trimmed;
}

/**
 * Normalize phone number for database storage
 * Removes all formatting characters, keeps only digits and + prefix
 *
 * @param {string} formatted - Formatted phone number
 * @returns {string|null} Normalized phone number or null if empty
 */
export function normalizePhoneNumber(formatted) {
    if (!formatted || typeof formatted !== 'string') {
        return null;
    }

    const trimmed = formatted.trim();

    if (!trimmed) {
        return null;
    }

    // If starts with +, preserve it; otherwise remove all non-digits
    if (trimmed.startsWith('+')) {
        // Keep + and digits only
        const normalized = '+' + trimmed.slice(1).replace(/\D/g, '');
        return normalized.length > 1 ? normalized : null;
    }

    // Remove all non-digit characters
    const digits = trimmed.replace(/\D/g, '');

    // Return null if no digits remain
    return digits.length > 0 ? `+${digits}` : null;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { valid: true, error: null }; // Phone is optional
    }

    const trimmed = phone.trim();

    if (!trimmed) {
        return { valid: true, error: null };
    }

    // Extract digits
    const digits = trimmed.replace(/\D/g, '');

    // Must have at least 10 digits
    if (digits.length < 10) {
        return {
            valid: false,
            error: 'Phone number must have at least 10 digits'
        };
    }

    // Must not exceed 15 digits (international standard)
    if (digits.length > 15) {
        return {
            valid: false,
            error: 'Phone number is too long'
        };
    }

    return { valid: true, error: null };
}

/**
 * Format phone number as user types (real-time formatting)
 * This provides instant feedback in input fields
 *
 * @param {string} input - Current input value
 * @param {string} previousValue - Previous input value
 * @returns {Object} { formatted: string, cursorOffset: number }
 */
export function formatPhoneNumberAsTyping(input, previousValue = '') {
    if (!input) {
        return { formatted: '', cursorOffset: 0 };
    }

    // If starts with +, don't auto-format (international)
    if (input.trim().startsWith('+')) {
        return { formatted: input, cursorOffset: 0 };
    }

    // Extract digits
    const digits = input.replace(/\D/g, '');

    // No digits yet
    if (digits.length === 0) {
        return { formatted: '', cursorOffset: 0 };
    }

    // Format progressively as user types
    let formatted = '';
    let cursorOffset = 0;

    if (digits.length <= 3) {
        // Just area code: (XXX
        formatted = `(${digits}`;
    } else if (digits.length <= 6) {
        // Area code + exchange: (XXX) XXX
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length <= 10) {
        // Full US number: (XXX) XXX-XXXX
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else {
        // More than 10 digits: treat as international after country code
        formatted = `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    }

    // Calculate cursor offset (number of formatting chars added)
    const digitsInInput = input.replace(/\D/g, '').length;
    const digitsInFormatted = formatted.replace(/\D/g, '').length;

    if (digitsInInput === digitsInFormatted) {
        cursorOffset = formatted.length - input.length;
    }

    return { formatted, cursorOffset };
}

/**
 * Extract country code from phone number
 * @param {string} phone - Phone number
 * @returns {string|null} Country code (e.g., '+1') or null
 */
export function extractCountryCode(phone) {
    if (!phone || typeof phone !== 'string') {
        return null;
    }

    const trimmed = phone.trim();

    if (trimmed.startsWith('+')) {
        // Extract up to first 4 characters after +
        const match = trimmed.match(/^\+(\d{1,4})/);
        return match ? `+${match[1]}` : null;
    }

    // Check if starts with common country codes without +
    const digits = trimmed.replace(/\D/g, '');

    if (digits.length >= 11 && digits.startsWith('1')) {
        return '+1'; // US/Canada
    }

    return null;
}

/**
 * Check if phone number is US format
 * @param {string} phone - Phone number
 * @returns {boolean} True if US format
 */
export function isUSPhoneNumber(phone) {
    if (!phone) return false;

    const digits = phone.replace(/\D/g, '');

    // 10 digits or 11 digits starting with 1
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

/**
 * Format phone number for display in contacts/profile (clickable format)
 * @param {string} phone - Phone number
 * @returns {string} Formatted for tel: link
 */
export function formatPhoneForLink(phone) {
    if (!phone) return '';

    // Remove all non-digit and non-+ characters
    return phone.replace(/[^\d+]/g, '');
}
