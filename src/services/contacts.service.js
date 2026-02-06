// Contacts service - Supabase operations for saved contacts
import { getSupabase, getAuthUserUuid } from '../lib/supabase.js';
import { currentUser } from '../stores/auth.js';
import {
    setContacts,
    addContact,
    updateContact,
    removeContact,
    contactsLoading,
    contactsError
} from '../stores/contacts.js';
import { get } from 'svelte/store';

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
}

async function resolveUserUuid(userId) {
    if (!userId) return null;
    if (isUuid(userId)) return userId;

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return data?.id || null;
}

// Transform database row to app format
function transformContactFromDb(row) {
    return {
        id: row.id,
        user_id: row.contact_user_id,
        name: row.contact_name,
        avatar: row.contact_avatar,
        interests: row.contact_interests || [],
        notes: row.notes,
        favorite: row.favorite || false,
        created_at: row.created_at
    };
}

// Generate a valid UUID v4
function generateUUID() {
    return crypto.randomUUID();
}

// Transform app format to database row
function transformContactToDb(contactData, ownerId) {
    return {
        id: contactData.id || generateUUID(),
        owner_id: ownerId,
        contact_user_id: contactData.user_id || null,
        contact_name: contactData.name,
        contact_avatar: contactData.avatar || {},
        contact_interests: contactData.interests || [],
        notes: contactData.notes || null
    };
}

/**
 * Fetch user's contacts from Supabase
 */
export async function fetchContacts() {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) return [];

    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('You must be signed in to view contacts.');
    }

    contactsLoading.set(true);
    contactsError.set(null);

    try {
        const { data, error } = await supabase
            .from('saved_contacts')
            .select('*')
            .eq('owner_id', authUserUuid)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const contacts = (data || []).map(transformContactFromDb);
        setContacts(contacts);
        return contacts;
    } catch (error) {
        if (error?.name === 'AbortError') {
            return [];
        }
        console.error('Failed to fetch contacts:', error);
        contactsError.set(error.message);
        return [];
    } finally {
        contactsLoading.set(false);
    }
}

/**
 * Add a new contact
 */
export async function saveContact(contactData) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to save contacts');
    }

    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('You must be signed in to save contacts.');
    }

    const resolvedContactUserId = await resolveUserUuid(contactData.user_id);
    const dbContact = transformContactToDb({ ...contactData, user_id: resolvedContactUserId }, authUserUuid);

    try {
        const { data, error } = await supabase
            .from('saved_contacts')
            .upsert(dbContact, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;

        const contact = transformContactFromDb(data);
        addContact(contact);
        return contact;
    } catch (error) {
        console.error('Failed to save contact:', error);
        throw error;
    }
}

/**
 * Update a contact
 */
export async function updateContactInDb(userId, updates) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) return;

    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('You must be signed in to update contacts.');
    }

    // Transform updates to DB format
    const dbUpdates = {};
    if (updates.name) dbUpdates.contact_name = updates.name;
    if (updates.avatar) dbUpdates.contact_avatar = updates.avatar;
    if (updates.interests) dbUpdates.contact_interests = updates.interests;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.favorite !== undefined) dbUpdates.favorite = updates.favorite;

    const resolvedUserId = await resolveUserUuid(userId);
    if (!resolvedUserId) {
        throw new Error('Contact user not found.');
    }

    try {
        const { data, error } = await supabase
            .from('saved_contacts')
            .update(dbUpdates)
            .eq('owner_id', authUserUuid)
            .eq('contact_user_id', resolvedUserId)
            .select()
            .single();

        if (error) throw error;

        const contact = transformContactFromDb(data);
        updateContact(userId, contact);
        return contact;
    } catch (error) {
        console.error('Failed to update contact:', error);
        throw error;
    }
}

/**
 * Remove a contact
 */
export async function deleteContact(userId) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) return;

    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('You must be signed in to remove contacts.');
    }

    const resolvedUserId = await resolveUserUuid(userId);
    if (!resolvedUserId) {
        throw new Error('Contact user not found.');
    }

    try {
        const { error } = await supabase
            .from('saved_contacts')
            .delete()
            .eq('owner_id', authUserUuid)
            .eq('contact_user_id', resolvedUserId);

        if (error) throw error;

        removeContact(userId);
        return true;
    } catch (error) {
        console.error('Failed to delete contact:', error);
        throw error;
    }
}

/**
 * Toggle favorite status
 */
export async function toggleFavoriteInDb(userId, currentFavorite) {
    return updateContactInDb(userId, { favorite: !currentFavorite });
}
