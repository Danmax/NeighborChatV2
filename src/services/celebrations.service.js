// Celebrations service - Supabase operations for celebration wall
import { getSupabase, getAuthUserId, getAuthUserUuid } from '../lib/supabase.js';
import { getClerkToken } from '../lib/clerk.js';
import { currentUser } from '../stores/auth.js';
import {
    setCelebrations,
    addCelebration,
    updateCelebration,
    removeCelebration,
    addComment,
    celebrationsLoading,
    celebrationsError
} from '../stores/celebrations.js';
import { get } from 'svelte/store';
import { extractMentions } from '../lib/utils/mentions.js';

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
        gif_url: row.gif_url,
        image_url: row.image_url,
        music_url: row.music_url,
        celebration_date: row.celebration_date,
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

// Transform app format to database row (authUserUuid must be internal UUID from user_profiles)
function transformCelebrationToDb(celebrationData, user, authUserUuid) {
    return {
        id: `celeb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: celebrationData.category || celebrationData.type || 'birthday',
        message: celebrationData.message,
        gif_url: celebrationData.gif_url || null,
        image_url: celebrationData.image_url || null,
        music_url: celebrationData.music_url || null,
        celebration_date: celebrationData.celebration_date || null,
        honoree: celebrationData.title || celebrationData.honoree || null,
        recipient_name: celebrationData.recipientName || celebrationData.title || null,
        recipient_id: celebrationData.recipientId || null,
        author_id: authUserUuid, // UUID from user_profiles for FK constraint
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

        let celebrations = (data || []).map(transformCelebrationFromDb);
        celebrations = await applyArchiveRules(celebrations);
        celebrations = celebrations.filter(c => !c.archived);
        setCelebrations(celebrations);
        return celebrations;
    } catch (error) {
        if (error?.name === 'AbortError') {
            return [];
        }
        console.error('Failed to fetch celebrations:', error);
        celebrationsError.set(error.message);
        return [];
    } finally {
        celebrationsLoading.set(false);
    }
}

/**
 * Fetch a single celebration by id
 */
export async function fetchCelebrationById(celebrationId) {
    const supabase = getSupabase();
    try {
        const { data, error } = await supabase
            .from('celebrations')
            .select('*')
            .eq('id', celebrationId)
            .single();

        if (error) throw error;

        const celebration = transformCelebrationFromDb(data);
        updateCelebration(celebrationId, celebration);
        return celebration;
    } catch (error) {
        console.error('Failed to fetch celebration:', error);
        throw error;
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
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('Please sign in with your email to post celebrations. Guest users can only view content.');
    }

    const dbCelebration = transformCelebrationToDb(celebrationData, user, authUserUuid);

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
        await sendCelebrationMentions(celebration, celebrationData.message);
        return celebration;
    } catch (error) {
        console.error('Failed to create celebration:', error);
        throw error;
    }
}

/**
 * Update an existing celebration
 */
export async function updateCelebrationInDb(celebrationId, updates) {
    const supabase = getSupabase();
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('Please sign in to update celebrations.');
    }

    const dbUpdates = {};
    if (updates.message !== undefined) dbUpdates.message = updates.message;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.category !== undefined) dbUpdates.type = updates.category;
    if (updates.title !== undefined) dbUpdates.honoree = updates.title;
    if (updates.gif_url !== undefined) dbUpdates.gif_url = updates.gif_url;
    if (updates.image_url !== undefined) dbUpdates.image_url = updates.image_url;
    if (updates.music_url !== undefined) dbUpdates.music_url = updates.music_url;
    if (updates.celebration_date !== undefined) dbUpdates.celebration_date = updates.celebration_date;
    if (updates.archived !== undefined) dbUpdates.archived = updates.archived;
    // Ensure ownership remains consistent with RLS (and claim orphaned rows)
    dbUpdates.author_id = authUserUuid;

    try {
        const { data, error } = await supabase
            .from('celebrations')
            .update(dbUpdates)
            .eq('id', celebrationId)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            throw new Error('Not authorized to update this celebration or it no longer exists.');
        }

        updateCelebration(celebrationId, transformCelebrationFromDb(data));
        return data;
    } catch (error) {
        console.error('Failed to update celebration:', error);
        throw error;
    }
}

/**
 * Upload a celebration image and return public URL
 */
export async function uploadCelebrationImage(file) {
    const accessToken = await getClerkToken();
    if (!accessToken) {
        throw new Error('Please sign in to upload images.');
    }
    if (!file || !file.type?.startsWith('image/')) {
        throw new Error('Please upload a valid image file.');
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be 5MB or smaller.');
    }

    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const [, payload] = result.split('base64,');
            resolve(payload || '');
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

    const response = await fetch('/api/upload-celebration-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            base64
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || 'Upload failed');
    }

    return payload.publicUrl;
}

async function applyArchiveRules(celebrations) {
    if (!celebrations.length) return celebrations;
    const now = new Date();
    const authUserUuid = await getAuthUserUuid();
    const supabase = getSupabase();

    const updates = celebrations.map(async (celebration) => {
        if (!celebration.celebration_date) return celebration;

        const celebrationDate = new Date(celebration.celebration_date);
        const expiresAt = new Date(celebrationDate);
        expiresAt.setDate(expiresAt.getDate() + 7);

        if (now > expiresAt && !celebration.archived) {
            if (authUserUuid && celebration.authorId === authUserUuid) {
                try {
                    await supabase
                        .from('celebrations')
                        .update({ archived: true })
                        .eq('id', celebration.id);
                } catch (err) {
                    console.warn('Failed to archive celebration:', err);
                }
            }
            return { ...celebration, archived: true };
        }

        return celebration;
    });

    return Promise.all(updates);
}

async function sendCelebrationMentions(celebration, message) {
    if (!message) return;
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) return;

    const mentions = extractMentions(message);
    if (mentions.length === 0) return;

    const supabase = getSupabase();

    for (const mention of mentions) {
        const normalized = mention.toLowerCase();
        let target = null;

        const { data: byUsername } = await supabase
            .from('public_profiles')
            .select('user_id, display_name, username')
            .ilike('username', normalized)
            .limit(1);

        if (byUsername && byUsername.length > 0) {
            target = byUsername[0];
        } else {
            const displayQuery = normalized.replace(/_/g, ' ');
            const { data: byDisplay } = await supabase
                .from('public_profiles')
                .select('user_id, display_name, username')
                .ilike('display_name', displayQuery)
                .limit(1);

            if (byDisplay && byDisplay.length > 0) {
                target = byDisplay[0];
            }
        }

        if (target && target.user_id !== authUserUuid) {
            await supabase.rpc('send_celebration_mention_notification', {
                target_user_id: target.user_id,
                from_user_id: authUserUuid,
                celebration_id: celebration.id,
                mention_message: message
            });
        }
    }
}

/**
 * Update reactions on a celebration
 * Note: Due to RLS, only authenticated users can update. Consider using Supabase functions for public reactions.
 */
export async function updateReactions(celebrationId, reactions) {
    const supabase = getSupabase();

    // Check if user is authenticated
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('Please sign in to react to celebrations.');
    }

    try {
        const { data, error } = await supabase
            .from('celebrations')
            .update({ reactions })
            .eq('id', celebrationId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        updateCelebration(celebrationId, { reactions: data.reactions });
        return data;
    } catch (error) {
        console.error('Failed to update reactions:', error);
        throw error;
    }
}

// Emoji list must match the database function (migration_073)
const REACTION_EMOJI_LIST = ['❤️', '🎉', '👏', '🙌', '💯', '🔥', '✨', '💪'];

/**
 * React to a celebration (single reaction per user)
 * Uses emoji index instead of raw emoji to avoid JSON encoding issues
 */
export async function reactToCelebration(celebrationId, emoji) {
    const supabase = getSupabase();

    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('Please sign in to react to celebrations.');
    }

    // Validate emoji parameter
    if (!emoji || typeof emoji !== 'string') {
        throw new Error('Invalid emoji provided');
    }

    try {
        // Find emoji index in the list
        const normalizedEmoji = emoji.trim();
        const emojiIndex = REACTION_EMOJI_LIST.indexOf(normalizedEmoji);

        if (emojiIndex === -1) {
            console.error('Emoji not in allowed list:', normalizedEmoji);
            throw new Error('Invalid emoji. Please use one of the available reactions.');
        }

        // Call RPC function with emoji index instead of raw emoji
        const { data, error } = await supabase.rpc('add_celebration_reaction_v2', {
            p_celebration_id: celebrationId,
            p_emoji_index: emojiIndex
        });

        if (error) {
            console.error('Failed to add reaction via RPC:', error);
            throw new Error('Failed to add reaction. Please try again.');
        }

        if (data) {
            updateCelebration(celebrationId, { reactions: data });
        }

        return data;
    } catch (error) {
        console.error('Failed to react to celebration:', error);
        throw error;
    }
}
/**
 * Add a comment to a celebration
 * Note: Due to RLS, only the author can update. Comments may need separate handling.
 */
export async function postComment(celebrationId, commentText, gifUrl = null) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to comment');
    }

    // Check if user is authenticated
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('Please sign in with your email to comment. Guest users can only view content.');
    }

    try {
        const { data, error } = await supabase.rpc('add_celebration_reply', {
            p_celebration_id: celebrationId,
            p_message: commentText,
            p_gif_url: gifUrl
        });

        if (error) throw error;

        if (data) {
            addComment(celebrationId, data);
        }

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
