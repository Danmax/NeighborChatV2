// Auth store - User authentication state
import { writable, derived } from 'svelte/store';
import { getCachedData, cacheData, removeCachedData, clearAllCachedData } from '../lib/utils/cache.js';

/**
 * Current user data
 * @type {import('svelte/store').Writable<Object|null>}
 */
export const currentUser = writable(getCachedData('currentUser', null));

/**
 * Clerk auth user (raw Clerk user object)
 * @type {import('svelte/store').Writable<Object|null>}
 */
export const authUser = writable(null);

/**
 * Whether user is authenticated
 * @type {import('svelte/store').Readable<boolean>}
 */
export const isAuthenticated = derived(currentUser, $currentUser => !!$currentUser);

/**
 * Whether auth initialization is in progress
 * @type {import('svelte/store').Writable<boolean>}
 */
export const authLoading = writable(true);

// Sync currentUser to localStorage
currentUser.subscribe(value => {
    if (value) {
        cacheData('currentUser', value);
        cacheData('isAuthenticated', true);
    }
});

/**
 * Set the current user
 */
export function setCurrentUser(userData) {
    currentUser.set(userData);
}

/**
 * Update current user data
 */
export function updateCurrentUser(updates) {
    currentUser.update(user => {
        if (!user) return user;
        return { ...user, ...updates };
    });
}

/**
 * Clear authentication state
 */
export function clearAuth() {
    currentUser.set(null);
    authUser.set(null);
    removeCachedData('currentUser');
    removeCachedData('isAuthenticated');
}

/**
 * Full sign out - clears all data
 */
export function signOut() {
    clearAuth();
    clearAllCachedData();
}
