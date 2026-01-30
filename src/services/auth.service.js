// Auth service - Supabase authentication operations
import { getSupabase } from '../lib/supabase.js';
import { currentUser, authUser, setCurrentUser, clearAuth } from '../stores/auth.js';
import { generateRandomAvatar } from '../lib/utils/avatar.js';
import { getCachedData } from '../lib/utils/cache.js';
import { InputValidator } from '../lib/security.js';

// Track magic link cooldown per email
const magicLinkCooldowns = new Map();
const COOLDOWN_SECONDS = 60;

/**
 * Send magic link email for passwordless auth
 */
export async function sendMagicLink(email) {
    const supabase = getSupabase();
    const validatedEmail = InputValidator.validateEmail(email);

    // Check cooldown
    const lastSend = magicLinkCooldowns.get(validatedEmail);
    if (lastSend) {
        const secondsLeft = COOLDOWN_SECONDS - Math.floor((Date.now() - lastSend) / 1000);
        if (secondsLeft > 0) {
            throw new Error(`Please wait ${secondsLeft} seconds before requesting another link`);
        }
    }

    const { error } = await supabase.auth.signInWithOtp({
        email: validatedEmail,
        options: {
            emailRedirectTo: `${window.location.origin}/#/`
        }
    });

    if (error) throw error;

    // Record send time for cooldown
    magicLinkCooldowns.set(validatedEmail, Date.now());

    return { success: true, email: validatedEmail };
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

    // Set user data
    const userData = createUserDataFromSession(data.user);
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

    // No confirmation needed, set user
    const userData = createUserDataFromSession(data.user);
    setCurrentUser(userData);
    authUser.set(data.user);

    return { success: true, user: userData };
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
            const userData = createUserDataFromSession(session.user);
            setCurrentUser(userData);
            authUser.set(session.user);
            return userData;
        }

        // Check for cached guest user
        const cachedUser = getCachedData('currentUser');
        if (cachedUser && cachedUser.isGuest) {
            setCurrentUser(cachedUser);
            return cachedUser;
        }

        return null;
    } catch (error) {
        console.error('Auth check failed:', error);
        return null;
    }
}

/**
 * Set up auth state change listener
 */
export function setupAuthListener(callback) {
    const supabase = getSupabase();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && session) {
            const userData = createUserDataFromSession(session.user);
            setCurrentUser(userData);
            authUser.set(session.user);
            callback?.({ event, user: userData });
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
 * Create user data object from Supabase user
 */
function createUserDataFromSession(user) {
    return {
        user_id: user.id,
        email: user.email,
        name: user.user_metadata?.display_name || user.email.split('@')[0],
        avatar: user.user_metadata?.avatar || generateRandomAvatar(),
        isGuest: false,
        loginTime: Date.now()
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
