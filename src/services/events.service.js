// Events service - Supabase operations for community events
import { getSupabase, getAuthUserId, getAuthUserUuid } from '../lib/supabase.js';
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
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) return null;

    const { data, error } = await supabase
        .from('instance_memberships')
        .select('id')
        .eq('user_id', authUserUuid)
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

    // Transform items to handle both old and new format (claims array)
    const items = (eventData.items || []).map(item => {
        // If item has old format (claimed_by instead of claims), convert
        if (item.claimed_by && !item.claims) {
            return {
                ...item,
                claims: item.claimed_by ? [{
                    id: `claim_legacy_${item.id}`,
                    user_id: item.claimed_by,
                    user_name: item.claimed_by_name || 'User',
                    quantity_claimed: 1,
                    status: 'claimed'
                }] : [],
                slots: item.slots || 1,
                needed_qty: item.needed_qty || 1,
                category: item.category || 'other',
                allow_recipe: item.allow_recipe !== false
            };
        }
        return {
            ...item,
            claims: item.claims || [],
            slots: item.slots || 1,
            needed_qty: item.needed_qty || 1,
            category: item.category || 'other',
            allow_recipe: item.allow_recipe !== false
        };
    });

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
        items,
        attendees: row.participants || [],
        visibility: row.visibility || 'public',
        archived: row.archived || false,
        created_at: row.created_at,
        invited_user_ids: eventData.invited_user_ids || [],
        // New fields
        status: row.status || 'published',
        capacity: row.capacity || null,
        join_policy: row.join_policy || 'open',
        meeting_link: row.meeting_link || null,
        settings: row.settings || {},
        speaker_invites: eventData.speaker_invites || [],
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
        attachments: eventData.attachments || [],
        speaker_invites: eventData.speaker_invites || []
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
        event_data: extraData,
        // New fields
        status: eventData.status || 'published',
        capacity: eventData.capacity || null,
        join_policy: eventData.join_policy || 'open',
        meeting_link: eventData.meeting_link || null,
        settings: eventData.settings || {}
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
    if (!file || !file.type?.startsWith('image/')) {
        throw new Error('Please upload a valid image file.');
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be 5MB or smaller.');
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
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;
    if (updates.join_policy !== undefined) dbUpdates.join_policy = updates.join_policy;
    if (updates.meeting_link !== undefined) dbUpdates.meeting_link = updates.meeting_link;
    if (updates.settings !== undefined) dbUpdates.settings = updates.settings;
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

    const userIds = (memberships || []).map(row => row.user_id).filter(Boolean);
    const { data: publicProfiles, error: profileError } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, username, avatar')
        .in('user_id', userIds);

    if (profileError) throw profileError;

    const publicProfileMap = (publicProfiles || []).reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
    }, {});

    const membershipMap = (memberships || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
    }, {});

    return (data || []).map(row => ({
        user_id: row.membership_id,
        status: row.status,
        role: row.role,
        registered_at: row.registered_at,
        profile: (() => {
            const membership = membershipMap[row.membership_id];
            const publicProfile = membership?.user_id ? publicProfileMap[membership.user_id] : null;
            if (publicProfile) {
                return {
                    ...publicProfile,
                    display_name: publicProfile.username || publicProfile.display_name
                };
            }
            return membership;
        })()
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
            .select('event_id, membership_id, rsvp_status, guest_count, checked_in, approval_status')
            .in('event_id', eventIds);

        if (error) throw error;

        const attendeesByEvent = {};
        const participantDataByEvent = {};
        (data || []).forEach(row => {
            if (!attendeesByEvent[row.event_id]) {
                attendeesByEvent[row.event_id] = [];
                participantDataByEvent[row.event_id] = [];
            }
            attendeesByEvent[row.event_id].push(row.membership_id);
            participantDataByEvent[row.event_id].push({
                membership_id: row.membership_id,
                rsvp_status: row.rsvp_status || 'going',
                guest_count: row.guest_count || 0,
                checked_in: row.checked_in || false,
                approval_status: row.approval_status || 'approved'
            });
        });

        return events.map(event => {
            const attendees = attendeesByEvent[event.id] || event.attendees || [];
            const participantData = participantDataByEvent[event.id] || [];
            const attendeeCount = attendees.length;
            const isAttending = attendees.includes(membershipId);
            const myParticipation = participantData.find(p => p.membership_id === membershipId);

            if (partial) {
                return {
                    ...event,
                    attendees,
                    attendeeCount,
                    isAttending,
                    myRsvpStatus: myParticipation?.rsvp_status || null,
                    participantData
                };
            }

            return {
                ...event,
                attendees,
                attendeeCount,
                isAttending,
                myRsvpStatus: myParticipation?.rsvp_status || null,
                participantData
            };
        });
    } catch (error) {
        console.warn('Failed to attach participants:', error);
        return events;
    }
}

// ============================================
// ENHANCED RSVP FUNCTIONS
// ============================================

/**
 * Enhanced RSVP with status, guest count, and notes
 */
export async function rsvpToEventV2(eventId, { rsvpStatus = 'going', guestCount = 0, notes = null } = {}) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to RSVP.');
    }

    const { data, error } = await supabase.rpc('rsvp_event_v2', {
        p_event_id: eventId,
        p_rsvp_status: rsvpStatus,
        p_guest_count: guestCount,
        p_notes: notes
    });

    if (error) throw error;

    // Refresh the event data
    await fetchEventById(eventId);
    return data;
}

