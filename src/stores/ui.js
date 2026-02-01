// UI store - Loading states, modals, and UI flags
import { writable, derived } from 'svelte/store';

/**
 * Global loading state
 * @type {import('svelte/store').Writable<boolean>}
 */
export const isLoading = writable(true);

/**
 * Loading message
 * @type {import('svelte/store').Writable<string>}
 */
export const loadingMessage = writable('Loading...');

/**
 * Connection status
 * @type {import('svelte/store').Writable<'connected'|'disconnected'|'connecting'>}
 */
export const connectionStatus = writable('connecting');

/**
 * Toast notifications queue
 * @type {import('svelte/store').Writable<Array<{id: string, message: string, type: string}>>}
 */
export const toasts = writable([]);

/**
 * Modal state
 * @type {import('svelte/store').Writable<{type: string|null, data: any}>}
 */
export const modal = writable({ type: null, data: null });

/**
 * Top user menu visibility
 * @type {import('svelte/store').Writable<boolean>}
 */
export const showTopMenu = writable(false);

/**
 * Whether initial auth check has completed
 * @type {import('svelte/store').Writable<boolean>}
 */
export const authInitialized = writable(false);

/**
 * Set loading state
 */
export function setLoading(loading, message = 'Loading...') {
    isLoading.set(loading);
    loadingMessage.set(message);
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
    const id = Date.now().toString();
    toasts.update(t => [...t, { id, message, type }]);

    // Auto-remove after duration
    setTimeout(() => {
        toasts.update(t => t.filter(toast => toast.id !== id));
    }, duration);
}

/**
 * Show connection status message
 */
export function showConnectionStatus(message, status = 'connected') {
    connectionStatus.set(status);
    showToast(message, status === 'connected' ? 'success' : 'error');
}

/**
 * Open a modal
 */
export function openModal(type, data = null) {
    modal.set({ type, data });
}

/**
 * Close the current modal
 */
export function closeModal() {
    modal.set({ type: null, data: null });
}

/**
 * Is any modal open
 * @type {import('svelte/store').Readable<boolean>}
 */
export const isModalOpen = derived(modal, $modal => $modal.type !== null);
