// Auth service - Supabase authentication operations
import { getSupabase } from '../lib/supabase.js';
import { currentUser, authUser, setCurrentUser, updateCurrentUser, clearAuth } from '../stores/auth.js';
import { generateRandomAvatar } from '../lib/utils/avatar.js';
import { getCachedData } from '../lib/utils/cache.js';
import { InputValidator } from '../lib/security.js';

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
    const supabase = getSupabase();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/`,
            scopes: 'profile email'
        }
    });

    if (error) throw error;
    return { success: true, data };
}

/**
 * Sign in with GitHub OAuth
 */
export async function signInWithGitHub() {
    const supabase = getSupabase();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
            redirectTo: `${window.location.origin}/`,
            scopes: 'read:user user:email'
        }
    });

    if (error) throw error;
    return { success: true, data };
}

/**
 * Sign in with email and password
 */
export async function signInWithPassword(email, password) {
    const supabase = getSupabase();

    if (!email) throw new Error('Please enter your email');
    if (!password) throw new Error('Please enter your password');

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
    });

    if (error) throw error;

    // Fast path: set basic user data immediately
    const basicUserData = createBasicUserData(data.user);
    setCurrentUser(basicUserData);
    authUser.set(data.user);

    // Background: fetch full profile
    if (basicUserData?.user_id) {
        fetchAndUpdateUserProfile(basicUserData.user_id);
    }

    return { success: true, user: basicUserData };
}

/**
 * Sign up with email and password
 */
export async function signUp(name, email, password) {
    const supabase = getSupabase();

    const validatedName = InputValidator.validateDisplayName(name);
    const validatedEmail = InputValidator.validateEmail(email);

    // Validate password
    if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        throw new Error('Password must contain uppercase, lowercase, and number');
    }

    const { data, error } = await supabase.auth.signUp({
        email: validatedEmail,
        password: password,
        options: {
            data: {
                display_name: validatedName,
                avatar: generateRandomAvatar()
            },
            emailRedirectTo: window.location.origin
        }
    });

    if (error) throw error;

    // Check if email confirmation required
    if (data.user && !data.session) {
        return { success: true, confirmationRequired: true };
    }

    // No confirmation needed, set user (await async function)
    const userData = await createUserDataFromSession(data.user);
    setCurrentUser(userData);
    authUser.set(data.user);

    return { success: true, user: userData };
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
        user_id: userData.user_id,
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
    const supabase = getSupabase();

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

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
        const supabase = getSupabase();
        const { data: { session } } = await withTimeout(
            supabase.auth.getSession(),
            3000,
            'getSession'
        );

        if (session && session.user) {
            // Fast path: set basic user data immediately
            const basicUserData = createBasicUserData(session.user);
            setCurrentUser(basicUserData);
            authUser.set(session.user);

            // Background: fetch full profile
            if (basicUserData?.user_id) {
                fetchAndUpdateUserProfile(basicUserData.user_id);
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
    const supabase = getSupabase();
    let lastHandledUserId = null;
    let lastHandledEvent = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
            const currentUserId = session.user?.id || null;
            if (event === 'INITIAL_SESSION' && lastHandledUserId === currentUserId && lastHandledEvent === 'SIGNED_IN') {
                return;
            }

            // Fast path: set basic user data immediately (no await, no database query)
            const basicUserData = createBasicUserData(session.user);
            setCurrentUser(basicUserData);
            authUser.set(session.user);

            // Determine if onboarding needed (based on basic data)
            const shouldOnboard = basicUserData?.onboardingCompleted === false;

            callback?.({
                event,
                user: basicUserData,
                shouldOnboard
            });

            // Background: fetch full profile in parallel (non-blocking)
            if (basicUserData?.user_id) {
                fetchAndUpdateUserProfile(basicUserData.user_id);
            }

            lastHandledUserId = currentUserId;
            lastHandledEvent = event;
        }

        if (event === 'SIGNED_OUT') {
            clearAuth();
            callback?.({ event, user: null });
        }

        if (event === 'TOKEN_REFRESHED') {
            console.log('Token refreshed');
        }
    });

    return subscription;
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
                .eq('user_id', user.id)
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
            avatar: profile.avatar || baseData.avatar,
            interests: profile.interests || [],
            birthday: profile.birthday,
            title: profile.title,
            phone: profile.phone,
            city: profile.city,
            magic_email: profile.magic_email,
            bio: profile.bio,
            banner_color: profile.banner_color,
            banner_pattern: profile.banner_pattern,
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
                .eq('user_id', userId)
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
                avatar: profile.avatar,
                interests: profile.interests || [],
                birthday: profile.birthday,
                title: profile.title,
                phone: profile.phone,
                city: profile.city,
                magic_email: profile.magic_email,
                bio: profile.bio,
                banner_color: profile.banner_color,
                banner_pattern: profile.banner_pattern,
                show_city: profile.show_city ?? true,
                show_phone: profile.show_phone ?? false,
                show_email: profile.show_email ?? false,
                show_birthday: profile.show_birthday ?? false,
                show_interests: profile.show_interests ?? true,
                onboardingCompleted: profile.onboarding_completed || false,
                firstLoginAt: profile.first_login_at,
                profileLoading: false
            });
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
    if (!cached || !user?.id) return null;
    if (cached.user_id !== user.id) return null;
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
