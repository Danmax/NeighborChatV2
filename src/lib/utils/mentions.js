// Mentions utility functions for chat

/**
 * Extract all @mentions from a message
 * @param {string} message - The message text
 * @returns {string[]} - Array of mentioned usernames (without @)
 */
export function extractMentions(message) {
    if (!message || typeof message !== 'string') return [];

    // Match @username patterns (alphanumeric, underscores, hyphens)
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const matches = [];
    let match;

    while ((match = mentionRegex.exec(message)) !== null) {
        const username = match[1].toLowerCase();
        if (!matches.includes(username)) {
            matches.push(username);
        }
    }

    return matches;
}

/**
 * Check if a specific user is mentioned in a message
 * @param {string} message - The message text
 * @param {string} username - The username to check for
 * @returns {boolean}
 */
export function isMentioned(message, username) {
    if (!message || !username) return false;

    const mentions = extractMentions(message);
    return mentions.includes(username.toLowerCase());
}

/**
 * Highlight @mentions in a message with HTML
 * @param {string} message - The message text
 * @returns {string} - Message with highlighted mentions as HTML
 */
export function highlightMentions(message) {
    if (!message || typeof message !== 'string') return message || '';

    // Replace @username with highlighted span
    return message.replace(
        /@([a-zA-Z0-9_-]+)/g,
        '<span class="mention">@$1</span>'
    );
}

/**
 * Check if current user is mentioned in message
 * @param {string} message - The message text
 * @param {Object} currentUser - Current user object with username/name
 * @returns {boolean}
 */
export function isCurrentUserMentioned(message, currentUser) {
    if (!message || !currentUser) return false;

    const mentions = extractMentions(message);

    const username = currentUser.username?.toLowerCase();

    return mentions.some(mention => mention === username);
}
