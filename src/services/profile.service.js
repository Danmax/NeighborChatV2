// Profile service - Supabase profile operations
import { getSupabase, getAuthUserId, getAuthUserUuid } from '../lib/supabase.js';
import { getClerkToken } from '../lib/clerk.js';
import { currentUser, updateCurrentUser } from '../stores/auth.js';
import { get } from 'svelte/store';
import { cacheData, getCachedData } from '../lib/utils/cache.js';
import {
    validateUsername,
    checkUsernameAvailability,
    sanitizeUsernameInput
} from '../lib/utils/username.js';
import { formatPhoneNumber, normalizePhoneNumber } from '../lib/utils/phone.js';

/**
 * Load user profile from Supabase
 */
export async function loadUserProfile(userId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('clerk_user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data;
}

/**
 * Save user profile to Supabase
 * Includes all profile fields for comprehensive saves
 */
export async function saveUserProfile(profileData) {
    const supabase = getSupabase();
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to save profile');
    }

    // Build upsert data with all provided fields
    const upsertData = {
        clerk_user_id: user.user_id,
        updated_at: new Date().toISOString()
    };

    // Core profile fields
    if (profileData.name !== undefined) {
        upsertData.display_name = profileData.name;
        upsertData.username = profileData.name?.toLowerCase();
    }
    if (profileData.username !== undefined) {
        upsertData.username = profileData.username?.toLowerCase();
        upsertData.display_name = profileData.username;
    }
    if (profileData.avatar !== undefined) upsertData.avatar = profileData.avatar;
    if (profileData.interests !== undefined) upsertData.interests = profileData.interests || [];
    if (profileData.location !== undefined) upsertData.location = profileData.location;

    // Extended profile fields
    if (profileData.birthday !== undefined) upsertData.birthday = profileData.birthday;
    if (profileData.title !== undefined) upsertData.title = profileData.title;
    if (profileData.phone !== undefined) upsertData.phone = profileData.phone ? normalizePhoneNumber(profileData.phone) : null;
    if (profileData.city !== undefined) upsertData.city = profileData.city;
    if (profileData.magic_email !== undefined) upsertData.magic_email = profileData.magic_email;
    if (profileData.bio !== undefined) upsertData.bio = profileData.bio;
    if (profileData.spotify_track_url !== undefined) upsertData.spotify_track_url = profileData.spotify_track_url;

    // Banner customization
    if (profileData.banner_color !== undefined) upsertData.banner_color = profileData.banner_color;
    if (profileData.banner_pattern !== undefined) upsertData.banner_pattern = profileData.banner_pattern;
    if (profileData.banner_image_url !== undefined) upsertData.banner_image_url = profileData.banner_image_url;

    // Privacy settings
    if (profileData.show_city !== undefined) upsertData.show_city = profileData.show_city;
    if (profileData.show_phone !== undefined) upsertData.show_phone = profileData.show_phone;
    if (profileData.show_email !== undefined) upsertData.show_email = profileData.show_email;
    if (profileData.show_birthday !== undefined) upsertData.show_birthday = profileData.show_birthday;
    if (profileData.show_interests !== undefined) upsertData.show_interests = profileData.show_interests;

    const { data, error } = await supabase
        .from('user_profiles')
        .upsert(upsertData, {
            onConflict: 'clerk_user_id'
        })
        .select()
        .single();

    if (error) throw error;

    // Update local state with saved data
    const localUpdate = {};
    if (profileData.name !== undefined) {
        localUpdate.name = profileData.name;
        localUpdate.username = profileData.name?.toLowerCase();
    }
    if (profileData.username !== undefined) {
        localUpdate.username = profileData.username?.toLowerCase();
        localUpdate.name = profileData.username;
    }
    if (profileData.avatar !== undefined) localUpdate.avatar = profileData.avatar;
    if (profileData.interests !== undefined) localUpdate.interests = profileData.interests;
    if (profileData.location !== undefined) localUpdate.location = profileData.location;
    if (profileData.birthday !== undefined) localUpdate.birthday = profileData.birthday;
    if (profileData.title !== undefined) localUpdate.title = profileData.title;
    if (profileData.phone !== undefined) localUpdate.phone = profileData.phone;
    if (profileData.city !== undefined) localUpdate.city = profileData.city;
    if (profileData.bio !== undefined) localUpdate.bio = profileData.bio;
    if (profileData.spotify_track_url !== undefined) localUpdate.spotify_track_url = profileData.spotify_track_url;
    if (profileData.banner_color !== undefined) localUpdate.banner_color = profileData.banner_color;
    if (profileData.banner_pattern !== undefined) localUpdate.banner_pattern = profileData.banner_pattern;
    if (profileData.banner_image_url !== undefined) localUpdate.banner_image_url = profileData.banner_image_url;
    if (profileData.show_city !== undefined) localUpdate.show_city = profileData.show_city;
    if (profileData.show_phone !== undefined) localUpdate.show_phone = profileData.show_phone;
    if (profileData.show_email !== undefined) localUpdate.show_email = profileData.show_email;
    if (profileData.show_birthday !== undefined) localUpdate.show_birthday = profileData.show_birthday;
    if (profileData.show_interests !== undefined) localUpdate.show_interests = profileData.show_interests;

    updateCurrentUser(localUpdate);
    cacheData('profile', data);

    return data;
}

