// Events service - Supabase operations for community events
import { getSupabase, getAuthUserId } from '../lib/supabase.js';
import { currentUser } from '../stores/auth.js';
import {
    setEvents,
    addEvent,
    updateEvent,
    removeEvent,
    eventsLoading,
    eventsError
} from '../stores/events.js';
import { events } from '../stores/events.js';
import { get } from 'svelte/store';

export async function getActiveMembershipId() {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) return null;

    const { data, error } = await supabase
        .from('instance_memberships')
        .select('id')
        .eq('user_id', authUserId)
        .eq('status', 'active')
        .limit(1)
        .single();

    if (error || !data?.id) {
        return null;
    }

    return data.id;
}

// Transform database row to app format
function transformEventFromDb(row) {
    const eventData = row.event_data || {};
    return {
        id: row.id,
        type: row.type,
        title: row.name, // DB uses 'name', app uses 'title'
        date: row.date,
        time: row.time || eventData.time,
        location: row.location || eventData.location,
        description: row.description,
        created_by: row.created_by_id,
        creator_name: row.created_by,
        creator_avatar: eventData.creator_avatar,
        cover_image_url: eventData.cover_image_url,
        attachments: eventData.attachments || [],
        items: eventData.items || [],
        attendees: row.participants || [],
        visibility: row.visibility || 'public',
        archived: row.archived || false,
        created_at: row.created_at,
        invited_user_ids: eventData.invited_user_ids || [],
        ...eventData
    };
}

// Transform app format to database row (authUserId must be the actual auth.uid())
function transformEventToDb(eventData, user, authUserId) {
    const extraData = {
        time: eventData.time,
        creator_avatar: user?.avatar,
        location: eventData.location,
        invited_user_ids: eventData.invited_user_ids || [],
        items: eventData.items || [],
        cover_image_url: eventData.cover_image_url || null,
        attachments: eventData.attachments || []
    };

    return {
        id: eventData.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: eventData.type || 'meetup',
        name: eventData.title, // App uses 'title', DB uses 'name'
        date: eventData.date,
        location: eventData.location || null,
        description: eventData.description || null,
        created_by: user?.name,
        created_by_id: authUserId, // Must be auth.uid() for RLS
        created_at: new Date().toISOString(),
        participants: [],
        visibility: eventData.visibility || 'public',
        archived: false,
        event_data: extraData
    };
}

/**
 * Fetch all events from Supabase
 */
export async function fetchEvents() {
    const supabase = getSupabase();
    eventsLoading.set(true);
    eventsError.set(null);

    try {
        const { data, error } = await supabase
            .from('community_events')
            .select('*')
            .order('date', { ascending: true });

        if (error) throw error;

        const events = (data || []).map(transformEventFromDb);
        const decorated = await attachParticipants(events);
        setEvents(decorated);
        return decorated;
    } catch (error) {
        if (error?.name === 'AbortError') {
            return [];
        }
        console.error('Failed to fetch events:', error);
        eventsError.set(error.message);
        return [];
    } finally {
        eventsLoading.set(false);
    }
}

/**
 * Upload a cover image to Supabase Storage and return public URL
 */
