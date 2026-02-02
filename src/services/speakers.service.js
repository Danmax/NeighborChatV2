// Speakers service - CRUD operations for dev meetup speakers
import { getSupabase, getAuthUserId } from '../lib/supabase.js';
import {
    setSpeakers,
    addSpeaker,
    updateSpeaker as updateSpeakerStore,
    removeSpeaker,
    speakersLoading,
    speakersError
} from '../stores/speakers.js';

/**
 * Transform database row to app format
 */
function transformSpeakerFromDb(row) {
    return {
        id: row.id,
        createdById: row.created_by_id,
        name: row.name,
        title: row.title,
        company: row.company,
        bio: row.bio,
        headshotUrl: row.headshot_url,
        email: row.email,
        socialLinks: row.social_links || {},
        isPublic: row.is_public !== false,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

/**
 * Transform app format to database row
 */
function transformSpeakerToDb(speakerData, authUserId) {
    return {
        created_by_id: authUserId,
        name: speakerData.name,
        title: speakerData.title || null,
        company: speakerData.company || null,
        bio: speakerData.bio || null,
        headshot_url: speakerData.headshotUrl || null,
        email: speakerData.email || null,
        social_links: speakerData.socialLinks || {},
        is_public: speakerData.isPublic !== false
    };
}

/**
 * Fetch all speakers (public + user's own)
 */
export async function fetchSpeakers(filters = {}) {
    const supabase = getSupabase();
    speakersLoading.set(true);
    speakersError.set(null);

    try {
        let query = supabase
            .from('speakers')
            .select('*')
            .order('name', { ascending: true });

        // Apply filters
        if (filters.searchTerm) {
            query = query.or(`name.ilike.%${filters.searchTerm}%,company.ilike.%${filters.searchTerm}%`);
        }
        if (filters.mySpeakersOnly) {
            const authUserId = await getAuthUserId();
            if (authUserId) {
                query = query.eq('created_by_id', authUserId);
            }
        }

        const { data, error } = await query;

        if (error) throw error;

        const speakers = (data || []).map(transformSpeakerFromDb);
        setSpeakers(speakers);
        return speakers;
    } catch (error) {
        console.error('Failed to fetch speakers:', error);
        speakersError.set(error.message);
        return [];
    } finally {
        speakersLoading.set(false);
    }
}

/**
 * Fetch a single speaker by ID
 */
export async function fetchSpeakerById(speakerId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('speakers')
            .select('*')
            .eq('id', speakerId)
            .single();

        if (error) throw error;

        return transformSpeakerFromDb(data);
    } catch (error) {
        console.error('Failed to fetch speaker:', error);
        throw error;
    }
}

/**
 * Create a new speaker profile
 */
export async function createSpeaker(speakerData) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();

    if (!authUserId) {
        throw new Error('Please sign in to create speaker profiles.');
    }

    const dbSpeaker = transformSpeakerToDb(speakerData, authUserId);

    try {
        const { data, error } = await supabase
            .from('speakers')
            .insert([dbSpeaker])
            .select()
            .single();

        if (error) throw error;

        const speaker = transformSpeakerFromDb(data);
        addSpeaker(speaker);
        return speaker;
    } catch (error) {
        console.error('Failed to create speaker:', error);
        throw error;
    }
}

/**
 * Update an existing speaker profile
 */
export async function updateSpeaker(speakerId, updates) {
    const supabase = getSupabase();

    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.headshotUrl !== undefined) dbUpdates.headshot_url = updates.headshotUrl;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.socialLinks !== undefined) dbUpdates.social_links = updates.socialLinks;
    if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;

    try {
        const { data, error } = await supabase
            .from('speakers')
            .update(dbUpdates)
            .eq('id', speakerId)
            .select()
            .single();

        if (error) throw error;

        const speaker = transformSpeakerFromDb(data);
        updateSpeakerStore(speakerId, speaker);
        return speaker;
    } catch (error) {
        console.error('Failed to update speaker:', error);
        throw error;
    }
}

/**
 * Delete a speaker profile
 */
export async function deleteSpeaker(speakerId) {
    const supabase = getSupabase();

    try {
        const { error } = await supabase
            .from('speakers')
            .delete()
            .eq('id', speakerId);

        if (error) throw error;

        removeSpeaker(speakerId);
        return true;
    } catch (error) {
        console.error('Failed to delete speaker:', error);
        throw error;
    }
}

/**
 * Fetch speakers created by a user
 */
export async function fetchUserSpeakers(userId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('speakers')
            .select('*')
            .eq('created_by_id', userId)
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []).map(transformSpeakerFromDb);
    } catch (error) {
        console.error('Failed to fetch user speakers:', error);
        throw error;
    }
}

/**
 * Search speakers by name or company
 */
export async function searchSpeakers(searchTerm) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('speakers')
            .select('*')
            .or(`name.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []).map(transformSpeakerFromDb);
    } catch (error) {
        console.error('Failed to search speakers:', error);
        throw error;
    }
}