/**
 * Approve a pending RSVP (organizer only)
 */
export async function approveRsvp(eventId, participantId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('approve_rsvp', {
        p_event_id: eventId,
        p_membership_id: participantId
    });

    if (error) throw error;
    return data;
}

/**
 * Reject a pending RSVP (organizer only)
 */
export async function rejectRsvp(eventId, participantId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('reject_rsvp', {
        p_event_id: eventId,
        p_membership_id: participantId
    });

    if (error) throw error;
    return data;
}

/**
 * Check in a participant (organizer only)
 */
export async function checkInParticipant(eventId, participantId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('check_in_participant', {
        p_event_id: eventId,
        p_membership_id: participantId
    });

    if (error) throw error;
    return data;
}

// ============================================
// EVENT STATUS FUNCTIONS
// ============================================

/**
 * Update event status (draft/published/closed)
 */
export async function updateEventStatus(eventId, status) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('update_event_status', {
        p_event_id: eventId,
        p_status: status
    });

    if (error) throw error;

    updateEvent(eventId, { status });
    return data;
}

/**
 * Close an event
 */
export async function closeEvent(eventId) {
    return updateEventStatus(eventId, 'closed');
}

/**
 * Publish a draft event
 */
export async function publishEvent(eventId) {
    return updateEventStatus(eventId, 'published');
}

/**
 * Update event settings
 */
export async function updateEventSettings(eventId, settings) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('update_event_settings', {
        p_event_id: eventId,
        p_settings: settings
    });

    if (error) throw error;

    // Refresh the event
    await fetchEventById(eventId);
    return data;
}

// ============================================
// ENHANCED POTLUCK ITEM FUNCTIONS
// ============================================

/**
 * Add an item with enhanced fields (category, slots, recipes)
 */
export async function addEventItemV2(eventId, { name, category = 'other', neededQty = 1, slots = 1, allowRecipe = true }) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to add items.');
    }

    const { data, error } = await supabase.rpc('add_event_item_v2', {
        p_event_id: eventId,
        p_name: name,
        p_category: category,
        p_needed_qty: neededQty,
        p_slots: slots,
        p_allow_recipe: allowRecipe
    });

    if (error) throw error;

    // Refresh the event to get updated items
    await fetchEventById(eventId);
    return data;
}

/**
 * Claim an item with quantity support
 */
export async function claimEventItemV2(eventId, itemId, quantity = 1) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to claim items.');
    }

    const { data, error } = await supabase.rpc('claim_event_item_v2', {
        p_event_id: eventId,
        p_item_id: itemId,
        p_quantity: quantity
    });

    if (error) throw error;

    // Refresh the event
    await fetchEventById(eventId);
    return data;
}

/**
 * Remove a claim from an item
 */
export async function unclaimEventItem(eventId, itemId, claimId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('unclaim_event_item', {
        p_event_id: eventId,
        p_item_id: itemId,
        p_claim_id: claimId
    });

    if (error) throw error;

    // Refresh the event
    await fetchEventById(eventId);
    return data;
}

/**
 * Mark a claim as fulfilled
 */
