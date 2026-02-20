// Auth service - Clerk authentication operations
import { getSupabase, getAuthUserUuid } from '../lib/supabase.js';
import { currentUser, authUser, setCurrentUser, updateCurrentUser, clearAuth } from '../stores/auth.js';
import { generateRandomAvatar } from '../lib/utils/avatar.js';
import { getCachedData } from '../lib/utils/cache.js';
import { InputValidator } from '../lib/security.js';
import { addClerkListener, clerkSignOut, getClerkUser, getClerkSession } from '../lib/clerk.js';

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
    throw new Error('Use the Clerk sign-in widget to authenticate.');
}

/**
 * Sign in with GitHub OAuth
 */
export async function signInWithGitHub() {
    throw new Error('Use the Clerk sign-in widget to authenticate.');
}

/**
 * Sign in with email and password
 */
export async function signInWithPassword(email, password) {
    throw new Error('Password sign-in is disabled. Use Clerk sign-in.');
}

/**
 * Sign up with email and password
 */
export async function signUp(name, email, password) {
    throw new Error('Use Clerk sign-up to create an account.');
}

/**
 * Check if an email already has an account
 */
export async function checkEmailExists(email) {
    const supabase = getSupabase();
    const validatedEmail = InputValidator.validateEmail(email);

    // Use the database function we created in migration
    const { data, error } = await supabase
        .rpc('check_email_exists', { email_to_check: validatedEmail });

    if (error) {
        console.error('Email check failed:', error);
        return { exists: false };
    }

    return { exists: !!data };
}

/**
 * Create initial user profile in database
 * Called after onboarding or on first login
 */
export async function createUserProfile(userData, onboardingData = {}) {
    const supabase = getSupabase();

    const consolidatedName = onboardingData.username || onboardingData.name || userData.name;

    // Prepare profile data
    const profileInsert = {
        clerk_user_id: userData.user_id,
        display_name: consolidatedName,
        avatar: onboardingData.avatar || userData.avatar,
        interests: onboardingData.interests || [],
        onboarding_completed: true
    };

    // Add username if provided
    if (consolidatedName) {
        profileInsert.username = consolidatedName.toLowerCase();
    }

    const { data, error } = await supabase
        .from('user_profiles')
        .insert(profileInsert)
        .select()
        .single();

    if (error) {
        console.error('Failed to create user profile:', error);
        throw new Error('Failed to create profile: ' + error.message);
    }

    // Update local user state with saved data
    const userStateUpdate = {
        name: consolidatedName,
        avatar: onboardingData.avatar || userData.avatar,
        interests: onboardingData.interests || [],
        onboardingCompleted: true
    };

    // Add username if provided
    if (consolidatedName) {
        userStateUpdate.username = consolidatedName.toLowerCase();
    }

    updateCurrentUser(userStateUpdate);

    return data;
}

/**
 * Sign out
 */
export async function signOut() {
    await clerkSignOut();
    clearAuth();
    return { success: true };
}

