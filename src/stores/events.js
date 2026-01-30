import { writable, derived, get } from 'svelte/store';
import { currentUser } from './auth.js';

// Events state
export const events = writable([]);
export const eventsLoading = writable(false);
export const eventsError = writable(null);

// Event types
export const EVENT_TYPES = [
    { id: 'meetup', label: 'Casual Meetup', emoji: '☕', color: '#8D6E63' },
    { id: 'potluck', label: 'Potluck', emoji: '🍲', color: '#FF7043' },
    { id: 'workshop', label: 'Workshop', emoji: '🛠️', color: '#5C6BC0' },
    { id: 'game-night', label: 'Game Night', emoji: '🎮', color: '#66BB6A' },
    { id: 'book-club', label: 'Book Club', emoji: '📚', color: '#AB47BC' },
    { id: 'fitness', label: 'Fitness', emoji: '🏃', color: '#26A69A' },
    { id: 'secret-santa', label: 'Secret Santa', emoji: '🎅', color: '#EF5350' },
    { id: 'other', label: 'Other', emoji: '📅', color: '#78909C' }
];

// Derived: upcoming events (future dates, sorted)
export const upcomingEvents = derived(events, ($events) => {
    const now = new Date();
    return $events
        .filter(e => new Date(e.date) >= now)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
});

// Derived: my events (created by or attending)
export const myEvents = derived([events, currentUser], ([$events, $currentUser]) => {
    if (!$currentUser) return [];
    return $events.filter(e =>
        e.created_by === $currentUser.user_id ||
        e.attendees?.includes($currentUser.user_id)
    );
});

// Derived: past events
export const pastEvents = derived(events, ($events) => {
    const now = new Date();
    return $events
        .filter(e => new Date(e.date) < now)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
});

// Set events
export function setEvents(eventsList) {
    events.set(eventsList);
}

// Add a new event
export function addEvent(event) {
    events.update(list => [...list, event]);
}

// Update an event
export function updateEvent(eventId, updates) {
    events.update(list =>
        list.map(e => e.id === eventId ? { ...e, ...updates } : e)
    );
}

// Remove an event
export function removeEvent(eventId) {
    events.update(list => list.filter(e => e.id !== eventId));
}

// Join an event
export function joinEvent(eventId) {
    const user = get(currentUser);
    if (!user) return;

    events.update(list =>
        list.map(e => {
            if (e.id === eventId && !e.attendees?.includes(user.user_id)) {
                return {
                    ...e,
                    attendees: [...(e.attendees || []), user.user_id]
                };
            }
            return e;
        })
    );
}

// Leave an event
export function leaveEvent(eventId) {
    const user = get(currentUser);
    if (!user) return;

    events.update(list =>
        list.map(e => {
            if (e.id === eventId) {
                return {
                    ...e,
                    attendees: (e.attendees || []).filter(id => id !== user.user_id)
                };
            }
            return e;
        })
    );
}

// Get event type info
export function getEventType(typeId) {
    return EVENT_TYPES.find(t => t.id === typeId) || EVENT_TYPES.find(t => t.id === 'other');
}
