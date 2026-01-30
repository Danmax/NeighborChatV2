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
import { get } from 'svelte/store';

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
        attendees: row.participants || [],
        visibility: row.visibility || 'public',
        archived: row.archived || false,
        created_at: row.created_at,
        ...eventData
    };
}

// Transform app format to database row (authUserId must be the actual auth.uid())
function transformEventToDb(eventData, user, authUserId) {
    const extraData = {
        time: eventData.time,
        creator_avatar: user?.avatar,
        location: eventData.location
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
        setEvents(events);
        return events;
    } catch (error) {
        console.error('Failed to fetch events:', error);
        eventsError.set(error.message);
        return [];
    } finally {
        eventsLoading.set(false);
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

    // Transform updates to DB format
    const dbUpdates = {};
    if (updates.title) dbUpdates.name = updates.title;
    if (updates.date) dbUpdates.date = updates.date;
    if (updates.description) dbUpdates.description = updates.description;
    if (updates.location) dbUpdates.location = updates.location;
    if (updates.attendees) dbUpdates.participants = updates.attendees;
    if (updates.visibility) dbUpdates.visibility = updates.visibility;
    if (updates.archived !== undefined) dbUpdates.archived = updates.archived;

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
 * RSVP to an event
 * Note: Due to RLS, only event creators can update. RSVP may need separate table or function.
 */
export async function rsvpToEvent(eventId, attending = true) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to RSVP');
    }

    // Check if user is authenticated
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in with your email to RSVP. Guest users can only view events.');
    }

    try {
        // First get current participants
        const { data: event, error: fetchError } = await supabase
            .from('community_events')
            .select('participants')
            .eq('id', eventId)
            .single();

        if (fetchError) throw fetchError;

        let participants = event.participants || [];

        if (attending) {
            if (!participants.includes(authUserId)) {
                participants = [...participants, authUserId];
            }
        } else {
            participants = participants.filter(id => id !== authUserId);
        }

        const { data, error } = await supabase
            .from('community_events')
            .update({ participants })
            .eq('id', eventId)
            .select()
            .single();

        if (error) {
            // RLS may prevent non-creators from updating, provide local fallback
            if (error.code === '42501' || error.message?.includes('policy')) {
                // Update local store only
                updateEvent(eventId, { attendees: participants });
                console.warn('RLS: RSVP saved locally only (consider adding separate RSVP table)');
                return { attendees: participants };
            }
            throw error;
        }

        const transformedEvent = transformEventFromDb(data);
        updateEvent(eventId, transformedEvent);
        return transformedEvent;
    } catch (error) {
        console.error('Failed to RSVP:', error);
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