export async function fulfillClaim(eventId, itemId, claimId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('fulfill_claim', {
        p_event_id: eventId,
        p_item_id: itemId,
        p_claim_id: claimId
    });

    if (error) throw error;

    // Refresh the event
    await fetchEventById(eventId);
    return data;
}

/**
 * Attach a recipe to an item
 */
export async function attachRecipeToItem(eventId, itemId, recipeId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('attach_recipe_to_item', {
        p_event_id: eventId,
        p_item_id: itemId,
        p_recipe_id: recipeId
    });

    if (error) throw error;

    // Refresh the event
    await fetchEventById(eventId);
    return data;
}

// ============================================
// SPEAKER FUNCTIONS
// ============================================

/**
 * Invite a speaker to an event
 */
export async function inviteSpeaker(eventId, speakerId, { talkTitle, talkAbstract = null, durationMinutes = 30 }) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('invite_speaker', {
        p_event_id: eventId,
        p_speaker_id: speakerId,
        p_talk_title: talkTitle,
        p_talk_abstract: talkAbstract,
        p_duration_minutes: durationMinutes
    });

    if (error) throw error;

    // Refresh the event
    await fetchEventById(eventId);
    return data;
}

/**
 * Invite a speaker by email (creates a private speaker profile)
 */
export async function inviteSpeakerByEmail(eventId, { email, name, talkTitle, talkAbstract = null, durationMinutes = 30 }) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('invite_speaker_by_email', {
        p_event_id: eventId,
        p_email: email,
        p_name: name,
        p_talk_title: talkTitle,
        p_talk_abstract: talkAbstract,
        p_duration_minutes: durationMinutes
    });

    if (error) throw error;

    await fetchEventById(eventId);
    return data;
}

/**
 * Update a speaker invite status (accept/decline)
 */
export async function updateSpeakerInvite(eventId, inviteId, status) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const { data, error } = await supabase.rpc('update_speaker_invite_status', {
        p_event_id: eventId,
        p_invite_id: inviteId,
        p_status: status
    });

    if (error) throw error;

    // Refresh the event
    await fetchEventById(eventId);
    return data;
}

/**
 * Get meeting link (respects RSVP requirement setting)
 */
export async function getMeetingLink(eventId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to view meeting link.');
    }

    const { data, error } = await supabase.rpc('get_meeting_link', {
        p_event_id: eventId
    });

    if (error) throw error;
    return data;
}

// ============================================
// ENHANCED PARTICIPANTS FETCH
// ============================================

/**
 * Fetch detailed participant data for an event (with RSVP status, guests, etc.)
 */
export async function fetchEventParticipantsDetailed(eventId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('event_participants')
        .select('membership_id, rsvp_status, guest_count, checked_in, approval_status, notes')
        .eq('event_id', eventId);

    if (error) throw error;

    const participantIds = (data || []).map(row => row.membership_id).filter(Boolean);

    // Fetch membership data
    let memberships = [];
    if (participantIds.length > 0) {
        const { data: membershipData, error: membershipError } = await supabase
            .from('instance_memberships')
            .select('id, user_id, display_name, avatar')
            .in('id', participantIds);

        if (!membershipError) {
            memberships = membershipData || [];
        }
    }

    // Fetch public profiles
    const allUserIds = [...new Set([...memberships.map(m => m.user_id).filter(Boolean)])];
    let publicProfiles = [];
    if (allUserIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
            .from('public_profiles')
            .select('user_id, display_name, username, avatar')
            .in('user_id', allUserIds);

        if (!profileError) {
            publicProfiles = profileData || [];
        }
    }

    const publicProfileMap = publicProfiles.reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
    }, {});

    const membershipMap = memberships.reduce((acc, m) => {
        acc[m.id] = m;
        return acc;
    }, {});

    return (data || []).map(row => {
        const membership = membershipMap[row.membership_id];
        const publicProfile = membership?.user_id ? publicProfileMap[membership.user_id] : null;

        return {
            user_id: row.membership_id,
            membership_id: row.membership_id,
            status: row.status,
            role: row.role,
            registered_at: row.registered_at,
            rsvp_status: row.rsvp_status || 'going',
            guest_count: row.guest_count || 0,
            checked_in: row.checked_in || false,
            approval_status: row.approval_status || 'approved',
            notes: row.notes,
            profile: publicProfile || membership || { display_name: 'User' }
        };
    });
}
