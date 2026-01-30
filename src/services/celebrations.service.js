// Celebrations service - Supabase operations for celebration wall
import { getSupabase, getAuthUserId } from '../lib/supabase.js';
import { currentUser } from '../stores/auth.js';
import {
    setCelebrations,
    addCelebration,
    updateCelebration,
    removeCelebration,
    celebrationsLoading,
    celebrationsError
} from '../stores/celebrations.js';
import { get } from 'svelte/store';

// Transform database row to app format
function transformCelebrationFromDb(row) {
    return {
        id: row.id,
        type: row.type,
        category: row.type, // Alias for compatibility
        title: row.honoree,
        honoree: row.honoree,
        recipientName: row.recipient_name,
        recipientId: row.recipient_id,
        message: row.message,
        emoji: row.emoji || '🎂',
        authorId: row.author_id,
        authorName: row.author_name,
        reactions: row.reactions || {},
        comments: row.comments || [],
        visibility: row.visibility || 'public',
        archived: row.archived || false,
        timestamp: row.timestamp_ms,
        created_at: row.created_at
    };
}

// Transform app format to database row (authUserId must be the actual auth.uid())
function transformCelebrationToDb(celebrationData, user, authUserId) {
    return {
        id: `celeb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: celebrationData.category || celebrationData.type || 'birthday',
        message: celebrationData.message,
        honoree: celebrationData.title || celebrationData.honoree || null,
        recipient_name: celebrationData.recipientName || celebrationData.title || null,
        recipient_id: celebrationData.recipientId || null,
        author_id: authUserId, // Must be auth.uid() for RLS
        author_name: user?.name || 'Anonymous',
        timestamp_ms: Date.now(),
        emoji: celebrationData.emoji || '🎂',
        reactions: {},
        comments: [],
        visibility: 'public',
        archived: false,
        created_at: new Date().toISOString()
    };
}

/**
 * Fetch all celebrations from Supabase
 */
export async function fetchCelebrations(limit = 50) {
    const supabase = getSupabase();
    celebrationsLoading.set(true);
    celebrationsError.set(null);

    try {
        const { data, error } = await supabase
            .from('celebrations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const celebrations = (data || []).map(transformCelebrationFromDb);
        setCelebrations(celebrations);
        return celebrations;
    } catch (error) {
        console.error('Failed to fetch celebrations:', error);
        celebrationsError.set(error.message);
        return [];
    } finally {
        celebrationsLoading.set(false);
    }
}

/**
 * Create a new celebration
 * Note: RLS requires authenticated Supabase users (auth.uid() = author_id)
 */
export async function createCelebration(celebrationData) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to post celebrations');
    }

    // Check if user is actually authenticated via Supabase (not a guest)
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in with your email to post celebrations. Guest users can only view content.');
    }

    const dbCelebration = transformCelebrationToDb(celebrationData, user, authUserId);

    try {
        const { data, error } = await supabase
            .from('celebrations')
            .insert([dbCelebration])
            .select()
            .single();

        if (error) {
            // Provide clearer error for RLS violations
            if (error.code === '42501' || error.message?.includes('policy')) {
                throw new Error('Permission denied. Please sign in with your email to post celebrations.');
            }
            throw error;
        }

        const celebration = transformCelebrationFromDb(data);
        addCelebration(celebration);
        return celebration;
    } catch (error) {
        console.error('Failed to create celebration:', error);
        throw error;
    }
}

/**
 * Update reactions on a celebration
 * Note: Due to RLS, only authenticated users can update. Consider using Supabase functions for public reactions.
 */
export async function updateReactions(celebrationId, reactions) {
    const supabase = getSupabase();

    // Check if user is authenticated
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        // For guests, just update the local store (optimistic UI)
        updateCelebration(celebrationId, { reactions });
        console.warn('Guest user: reactions saved locally only');
        return { reactions };
    }

    try {
        const { data, error } = await supabase
            .from('celebrations')
            .update({ reactions })
            .eq('id', celebrationId)
            .select()
            .single();

        if (error) {
            // RLS may prevent non-authors from updating, fallback to local
            if (error.code === '42501' || error.message?.includes('policy')) {
                updateCelebration(celebrationId, { reactions });
                console.warn('RLS: reactions saved locally only');
                return { reactions };
            }
            throw error;
        }

        updateCelebration(celebrationId, { reactions: data.reactions });
        return data;
    } catch (error) {
        console.error('Failed to update reactions:', error);
        throw error;
    }
}

/**
 * Add a comment to a celebration
 * Note: Due to RLS, only the author can update. Comments may need separate handling.
 */
export async function postComment(celebrationId, commentText) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to comment');
    }

    const comment = {
        id: `${user.user_id}-${Date.now()}`,
        user_id: user.user_id,
        user_name: user.name,
        user_avatar: user.avatar,
        text: commentText,
        created_at: new Date().toISOString()
    };

    // Check if user is authenticated
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in with your email to comment. Guest users can only view content.');
    }

    try {
        // Get current comments
        const { data: celebration, error: fetchError } = await supabase
            .from('celebrations')
            .select('comments')
            .eq('id', celebrationId)
            .single();

        if (fetchError) throw fetchError;

        const comments = [...(celebration.comments || []), comment];

        const { data, error } = await supabase
            .from('celebrations')
            .update({ comments })
            .eq('id', celebrationId)
            .select()
            .single();

        if (error) {
            // RLS may prevent non-authors from updating
            if (error.code === '42501' || error.message?.includes('policy')) {
                throw new Error('Unable to add comment. Only the celebration author can modify their post.');
            }
            throw error;
        }

        updateCelebration(celebrationId, { comments: data.comments });
        return data;
    } catch (error) {
        console.error('Failed to post comment:', error);
        throw error;
    }
}

/**
 * Delete a celebration
 */
export async function deleteCelebration(celebrationId) {
    const supabase = getSupabase();

    try {
        const { error } = await supabase
            .from('celebrations')
            .delete()
            .eq('id', celebrationId);

        if (error) throw error;

        removeCelebration(celebrationId);
        return true;
    } catch (error) {
        console.error('Failed to delete celebration:', error);
        throw error;
    }
}

/**
 * Subscribe to celebration changes
 */
export function subscribeToCelebrations(callback) {
    const supabase = getSupabase();

    const subscription = supabase
        .channel('celebrations-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'celebrations' },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    addCelebration(transformCelebrationFromDb(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    updateCelebration(payload.new.id, transformCelebrationFromDb(payload.new));
                } else if (payload.eventType === 'DELETE') {
                    removeCelebration(payload.old.id);
                }
                callback?.(payload);
            }
        )
        .subscribe();

    return subscription;
}
