import { writable } from 'svelte/store';

export const defaultStatusOptions = [
    { id: 'available', label: 'Online', color: '#4CAF50', sort_order: 1, active: true },
    { id: 'away', label: 'Away', color: '#FFC107', sort_order: 2, active: true },
    { id: 'busy', label: 'Busy', color: '#F44336', sort_order: 3, active: true },
    { id: 'meeting', label: 'In Meeting', color: '#9C27B0', sort_order: 4, active: true },
    { id: 'offline', label: 'Offline', color: '#9E9E9E', sort_order: 5, active: true }
];

export const defaultInterestOptions = [
    { id: 'reading', emoji: '📚', label: 'Reading', sort_order: 1, active: true },
    { id: 'cooking', emoji: '👨‍🍳', label: 'Cooking', sort_order: 2, active: true },
    { id: 'gardening', emoji: '🌱', label: 'Gardening', sort_order: 3, active: true },
    { id: 'fitness', emoji: '🏃', label: 'Fitness', sort_order: 4, active: true },
    { id: 'gaming', emoji: '🎮', label: 'Gaming', sort_order: 5, active: true },
    { id: 'music', emoji: '🎵', label: 'Music', sort_order: 6, active: true },
    { id: 'movies', emoji: '🎬', label: 'Movies', sort_order: 7, active: true },
    { id: 'travel', emoji: '✈️', label: 'Travel', sort_order: 8, active: true },
    { id: 'pets', emoji: '🐕', label: 'Pets', sort_order: 9, active: true },
    { id: 'art', emoji: '🎨', label: 'Art', sort_order: 10, active: true },
    { id: 'tech', emoji: '💻', label: 'Technology', sort_order: 11, active: true },
    { id: 'sports', emoji: '⚽', label: 'Sports', sort_order: 12, active: true },
    { id: 'yoga', emoji: '🧘', label: 'Yoga', sort_order: 13, active: true },
    { id: 'photography', emoji: '📷', label: 'Photography', sort_order: 14, active: true },
    { id: 'hiking', emoji: '🥾', label: 'Hiking', sort_order: 15, active: true },
    { id: 'coffee', emoji: '☕', label: 'Coffee', sort_order: 16, active: true }
];

export const statusOptions = writable(defaultStatusOptions);
export const interestOptions = writable(defaultInterestOptions);
