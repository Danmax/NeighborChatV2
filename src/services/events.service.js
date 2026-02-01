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
        invited_user_ids: eventData.invited_user_ids || []
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
        if (attending) {
            const { error } = await supabase
                .from('event_participants')
                .insert([
                    {
                        event_id: eventId,
                        membership_id: authUserId,
                        status: 'registered',
                        role: 'attendee',
                        registered_at: new Date().toISOString()
                    }
                ]);

            if (error && error.code !== '23505') throw error; // ignore duplicate
        } else {
            const { error } = await supabase
                .from('event_participants')
                .delete()
                .eq('event_id', eventId)
                .eq('membership_id', authUserId);
            if (error) throw error;
        }

        const { data: refreshed, error: refreshError } = await supabase
            .from('community_events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (refreshError) throw refreshError;

        const baseEvent = transformEventFromDb(refreshed);
        const updated = await attachParticipants([baseEvent]);
        if (updated.length > 0) {
            updateEvent(eventId, updated[0]);
            return updated[0];
        }

        return baseEvent;
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

export async function fetchEventParticipants(eventId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('event_participants')
        .select('membership_id, status, role, registered_at')
        .eq('event_id', eventId);

    if (error) throw error;

    const participantIds = (data || []).map(row => row.membership_id);
    if (participantIds.length === 0) return [];

    const { data: profiles, error: profileError } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, avatar, username')
        .in('user_id', participantIds);

    if (profileError) throw profileError;

    const profileMap = (profiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
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
    const authUserId = await getAuthUserId();
    if (!authUserId) return events;

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
            const isAttending = attendees.includes(authUserId);

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
