/**
 * Convert a stored date/datetime to YYYY-MM-DD format for HTML date input.
 * If the value is already in YYYY-MM-DD format, return as-is.
 * Otherwise, parse and extract the local date components.
 */
export function toDateInputValue(value) {
    if (!value) return '';

    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    // Otherwise parse the datetime string
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    // Use LOCAL date components, not UTC
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Keep old function for backward compatibility, but deprecate it
export function toDateInputUtc(value) {
    return toDateInputValue(value);
}

/**
 * Normalize a date value for storage. If it's a date-only string (YYYY-MM-DD),
 * keep it as-is. This avoids timezone conversion issues.
 */
export function normalizeDateToUtc(value) {
    if (!value) return '';
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }
    return toDateInputValue(value) || '';
}