export async function uploadEventImage(file) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to upload images.');
    }

    const safeName = file.name.replace(/\s+/g, '_');
    const path = `${authUserId}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
        .from('event-images')
        .upload(path, file, { upsert: false });

    if (error) throw error;

    const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(path);

    return data.publicUrl;
}

/**
 * Fetch a single event by id
 */
export async function fetchEventById(eventId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('community_events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (error) throw error;

        const event = transformEventFromDb(data);
        updateEvent(eventId, event);
        return event;
    } catch (error) {
        console.error('Failed to fetch event:', error);
        throw error;
    }
}
/**
 * Create a new event
 * Note: RLS requires authenticated Supabase users (auth.uid() = created_by_id)
 */
export async function createEvent(eventData) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to create events');
    }

    // Check if user is actually authenticated via Supabase (not a guest)
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in with your email to create events. Guest users can only view content.');
    }

    const dbEvent = transformEventToDb(eventData, user, authUserId);

    try {
        const { data, error } = await supabase
            .from('community_events')
            .insert([dbEvent])
            .select()
            .single();

        if (error) {
            // Provide clearer error for RLS violations
            if (error.code === '42501' || error.message?.includes('policy')) {
                throw new Error('Permission denied. Please sign in with your email to create events.');
            }
            throw error;
        }

        const event = transformEventFromDb(data);
        addEvent(event);
        return event;
    } catch (error) {
        console.error('Failed to create event:', error);
        throw error;
    }
}

/**
 * Update an existing event
 */
export async function updateEventInDb(eventId, updates) {
    const supabase = getSupabase();
    const existing = get(events).find(event => event.id === eventId);

    // Transform updates to DB format
    const dbUpdates = {};
    if (updates.title !== undefined) dbUpdates.name = updates.title;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.attendees !== undefined) dbUpdates.participants = updates.attendees;
    if (updates.visibility !== undefined) dbUpdates.visibility = updates.visibility;
    if (updates.archived !== undefined) dbUpdates.archived = updates.archived;
    if (
        updates.time !== undefined ||
        updates.invited_user_ids !== undefined ||
        updates.items !== undefined ||
        updates.cover_image_url !== undefined ||
        updates.attachments !== undefined
    ) {
        dbUpdates.event_data = {
            time: updates.time !== undefined ? updates.time : existing?.time || null,
            creator_avatar: existing?.creator_avatar || null,
            location: updates.location !== undefined ? updates.location : existing?.location || null,
            invited_user_ids: updates.invited_user_ids !== undefined ? updates.invited_user_ids : (existing?.invited_user_ids || []),
            items: updates.items !== undefined ? updates.items : (existing?.items || []),
            cover_image_url: updates.cover_image_url !== undefined ? updates.cover_image_url : (existing?.cover_image_url || null),
            attachments: updates.attachments !== undefined ? updates.attachments : (existing?.attachments || [])
        };
    }

    try {
        const { data, error } = await supabase
            .from('community_events')
            .update(dbUpdates)
            .eq('id', eventId)
            .select()
            .single();

        if (error) throw error;

        const event = transformEventFromDb(data);
        updateEvent(eventId, event);
        return event;
    } catch (error) {
        console.error('Failed to update event:', error);
        throw error;
    }
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId) {
    const supabase = getSupabase();

    try {
        const { error } = await supabase
            .from('community_events')
            .delete()
            .eq('id', eventId);

        if (error) throw error;

        removeEvent(eventId);
        return true;
    } catch (error) {
        console.error('Failed to delete event:', error);
        throw error;
    }
}

/**
 * Add an item to a potluck event (owner only)
 */
export async function addEventItem(eventId, name) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to add items.');
    }

    const { data, error } = await supabase.rpc('add_event_item', {
        p_event_id: eventId,
        p_name: name
    });

    if (error) throw error;

    updateEvent(eventId, { items: data || [] });
    return data;
}

/**
 * Remove an item from a potluck event (owner only)
 */
export async function removeEventItem(eventId, itemId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to remove items.');
    }

    const { data, error } = await supabase.rpc('remove_event_item', {
        p_event_id: eventId,
        p_item_id: itemId
    });

    if (error) throw error;

    updateEvent(eventId, { items: data || [] });
    return data;
}

/**
 * Claim or unclaim an event item (toggle)
 */
export async function claimEventItem(eventId, itemId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to claim items.');
    }

    const { data, error } = await supabase.rpc('claim_event_item', {
        p_event_id: eventId,
        p_item_id: itemId
    });

    if (error) throw error;

    updateEvent(eventId, { items: data || [] });
    return data;
}

/**
 * Assign an event item to a contact (owner only)
 */
export async function assignEventItem(eventId, itemId, userId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to assign items.');
    }

    const { data, error } = await supabase.rpc('assign_event_item', {
        p_event_id: eventId,
        p_item_id: itemId,
        p_user_id: userId
    });

    if (error) throw error;

    updateEvent(eventId, { items: data || [] });
    return data;
}

/**
 * Send an event notification to attendees/contacts
 */
export async function sendEventNotification(eventId, message, userIds = null) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to send notifications.');
    }

    const { data, error } = await supabase.rpc('send_event_notification', {
        p_event_id: eventId,
        p_message: message,
        p_user_ids: userIds
    });

    if (error) throw error;

    return data;
}

/**
 * Subscribe to a single event changes
 */
export function subscribeToEvent(eventId, callback) {
    const supabase = getSupabase();
    const subscription = supabase
        .channel(`event-${eventId}`)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'community_events', filter: `id=eq.${eventId}` },
            (payload) => {
                if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                    const updated = transformEventFromDb(payload.new);
                    updateEvent(updated.id, updated);
                    callback?.(updated);
                } else if (payload.eventType === 'DELETE') {
                    removeEvent(payload.old.id);
                    callback?.(null);
                }
            }
        )
        .subscribe();

    return subscription;
}

/**
 * RSVP to an event
 * Note: Due to RLS, only event creators can update. RSVP may need separate table or function.
 */
/**
 * Join/leave an event (attendance tracking)
 */
export async function rsvpToEvent(eventId, attending = true) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to join events');
    }

    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in with your email to join events. Guest users can only view events.');
    }

    try {
        const { data, error } = await supabase.rpc('rsvp_event', {
            p_event_id: eventId,
            p_attending: attending
        });

        if (error) throw error;

        if (data) {
            const baseEvent = transformEventFromDb(data);
            const updated = await attachParticipants([baseEvent]);
            if (updated.length > 0) {
                updateEvent(eventId, updated[0]);
                return updated[0];
            }
            updateEvent(eventId, baseEvent);
            return baseEvent;
        }

        return null;
    } catch (error) {
        console.error('Failed to join event:', error);
        throw error;
    }
}

/**
 * Subscribe to event changes in real-time
 */
export function subscribeToEvents(callback) {
    const supabase = getSupabase();

    const subscription = supabase
        .channel('events-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'community_events' },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    addEvent(transformEventFromDb(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    updateEvent(payload.new.id, transformEventFromDb(payload.new));
                } else if (payload.eventType === 'DELETE') {
                    removeEvent(payload.old.id);
                }
                callback?.(payload);
            }
        )
        .subscribe();

    return subscription;
}

export async function fetchEventParticipants(eventId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('event_participants')
        .select('membership_id, status, role, registered_at')
        .eq('event_id', eventId);

    if (error) throw error;

    const participantIds = (data || []).map(row => row.membership_id);
    if (participantIds.length === 0) return [];

    const { data: memberships, error: membershipError } = await supabase
        .from('instance_memberships')
        .select('id, user_id, display_name, avatar')
        .in('id', participantIds);

    if (membershipError) throw membershipError;

    const profileMap = (memberships || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
    }, {});

    return (data || []).map(row => ({
        user_id: row.membership_id,
        status: row.status,
        role: row.role,
        registered_at: row.registered_at,
        profile: profileMap[row.membership_id]
    }));
}

async function attachParticipants(events, partial = false) {
    if (!events || events.length === 0) return [];
    const supabase = getSupabase();
    const membershipId = await getActiveMembershipId();
    if (!membershipId) return events;

    const eventIds = events.map(e => e.id).filter(Boolean);
    if (eventIds.length === 0) return events;

    try {
        const { data, error } = await supabase
            .from('event_participants')
            .select('event_id, membership_id')
            .in('event_id', eventIds);

        if (error) throw error;

        const attendeesByEvent = {};
        (data || []).forEach(row => {
            if (!attendeesByEvent[row.event_id]) {
                attendeesByEvent[row.event_id] = [];
            }
            attendeesByEvent[row.event_id].push(row.membership_id);
        });

        return events.map(event => {
            const attendees = attendeesByEvent[event.id] || event.attendees || [];
            const attendeeCount = attendees.length;
            const isAttending = attendees.includes(membershipId);

            if (partial) {
                return {
                    ...event,
                    attendees,
                    attendeeCount,
                    isAttending
                };
            }

            return {
                ...event,
                attendees,
                attendeeCount,
                isAttending
            };
        });
    } catch (error) {
        console.warn('Failed to attach participants:', error);
        return events;
    }
}
