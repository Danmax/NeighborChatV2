import { writable, derived, get } from 'svelte/store';
import { currentUser } from './auth.js';

// Events state
export const events = writable([]);
export const eventsLoading = writable(false);
export const eventsError = writable(null);

// Event types
export const EVENT_TYPES = [
    { id: 'meetup', label: 'Casual Meetup', emoji: '☕', color: '#8D6E63' },
    { id: 'social', label: 'Social', emoji: '🥂', color: '#FFB74D' },
    { id: 'dev-meetup', label: 'Dev Meetup', emoji: '💻', color: '#5C6BC0' },
    { id: 'potluck', label: 'Potluck', emoji: '🍲', color: '#FF7043' },
    { id: 'secret-santa', label: 'Secret Santa', emoji: '🎅', color: '#EF5350' },
    { id: 'gift-exchange', label: 'Gift Exchange', emoji: '🎁', color: '#8E24AA' },
    { id: 'workshop', label: 'Workshop', emoji: '🛠️', color: '#26A69A' },
    { id: 'meeting', label: 'Meeting', emoji: '🗓️', color: '#78909C' },
    { id: 'other', label: 'Other', emoji: '📌', color: '#90A4AE' }
];

// Item categories for potluck events
export const ITEM_CATEGORIES = [
    { id: 'main', label: 'Main Dish', emoji: '🍖' },
    { id: 'side', label: 'Side Dish', emoji: '🥗' },
    { id: 'dessert', label: 'Dessert', emoji: '🍰' },
    { id: 'drinks', label: 'Drinks', emoji: '🍹' },
    { id: 'supplies', label: 'Supplies', emoji: '🍽️' },
    { id: 'other', label: 'Other', emoji: '📦' }
];

// RSVP status options
export const RSVP_STATUSES = [
    { id: 'going', label: 'Going', emoji: '✓', color: '#4CAF50' },
    { id: 'maybe', label: 'Maybe', emoji: '?', color: '#FF9800' },
    { id: 'not_going', label: 'Not Going', emoji: '✕', color: '#9E9E9E' }
];

// Event status options
export const EVENT_STATUSES = [
    { id: 'draft', label: 'Draft', color: '#9E9E9E' },
    { id: 'published', label: 'Published', color: '#4CAF50' },
    { id: 'closed', label: 'Closed', color: '#F44336' }
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
    const currentId = $currentUser.user_uuid || $currentUser.user_id;
    return $events.filter(e =>
        e.created_by === currentId ||
        e.attendees?.includes(currentId)
    );
});

// Derived: past events
export const pastEvents = derived(events, ($events) => {
    const now = new Date();
    return $events
        .filter(e => new Date(e.date) < now && e.status !== 'draft')
        .sort((a, b) => new Date(b.date) - new Date(a.date));
});

// Derived: draft events (visible only to organizers)
export const draftEvents = derived([events, currentUser], ([$events, $currentUser]) => {
    if (!$currentUser) return [];
    const currentId = $currentUser.user_uuid || $currentUser.user_id;
    return $events
        .filter(e => e.status === 'draft' && e.created_by === currentId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
});

// Derived: published events only (excludes drafts)
export const publishedEvents = derived(events, ($events) => {
    return $events
        .filter(e => e.status === 'published' || !e.status)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
});

// Derived: closed events
export const closedEvents = derived(events, ($events) => {
    return $events
        .filter(e => e.status === 'closed')
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
    const currentId = user.user_uuid || user.user_id;

    events.update(list =>
        list.map(e => {
            if (e.id === eventId && !e.attendees?.includes(currentId)) {
                return {
                    ...e,
                    attendees: [...(e.attendees || []), currentId]
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
    const currentId = user.user_uuid || user.user_id;

    events.update(list =>
        list.map(e => {
            if (e.id === eventId) {
                return {
                    ...e,
                    attendees: (e.attendees || []).filter(id => id !== currentId)
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

// Get item category info
export function getItemCategory(categoryId) {
    return ITEM_CATEGORIES.find(c => c.id === categoryId) || ITEM_CATEGORIES.find(c => c.id === 'other');
}

// Get RSVP status info
export function getRsvpStatus(statusId) {
    return RSVP_STATUSES.find(s => s.id === statusId) || RSVP_STATUSES[0];
}

// Get event status info
export function getEventStatus(statusId) {
    return EVENT_STATUSES.find(s => s.id === statusId) || EVENT_STATUSES.find(s => s.id === 'published');
}

// Get event settings with defaults
export function getEventSettings(event) {
    const defaults = {
        potluck_allow_new_items: true,
        potluck_allow_recipes: true,
        meetup_show_zoom_only_to_rsvp: true,
        meetup_allow_speaker_submissions: false
    };
    return { ...defaults, ...(event?.settings || {}) };
}

// Check if meeting link should be shown based on RSVP status
export function canShowMeetingLink(event, userRsvpStatus) {
    // No meeting link to show
    if (!event?.meeting_link) return false;

    const settings = getEventSettings(event);

    // If setting is disabled, show to everyone
    if (!settings.meetup_show_zoom_only_to_rsvp) return true;

    // Only show if user is going
    return userRsvpStatus === 'going';
}

// Calculate available slots for an item
export function calculateAvailableSlots(item) {
    const totalSlots = item?.slots || 1;
    const claims = item?.claims || [];
    const claimedQty = claims.reduce((sum, claim) => sum + (claim.quantity_claimed || 1), 0);
    return Math.max(0, totalSlots - claimedQty);
}

// Calculate total claimed quantity for an item
export function calculateClaimedQuantity(item) {
    const claims = item?.claims || [];
    return claims.reduce((sum, claim) => sum + (claim.quantity_claimed || 1), 0);
}

// Check if user has claimed an item
export function getUserClaim(item, userId) {
    if (!item?.claims || !userId) return null;
    return item.claims.find(claim => claim.user_id === userId);
}

// Group items by category
export function groupItemsByCategory(items) {
    const groups = {};
    ITEM_CATEGORIES.forEach(cat => {
        groups[cat.id] = [];
    });

    (items || []).forEach(item => {
        const category = item.category || 'other';
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(item);
    });

    return groups;
}

// Get capacity info for an event
export function getCapacityInfo(event) {
    if (!event?.capacity) {
        return { hasCapacity: false, spotsTotal: null, spotsTaken: 0, spotsRemaining: null, isFull: false };
    }

    const goingCount = (event.participantData || [])
        .filter(p => p.rsvp_status === 'going' && p.approval_status === 'approved')
        .reduce((sum, p) => sum + 1 + (p.guest_count || 0), 0);

    return {
        hasCapacity: true,
        spotsTotal: event.capacity,
        spotsTaken: goingCount,
        spotsRemaining: Math.max(0, event.capacity - goingCount),
        isFull: goingCount >= event.capacity
    };
}
