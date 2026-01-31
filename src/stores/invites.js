// Invites store - Track sent chat invites and their status
import { writable, derived } from 'svelte/store';

/**
 * Sent invites map
 * Structure: { [userId]: { status: 'pending' | 'accepted' | 'declined' | 'expired', timestamp: number, timeoutId: number } }
 * @type {import('svelte/store').Writable<Object>}
 */
export const sentInvites = writable({});

/**
 * Count of pending invites
 * @type {import('svelte/store').Readable<number>}
 */
export const pendingInvitesCount = derived(
    sentInvites,
    $invites => Object.values($invites).filter(inv => inv.status === 'pending').length
);

/**
 * Track a new sent invite
 * @param {string} userId - The user ID the invite was sent to
 * @param {number} timeoutId - The setTimeout ID for expiration
 */
export function trackSentInvite(userId, timeoutId) {
    sentInvites.update(invites => ({
        ...invites,
        [userId]: {
            status: 'pending',
            timestamp: Date.now(),
            timeoutId
        }
    }));
}

/**
 * Update invite status and clear timeout
 * @param {string} userId - The user ID
 * @param {string} status - New status ('accepted', 'declined', 'expired')
 */
export function updateInviteStatus(userId, status) {
    sentInvites.update(invites => {
        const invite = invites[userId];

        // Clear timeout if it exists
        if (invite?.timeoutId) {
            clearTimeout(invite.timeoutId);
        }

        // Remove the invite after status update
        const { [userId]: removed, ...rest } = invites;
        return rest;
    });
}

/**
 * Check if an invite is already pending for a user
 * @param {string} userId - The user ID to check
 * @returns {boolean} True if invite is pending
 */
export function hasInvitePending(userId) {
    const invites = get(sentInvites);
    return invites[userId]?.status === 'pending';
}

/**
 * Clear all invites
 */
export function clearAllInvites() {
    sentInvites.update(invites => {
        // Clear all timeouts
        Object.values(invites).forEach(invite => {
            if (invite.timeoutId) {
                clearTimeout(invite.timeoutId);
            }
        });
        return {};
    });
}

/**
 * Get invite for a specific user
 * @param {string} userId - The user ID
 * @returns {Object|null} The invite object or null
 */
export function getInvite(userId) {
    const invites = get(sentInvites);
    return invites[userId] || null;
}

// Import get for helper functions
import { get } from 'svelte/store';