function withTimeout(promise, timeoutMs, label) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out`));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

/**
 * Check for existing session on app load
 */
export async function checkExistingAuth() {
    try {
        const session = await getClerkSession();
        const user = await getClerkUser();

        if (session && user) {
            const basicUserData = createBasicUserDataFromClerk(user);
            setCurrentUser(basicUserData);
            authUser.set(user);

            if (basicUserData?.user_id) {
                fetchAndUpdateUserProfile(basicUserData.user_id);
            }
            const userUuid = await getAuthUserUuid();
            if (userUuid) {
                updateCurrentUser({ user_uuid: userUuid });
            }

            return basicUserData;
        }

        return null;
    } catch (error) {
        if (error?.name === 'AbortError') {
            return null;
        }
        console.error('Auth check failed:', error);
        return null;
    }
}

/**
 * Set up auth state change listener with onboarding routing
 */
export function setupAuthListener(callback) {
    let lastHandledUserId = null;
    let lastHandledEvent = null;

    const unsubscribePromise = addClerkListener(({ session, user }) => {
        const event = session && user ? 'SIGNED_IN' : 'SIGNED_OUT';
        if (import.meta.env.DEV) {
            console.log('Auth state changed:', event);
        }

        if (event === 'SIGNED_IN') {
            const currentUserId = user?.id || null;
            if (lastHandledUserId === currentUserId && lastHandledEvent === 'SIGNED_IN') {
                return;
            }

            const basicUserData = createBasicUserDataFromClerk(user);
            setCurrentUser(basicUserData);
            authUser.set(user);

            const shouldOnboard = basicUserData?.onboardingCompleted === false;

            callback?.({
                event,
                user: basicUserData,
                shouldOnboard
            });

            if (basicUserData?.user_id) {
                fetchAndUpdateUserProfile(basicUserData.user_id);
            }
            getAuthUserUuid().then(userUuid => {
                if (userUuid) {
                    updateCurrentUser({ user_uuid: userUuid });
                }
            });

            lastHandledUserId = currentUserId;
            lastHandledEvent = event;
        } else {
            clearAuth();
            callback?.({ event, user: null });
            // Allow the same user to sign in again after a sign-out.
            lastHandledUserId = null;
            lastHandledEvent = event;
        }
    });

    return {
        unsubscribe: async () => {
            const unsubscribe = await unsubscribePromise;
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        }
    };
}

/**
 * Create user data object from Supabase user (async - loads profile from database)
 */
async function createUserDataFromSession(user) {
    const supabase = getSupabase();

    // Load profile from database
    let profile = null;
    let error = null;

    try {
        const result = await withTimeout(
            supabase
                .from('user_profiles')
                .select('*')
                .eq('clerk_user_id', user.id)
                .maybeSingle(),
            4000,
            'fetchUserProfile'
        );
        profile = result?.data || null;
        error = result?.error || null;
    } catch (err) {
        error = err;
    }

    // Base user data from session
    const baseData = buildBaseUserData(user);

    // If profile exists, merge database data
        if (profile && !error) {
            return {
                ...baseData,
                name: profile.username || profile.display_name || baseData.name,
                username: profile.username,
                role: profile.role || 'user',
                avatar: profile.avatar || baseData.avatar,
            interests: profile.interests || [],
            birthday: profile.birthday,
            timezone: profile.timezone,
            title: profile.title,
            phone: profile.phone,
            city: profile.city,
            magic_email: profile.magic_email,
            bio: profile.bio,
            banner_color: profile.banner_color,
            banner_pattern: profile.banner_pattern,
            banner_image_url: profile.banner_image_url,
            spotify_track_url: profile.spotify_track_url,
            // Privacy settings
            show_city: profile.show_city ?? true,
            show_phone: profile.show_phone ?? false,
            show_email: profile.show_email ?? false,
            show_birthday: profile.show_birthday ?? false,
            show_interests: profile.show_interests ?? true,
            onboardingCompleted: profile.onboarding_completed || false,
            firstLoginAt: profile.first_login_at
        };
    }

    // Use cached profile to avoid onboarding flash when profile fetch fails/times out
    const cachedUser = getCachedUserForSession(user);
    if (cachedUser) {
        return cachedUser;
    }

    // No profile exists or fetch failed - treat as new user
    return {
        ...baseData,
        onboardingCompleted: false,
        isNewUser: true
    };
}

function buildBaseUserData(user) {
    const emailFallback = user?.email ? user.email.split('@')[0] : 'User';
    return {
        user_id: user.id,
        email: user.email,
        name: user.user_metadata?.display_name || emailFallback,
        avatar: user.user_metadata?.avatar || generateRandomAvatar(),
        loginTime: Date.now()
    };
}

function buildBaseUserDataFromClerk(user) {
    const email = user?.primaryEmailAddress?.emailAddress || null;
    const emailFallback = email ? email.split('@')[0] : 'User';
    return {
        user_id: user?.id,
        email,
        name: user?.username || user?.fullName || emailFallback,
        avatar: user?.imageUrl || generateRandomAvatar(),
        loginTime: Date.now()
    };
}

/**
 * Create basic user data immediately (no database query)
 * Used for fast initial auth completion
 */
function createBasicUserData(user) {
    if (!user) return null;

    const baseData = buildBaseUserData(user);

    // Return with cached profile if available
    const cachedUser = getCachedUserForSession(user);
    if (cachedUser) {
        return cachedUser;
    }

    // Return base data with flags indicating profile is loading
    return {
        ...baseData,
        profileLoading: true,
        onboardingCompleted: false
    };
}

function createBasicUserDataFromClerk(user) {
    if (!user) return null;

    const baseData = buildBaseUserDataFromClerk(user);

    const cachedUser = getCachedUserForSession(baseData);
    if (cachedUser) {
        return cachedUser;
    }

    return {
        ...baseData,
        profileLoading: true,
        onboardingCompleted: false
    };
}

/**
 * Fetch user profile in the background and update the store
 * This is non-blocking - completes auth immediately
 */
export async function fetchAndUpdateUserProfile(userId) {
    if (!userId) return;

    try {
        const supabase = getSupabase();
        const { data: profile, error } = await withTimeout(
            supabase
                .from('user_profiles')
                .select('*')
                .eq('clerk_user_id', userId)
                .maybeSingle(),
            4000,
            'fetchUserProfile'
        );

        if (error) {
            console.error('Profile fetch error:', error);
            return;
        }

        if (profile) {
            // Update store with full profile data
            updateCurrentUser({
                name: profile.username || profile.display_name,
                username: profile.username,
                role: profile.role || 'user',
                avatar: profile.avatar,
                interests: profile.interests || [],
                birthday: profile.birthday,
                timezone: profile.timezone,
                title: profile.title,
                phone: profile.phone,
                city: profile.city,
                magic_email: profile.magic_email,
                bio: profile.bio,
                banner_color: profile.banner_color,
                banner_pattern: profile.banner_pattern,
                banner_image_url: profile.banner_image_url,
                spotify_track_url: profile.spotify_track_url,
                show_city: profile.show_city ?? true,
                show_phone: profile.show_phone ?? false,
                show_email: profile.show_email ?? false,
                show_birthday: profile.show_birthday ?? false,
                show_interests: profile.show_interests ?? true,
                onboardingCompleted: profile.onboarding_completed || false,
                firstLoginAt: profile.first_login_at,
                profileLoading: false
            });
            const userUuid = await getAuthUserUuid();
            if (userUuid) {
                updateCurrentUser({ user_uuid: userUuid });
            }
        } else {
            // No profile found - mark as loaded
            updateCurrentUser({ profileLoading: false });
        }
    } catch (err) {
        console.error('Failed to fetch and update profile:', err);
        // Mark as loaded even on error to prevent infinite loading
        updateCurrentUser({ profileLoading: false });
    }
}

function getCachedUserForSession(user) {
    const cached = getCachedData('currentUser', null);
    const userId = user?.user_id || user?.id;
    if (!cached || !userId) return null;
    if (cached.user_id !== userId) return null;
    return cached;
}

/**
 * Check password strength
 * @returns {Object} { strength: number, label: string, class: string }
 */
export function checkPasswordStrength(password) {
    if (!password) {
        return { strength: 0, label: '', class: '' };
    }

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) {
        return { strength, label: '❌ Weak password', class: 'password-weak' };
    } else if (strength <= 4) {
        return { strength, label: '⚠️ Medium strength', class: 'password-medium' };
    } else {
        return { strength, label: '✅ Strong password', class: 'password-strong' };
    }
}
