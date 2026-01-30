// Time formatting utilities

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getTimeAgo(timestamp) {
    const now = Date.now();
    const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    const diff = now - time;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) {
        return 'just now';
    } else if (minutes < 60) {
        return `${minutes}m ago`;
    } else if (hours < 24) {
        return `${hours}h ago`;
    } else if (days < 7) {
        return `${days}d ago`;
    } else if (weeks < 4) {
        return `${weeks}w ago`;
    } else if (months < 12) {
        return `${months}mo ago`;
    } else {
        return `${years}y ago`;
    }
}

/**
 * Format date for display
 */
export function formatDate(date, options = {}) {
    const d = typeof date === 'string' ? new Date(date) : date;

    const defaultOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...options
    };

    return d.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format time for display
 */
export function formatTime(date) {
    const d = typeof date === 'string' ? new Date(date) : date;

    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Format datetime for display
 */
export function formatDateTime(date) {
    return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Get message timestamp (shows time for today, date for older)
 */
export function getMessageTime(timestamp) {
    const date = typeof timestamp === 'number'
        ? new Date(timestamp)
        : new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return formatTime(date);
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) {
        return `Yesterday ${formatTime(date)}`;
    }

    return formatDateTime(date);
}
