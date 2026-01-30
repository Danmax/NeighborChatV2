// Presence store - Online users and availability
import { writable, derived } from 'svelte/store';
import { currentUser } from './auth.js';
import { get } from 'svelte/store';

/**
 * Online users map { [userId]: userData }
 * @type {import('svelte/store').Writable<Object>}
 */
export const onlineUsers = writable({});

/**
 * Current user's availability status
 * @type {import('svelte/store').Writable<string>}
 */
export const userStatus = writable('offline'); // 'available', 'away', 'busy', 'offline'

/**
 * Whether user is available for chat
 * @type {import('svelte/store').Readable<boolean>}
 */
export const isAvailable = derived(userStatus, $status => $status === 'available');

/**
 * Count of online users
 * @type {import('svelte/store').Readable<number>}
 */
export const onlineCount = derived(onlineUsers, $users => Object.keys($users).length);

/**
 * List of online users (excluding current user)
 * @type {import('svelte/store').Readable<Array>}
 */
export const onlineUsersList = derived(
    [onlineUsers, currentUser],
    ([$users, $currentUser]) => {
        return Object.values($users).filter(user =>
            user.user_id !== $currentUser?.user_id
        );
    }
);

/**
 * Available users (online and available for chat)
 * @type {import('svelte/store').Readable<Array>}
 */
export const availableUsers = derived(
    onlineUsersList,
    $users => $users.filter(user => user.status === 'available')
);

/**
 * Set online users from presence state
 */
export function setOnlineUsers(users) {
    onlineUsers.set(users);
}

/**
 * Add or update a single online user
 */
export function updateOnlineUser(userId, userData) {
    onlineUsers.update(users => ({
        ...users,
        [userId]: userData
    }));
}

/**
 * Remove a user from online list
 */
export function removeOnlineUser(userId) {
    onlineUsers.update(users => {
        const { [userId]: removed, ...rest } = users;
        return rest;
    });
}

/**
 * Set user status
 */
export function setUserStatus(status) {
    userStatus.set(status);
}

/**
 * Clear all presence data
 */
export function clearPresence() {
    onlineUsers.set({});
    userStatus.set('offline');
}
