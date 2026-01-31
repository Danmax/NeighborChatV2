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
            redirectTo: `${window.location.origin}/#/`,
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
            redirectTo: `${window.location.origin}/#/`,
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

    // Set user data (await async function)
    const userData = await createUserDataFromSession(data.user);
    setCurrentUser(userData);
    authUser.set(data.user);

    return { success: true, user: userData };
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

    // Prepare profile data
    const profileInsert = {
        user_id: userData.user_id,
        display_name: onboardingData.name || userData.name,
        avatar: onboardingData.avatar || userData.avatar,
        interests: onboardingData.interests || [],
        onboarding_completed: true
    };

    // Add username if provided
    if (onboardingData.username) {
        profileInsert.username = onboardingData.username.toLowerCase();
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
        name: onboardingData.name || userData.name,
        avatar: onboardingData.avatar || userData.avatar,
        interests: onboardingData.interests || [],
        onboardingCompleted: true
    };

    // Add username if provided
    if (onboardingData.username) {
        userStateUpdate.username = onboardingData.username.toLowerCase();
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

/**
 * Check for existing session on app load
 */
export async function checkExistingAuth() {
    try {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user) {
            // Await async createUserDataFromSession
            const userData = await createUserDataFromSession(session.user);
            setCurrentUser(userData);
            authUser.set(session.user);
            return userData;
        }

        return null;
    } catch (error) {
        console.error('Auth check failed:', error);
        return null;
    }
}

/**
 * Set up auth state change listener with onboarding routing
 */
export function setupAuthListener(callback) {
    const supabase = getSupabase();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session) {
            // IMPORTANT: Now async!
            const userData = await createUserDataFromSession(session.user);
            setCurrentUser(userData);
            authUser.set(session.user);

            // Determine if onboarding needed
            const shouldOnboard = userData.isNewUser || !userData.onboardingCompleted;

            callback?.({
                event,
                user: userData,
                shouldOnboard // NEW: routing decision
            });
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
    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    // Base user data from session
    const baseData = {
        user_id: user.id,
        email: user.email,
        name: user.user_metadata?.display_name || user.email.split('@')[0],
        avatar: user.user_metadata?.avatar || generateRandomAvatar(),
        loginTime: Date.now()
    };

    // If profile exists, merge database data
    if (profile && !error) {
        return {
            ...baseData,
            name: profile.display_name || baseData.name,
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

    // No profile exists - this is a NEW USER
    return {
        ...baseData,
        onboardingCompleted: false,
        isNewUser: true
    };
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
