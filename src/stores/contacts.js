import { writable, derived, get } from 'svelte/store';
import { currentUser } from './auth.js';

// Contacts state
export const contacts = writable([]);
export const savedContacts = contacts; // Alias for backward compatibility
export const contactsLoading = writable(false);
export const contactsError = writable(null);

// Derived: sorted contacts by name
export const sortedContacts = derived(contacts, ($contacts) =>
    [...$contacts].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
);

// Derived: favorite contacts
export const favoriteContacts = derived(contacts, ($contacts) =>
    $contacts.filter(c => c.favorite)
);

// Set contacts
export function setContacts(list) {
    contacts.set(list);
}

// Add a contact
export function addContact(contact) {
    contacts.update(list => {
        // Avoid duplicates
        if (list.some(c => c.user_id === contact.user_id)) return list;
        return [...list, contact];
    });
}

// Update a contact
export function updateContact(userId, updates) {
    contacts.update(list =>
        list.map(c => c.user_id === userId ? { ...c, ...updates } : c)
    );
}

// Remove a contact
export function removeContact(userId) {
    contacts.update(list => list.filter(c => c.user_id !== userId));
}

// Toggle favorite
export function toggleFavorite(userId) {
    contacts.update(list =>
        list.map(c => {
            if (c.user_id === userId) {
                return { ...c, favorite: !c.favorite };
            }
            return c;
        })
    );
}

// Check if user is a contact
export function isContact(userId) {
    return get(contacts).some(c => c.user_id === userId);
}
