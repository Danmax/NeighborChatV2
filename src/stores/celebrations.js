import { writable, derived, get } from 'svelte/store';
import { currentUser } from './auth.js';

// Celebrations state
export const celebrations = writable([]);
export const celebrationsLoading = writable(false);
export const celebrationsError = writable(null);

// Celebration categories
export const CELEBRATION_CATEGORIES = [
    { id: 'milestone', label: 'Milestone', emoji: '🏆' },
    { id: 'birthday', label: 'Birthday', emoji: '🎂' },
    { id: 'anniversary', label: 'Anniversary', emoji: '💍' },
    { id: 'achievement', label: 'Achievement', emoji: '⭐' },
    { id: 'kudos', label: 'Kudos', emoji: '👏' },
    { id: 'recognition', label: 'Recognition', emoji: '🎖️' },
    { id: 'welcome', label: 'Welcome', emoji: '👋' },
    { id: 'gratitude', label: 'Gratitude', emoji: '🙏' },
    { id: 'good-news', label: 'Good News', emoji: '📰' },
    { id: 'other', label: 'Other', emoji: '🎉' }
];

// Available reactions
export const REACTIONS = ['❤️', '🎉', '👏', '🙌', '💯', '🔥', '✨', '💪'];

// Set celebrations
export function setCelebrations(list) {
    celebrations.set(list);
}

// Add a celebration
export function addCelebration(celebration) {
    celebrations.update(list => [celebration, ...list]);
}

// Update a celebration
export function updateCelebration(celebrationId, updates) {
    celebrations.update(list =>
        list.map(c => c.id === celebrationId ? { ...c, ...updates } : c)
    );
}

// Remove a celebration
export function removeCelebration(celebrationId) {
    celebrations.update(list => list.filter(c => c.id !== celebrationId));
}

// Add reaction to a celebration
export function addReaction(celebrationId, emoji) {
    const user = get(currentUser);
    if (!user) return;

    celebrations.update(list =>
        list.map(c => {
            if (c.id === celebrationId) {
                const reactions = { ...(c.reactions || {}) };
                if (!reactions[emoji]) {
                    reactions[emoji] = [];
                }
                if (!reactions[emoji].includes(user.user_id)) {
                    reactions[emoji] = [...reactions[emoji], user.user_id];
                }
                return { ...c, reactions };
            }
            return c;
        })
    );
}

// Remove reaction from a celebration
export function removeReaction(celebrationId, emoji) {
    const user = get(currentUser);
    if (!user) return;

    celebrations.update(list =>
        list.map(c => {
            if (c.id === celebrationId) {
                const reactions = { ...(c.reactions || {}) };
                if (reactions[emoji]) {
                    reactions[emoji] = reactions[emoji].filter(id => id !== user.user_id);
                    if (reactions[emoji].length === 0) {
                        delete reactions[emoji];
                    }
                }
                return { ...c, reactions };
            }
            return c;
        })
    );
}

// Add comment to a celebration
export function addComment(celebrationId, comment) {
    celebrations.update(list =>
        list.map(c => {
            if (c.id === celebrationId) {
                const comments = [...(c.comments || []), comment];
                return { ...c, comments };
            }
            return c;
        })
    );
}

// Get category info
export function getCelebrationCategory(categoryId) {
    return CELEBRATION_CATEGORIES.find(c => c.id === categoryId) ||
        CELEBRATION_CATEGORIES.find(c => c.id === 'other');
}
