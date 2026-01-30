import { writable } from 'svelte/store';

// Toast notifications store
export const toasts = writable([]);

let toastId = 0;

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type: 'info', 'success', 'error', 'warning'
 * @param {number} duration - Duration in ms (default 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    const id = ++toastId;

    toasts.update(t => [...t, { id, message, type, duration }]);

    if (duration > 0) {
        setTimeout(() => {
            dismissToast(id);
        }, duration);
    }

    return id;
}

/**
 * Dismiss a toast by ID
 */
export function dismissToast(id) {
    toasts.update(t => t.filter(toast => toast.id !== id));
}

/**
 * Clear all toasts
 */
export function clearToasts() {
    toasts.set([]);
}

// Convenience methods
export const toast = {
    info: (message, duration) => showToast(message, 'info', duration),
    success: (message, duration) => showToast(message, 'success', duration),
    error: (message, duration) => showToast(message, 'error', duration),
    warning: (message, duration) => showToast(message, 'warning', duration)
};