/**
 * Update just the avatar
 */
export async function updateAvatar(avatar) {
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to update avatar');
    }

    const supabase = getSupabase();

    const { error } = await supabase
        .from('user_profiles')
        .update({ avatar })
        .eq('clerk_user_id', user.user_id);

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

    if (!user) {
        throw new Error('Must be logged in to update interests');
    }

    const supabase = getSupabase();

    const { error } = await supabase
        .from('user_profiles')
        .update({ interests })
        .eq('clerk_user_id', user.user_id);

    if (error) throw error;

    updateCurrentUser({ interests });
    cacheData('interests', interests);

    return interests;
}

/**
 * Update username with validation and availability checking
 */
export async function updateUsername(username) {
    const user = get(currentUser);

    if (!user) {
        throw new Error('No user logged in');
    }

    // Sanitize input
    const sanitized = sanitizeUsernameInput(username);

    if (!sanitized) {
        throw new Error('Username cannot be empty');
    }

    // Validate format
    const validation = validateUsername(sanitized);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const supabase = getSupabase();

    // Check availability (exclude current user)
    const availability = await checkUsernameAvailability(sanitized, supabase, user.user_uuid || user.user_id);
    if (!availability.available) {
        throw new Error(availability.error || 'Username is not available');
    }

    // Update in database
    const { error } = await supabase
        .from('user_profiles')
        .update({
            username: sanitized.toLowerCase(),
            display_name: sanitized,
            updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', user.user_id);

    if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
            throw new Error('Username is already taken');
        }
        throw error;
    }

    updateCurrentUser({ username: sanitized.toLowerCase(), name: sanitized });

    return sanitized.toLowerCase();
}

/**
 * Update profile details (birthday, title, phone, city, magic_email)
 */
