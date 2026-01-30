// Profile service - Supabase profile operations
import { getSupabase } from '../lib/supabase.js';
import { currentUser, updateCurrentUser } from '../stores/auth.js';
import { get } from 'svelte/store';
import { cacheData, getCachedData } from '../lib/utils/cache.js';

/**
 * Load user profile from Supabase
 */
export async function loadUserProfile(userId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data;
}

/**
 * Save user profile to Supabase
 */
export async function saveUserProfile(profileData) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user || user.isGuest) {
        // For guests, just save locally
        cacheData('profile', profileData);
        updateCurrentUser(profileData);
        return profileData;
    }

    const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
            user_id: user.user_id,
            display_name: profileData.name,
            avatar: profileData.avatar,
            interests: profileData.interests || [],
            location: profileData.location,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        })
        .select()
        .single();

    if (error) throw error;

    // Update local state
    updateCurrentUser({
        name: profileData.name,
        avatar: profileData.avatar,
        interests: profileData.interests,
        location: profileData.location
    });

    cacheData('profile', data);

    return data;
}

/**
 * Update just the avatar
 */
export async function updateAvatar(avatar) {
    const user = get(currentUser);

    if (!user) return;

    if (user.isGuest) {
        updateCurrentUser({ avatar });
        cacheData('avatar', avatar);
        return avatar;
    }

    const supabase = getSupabase();

    const { error } = await supabase
        .from('user_profiles')
        .update({ avatar })
        .eq('user_id', user.user_id);

    if (error) throw error;

    updateCurrentUser({ avatar });
    cacheData('avatar', avatar);

    return avatar;
}

/**
 * Update user interests
 */
export async function updateInterests(interests) {
    const user = get(currentUser);

    if (!user) return;

    if (user.isGuest) {
        updateCurrentUser({ interests });
        cacheData('interests', interests);
        return interests;
    }

    const supabase = getSupabase();

    const { error } = await supabase
        .from('user_profiles')
        .update({ interests })
        .eq('user_id', user.user_id);

    if (error) throw error;

    updateCurrentUser({ interests });
    cacheData('interests', interests);

    return interests;
}

/**
 * Update display name
 */
export async function updateDisplayName(name) {
    const user = get(currentUser);

    if (!user) return;

    if (user.isGuest) {
        updateCurrentUser({ name });
        return name;
    }

    const supabase = getSupabase();

    const { error } = await supabase
        .from('user_profiles')
        .update({ display_name: name })
        .eq('user_id', user.user_id);

    if (error) throw error;

    updateCurrentUser({ name });

    return name;
}

/**
 * Update profile details (birthday, title, phone, city, magic_email)
 */
export async function updateProfileDetails(details) {
    const user = get(currentUser);

    if (!user) return;

    // Sanitize and prepare the data
    const sanitizedDetails = {
        birthday: details.birthday || null,
        title: details.title?.trim() || null,
        phone: details.phone?.trim() || null,
        city: details.city?.trim() || null,
        magic_email: details.magic_email?.trim() || null
    };

    if (user.isGuest) {
        updateCurrentUser(sanitizedDetails);
        cacheData('profileDetails', sanitizedDetails);
        return sanitizedDetails;
    }

    const supabase = getSupabase();

    const { error } = await supabase
        .from('user_profiles')
        .update({
            birthday: sanitizedDetails.birthday,
            title: sanitizedDetails.title,
            phone: sanitizedDetails.phone,
            city: sanitizedDetails.city,
            magic_email: sanitizedDetails.magic_email,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

    if (error) throw error;

    updateCurrentUser(sanitizedDetails);
    cacheData('profileDetails', sanitizedDetails);

    return sanitizedDetails;
}

/**
 * Get cached profile data or load from Supabase
 */
export async function getOrLoadProfile() {
    const user = get(currentUser);

    if (!user) return null;

    // Check cache first
    const cached = getCachedData('profile');
    if (cached) return cached;

    // Load from Supabase
    if (!user.isGuest) {
        const profile = await loadUserProfile(user.user_id);
        if (profile) {
            cacheData('profile', profile);
            return profile;
        }
    }

    return null;
}

/**
 * Available interests
 */
export const INTERESTS = [
    { id: 'reading', emoji: '📚', label: 'Reading' },
    { id: 'cooking', emoji: '👨‍🍳', label: 'Cooking' },
    { id: 'gardening', emoji: '🌱', label: 'Gardening' },
    { id: 'fitness', emoji: '🏃', label: 'Fitness' },
    { id: 'gaming', emoji: '🎮', label: 'Gaming' },
    { id: 'music', emoji: '🎵', label: 'Music' },
    { id: 'movies', emoji: '🎬', label: 'Movies' },
    { id: 'travel', emoji: '✈️', label: 'Travel' },
    { id: 'pets', emoji: '🐕', label: 'Pets' },
    { id: 'art', emoji: '🎨', label: 'Art' },
    { id: 'tech', emoji: '💻', label: 'Technology' },
    { id: 'sports', emoji: '⚽', label: 'Sports' },
    { id: 'yoga', emoji: '🧘', label: 'Yoga' },
    { id: 'photography', emoji: '📷', label: 'Photography' },
    { id: 'hiking', emoji: '🥾', label: 'Hiking' },
    { id: 'coffee', emoji: '☕', label: 'Coffee' }
];

/**
 * Fun display name suggestions
 */
export const FUN_NAMES = [
    'Friendly Neighbor',
    'Coffee Enthusiast',
    'Garden Guru',
    'Tech Wizard',
    'Fitness Fan',
    'Book Worm',
    'Music Lover',
    'Pet Parent',
    'Foodie Friend',
    'Adventure Seeker',
    'Creative Soul',
    'Nature Lover'
];
