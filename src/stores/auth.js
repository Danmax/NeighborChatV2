// Auth store - User authentication state
import { writable, derived } from 'svelte/store';
import { getCachedData, cacheData, removeCachedData, clearAllCachedData } from '../lib/utils/cache.js';
import { generateRandomAvatar } from '../lib/utils/avatar.js';

/**
 * Current user data
 * @type {import('svelte/store').Writable<Object|null>}
 */
export const currentUser = writable(getCachedData('currentUser', null));

/**
 * Supabase auth user (from session)
 * @type {import('svelte/store').Writable<Object|null>}
 */
export const authUser = writable(null);

/**
 * Whether user is authenticated
 * @type {import('svelte/store').Readable<boolean>}
 */
export const isAuthenticated = derived(currentUser, $currentUser => !!$currentUser);

/**
 * Whether user is a guest
 * @type {import('svelte/store').Readable<boolean>}
 */
export const isGuest = derived(currentUser, $currentUser => $currentUser?.isGuest === true);

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
 * Create a guest user
 */
export function createGuestUser() {
    const guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const user = {
        user_id: guestId,
        name: 'Guest ' + Math.floor(Math.random() * 1000),
        avatar: generateRandomAvatar(),
        isGuest: true,
        loginTime: Date.now()
    };

    currentUser.set(user);
    return user;
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