export async function updateProfileDetails(details) {
    const user = get(currentUser);

    if (!user) {
        throw new Error('Must be logged in to update profile details');
    }

    // Sanitize and prepare the data
    const sanitizedSpotifyUrl = details.spotify_track_url?.trim() || null;
    if (sanitizedSpotifyUrl) {
        const isValid = /spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+/.test(sanitizedSpotifyUrl)
            || /spotify:(track|album|playlist):[a-zA-Z0-9]+/.test(sanitizedSpotifyUrl);
        if (!isValid) {
            throw new Error('Invalid Spotify URL.');
        }
    }

    const sanitizedDetails = {
        birthday: details.birthday || null,
        timezone: details.timezone?.trim() || null,
        title: details.title?.trim() || null,
        phone: details.phone ? normalizePhoneNumber(details.phone) : null, // Normalize phone for storage
        city: details.city?.trim() || null,
        magic_email: details.magic_email?.trim() || null,
        spotify_track_url: sanitizedSpotifyUrl
    };

    const supabase = getSupabase();

    // Build update object with only defined fields
    const updateData = {
        updated_at: new Date().toISOString()
    };
    if (details.birthday !== undefined) updateData.birthday = sanitizedDetails.birthday;
    if (details.timezone !== undefined) updateData.timezone = sanitizedDetails.timezone;
    if (details.title !== undefined) updateData.title = sanitizedDetails.title;
    if (details.phone !== undefined) updateData.phone = sanitizedDetails.phone;
    if (details.city !== undefined) updateData.city = sanitizedDetails.city;
    if (details.magic_email !== undefined) updateData.magic_email = sanitizedDetails.magic_email;
    if (details.spotify_track_url !== undefined) updateData.spotify_track_url = sanitizedDetails.spotify_track_url;

    const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('clerk_user_id', user.user_id);

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
    const profile = await loadUserProfile(user.user_id);
    if (profile) {
        cacheData('profile', profile);
        return profile;
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
 * Username suggestions
 */
export const USERNAME_SUGGESTIONS = [
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

/**
 * Load public profile (filtered by privacy settings)
 */
export async function loadPublicProfile(userId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    // View already applies privacy settings
    return {
        user_id: data.user_id,
        display_name: data.display_name,
        username: data.username,
        avatar: data.avatar,
        bio: data.bio,
        banner_color: data.banner_color,
        banner_pattern: data.banner_pattern,
        banner_image_url: data.banner_image_url,
        interests: data.interests || [],
        city: data.city || null,
        phone: data.phone || null,
        birthday: data.birthday || null,
        spotify_track_url: data.spotify_track_url || null,
        created_at: data.created_at
    };
}

export async function fetchFavoriteMovies(userId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('favorite_movies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function addFavoriteMovie(movie) {
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('You must be signed in to save favorites.');
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('favorite_movies')
        .insert([{
            user_id: authUserUuid,
            movie_id: movie.id,
            source: 'tmdb',
            title: movie.title,
            poster_url: movie.poster_url || null,
            year: movie.year || null
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function removeFavoriteMovie(movieId) {
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        throw new Error('You must be signed in to remove favorites.');
    }
    const supabase = getSupabase();
    const { error } = await supabase
        .from('favorite_movies')
        .delete()
        .eq('user_id', authUserUuid)
        .eq('movie_id', movieId)
        .eq('source', 'tmdb');

    if (error) throw error;
    return true;
}

/**
 * Update privacy settings
 */
export async function updatePrivacySettings(settings) {
    const user = get(currentUser);

    if (!user) {
        throw new Error('No user logged in');
    }

    const supabase = getSupabase();

    const { error } = await supabase
        .from('user_profiles')
        .update({
            show_city: settings.show_city ?? true,
            show_phone: settings.show_phone ?? false,
            show_email: settings.show_email ?? false,
            show_birthday: settings.show_birthday ?? false,
            show_interests: settings.show_interests ?? true,
            updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', user.user_id);

    if (error) throw error;

    updateCurrentUser(settings);
}

/**
 * Update bio
 */
export async function updateBio(bio) {
    const user = get(currentUser);

    if (!user) {
        throw new Error('No user logged in');
    }

    if (bio && bio.length > 200) {
        throw new Error('Bio must be 200 characters or less');
    }

    const supabase = getSupabase();

    const { error } = await supabase
        .from('user_profiles')
        .update({
            bio: bio?.trim() || null,
            updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', user.user_id);

    if (error) throw error;

    updateCurrentUser({ bio: bio?.trim() || null });
    cacheData('bio', bio);

    return bio;
}

/**
 * Update banner customization
 */
export async function updateBanner(bannerColor, bannerPattern, bannerImageUrl = undefined) {
    const user = get(currentUser);

    if (!user) {
        throw new Error('No user logged in');
    }

    // Validate color format
    if (bannerColor && !/^#[0-9A-Fa-f]{6}$/.test(bannerColor)) {
        throw new Error('Invalid color format. Use hex format: #RRGGBB');
    }

    // Validate pattern
    const validPatterns = ['solid', 'dots', 'stripes', 'grid', 'sparkle'];
    if (bannerPattern && !validPatterns.includes(bannerPattern)) {
        throw new Error('Invalid pattern. Must be: solid, dots, stripes, grid, or sparkle');
    }

    const supabase = getSupabase();

    const updates = {
        banner_color: bannerColor,
        banner_pattern: bannerPattern
    };
    if (bannerImageUrl !== undefined) {
        updates.banner_image_url = bannerImageUrl;
    }

    const { error } = await supabase
        .from('user_profiles')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('clerk_user_id', user.user_id);

    if (error) throw error;

    updateCurrentUser(updates);
    cacheData('banner', updates);

    return updates;
}

/**
 * Upload banner image and return public URL
 */
export async function uploadBannerImage(file) {
    const accessToken = await getClerkToken();
    if (!accessToken) {
        throw new Error('Please sign in to upload banner images.');
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

    const response = await fetch('/api/upload-banner-image', {
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

/**
 * Available banner patterns
 */
export const BANNER_PATTERNS = [
    { id: 'solid', label: 'Solid', preview: '▬' },
    { id: 'dots', label: 'Dots', preview: '⚫' },
    { id: 'stripes', label: 'Stripes', preview: '▦' },
    { id: 'grid', label: 'Grid', preview: '▦' },
    { id: 'sparkle', label: 'Sparkle', preview: '✨' }
];

/**
 * Banner color presets
 */
export const BANNER_COLORS = [
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#9C27B0', // Purple
    '#FF5722', // Deep Orange
    '#FFC107', // Amber
    '#00BCD4', // Cyan
    '#E91E63', // Pink
    '#607D8B', // Blue Grey
    '#795548', // Brown
    '#F44336'  // Red
];
