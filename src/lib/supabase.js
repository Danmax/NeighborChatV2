// Supabase client initialization
import { createClient } from '@supabase/supabase-js';
import { getClerkToken, getClerkUser } from './clerk.js';

let supabaseClient = null;
let config = null;
const PUBLIC_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createSupabaseClient(url, anonKey) {
    return createClient(
        url,
        anonKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            },
            accessToken: async () => getClerkToken()
        }
    );
}

function initFromConfig(nextConfig, sourceLabel = 'config') {
    config = nextConfig;

    if (!config?.supabase?.url) {
        throw new Error(`Config missing supabase.url (${sourceLabel})`);
    }

    if (!config?.supabase?.anonKey) {
        throw new Error(`Config missing supabase.anonKey (${sourceLabel})`);
    }

    supabaseClient = createSupabaseClient(config.supabase.url, config.supabase.anonKey);
    return supabaseClient;
}

/**
 * Initialize Supabase client by fetching config from API
 */
export async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    // Prefer build-time public env vars for static hosting (no /api runtime required).
    if (PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY) {
        console.log('✅ Supabase initialized from VITE environment variables');
        return initFromConfig({
            supabase: {
                url: PUBLIC_SUPABASE_URL,
                anonKey: PUBLIC_SUPABASE_ANON_KEY
            },
            app: {
                name: 'Neighbor Chat',
                version: '2.1.0'
            }
        }, 'vite-env');
    }

    try {
        console.log('🔄 Fetching config from API...');

        const response = await fetch('/api/config', { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const apiConfig = await response.json();

        console.log('📦 Config received:', {
            hasSupabase: !!apiConfig.supabase,
            hasUrl: !!apiConfig.supabase?.url,
            hasKey: !!apiConfig.supabase?.anonKey,
            url: apiConfig.supabase?.url
        });

        initFromConfig(apiConfig, 'api');

        console.log('✅ Supabase initialized securely from API');
        return supabaseClient;

    } catch (error) {
        console.error('❌ Config initialization failed:', error);

        // FALLBACK for local development
        if (typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' ||
             window.location.hostname === '127.0.0.1')) {
            console.warn('⚠️ Using local development config');
            return initLocalConfig();
        }

        throw error;
    }
}

/**
 * Fallback for local development
 */
async function initLocalConfig() {
    return initFromConfig({
        supabase: {
            url: 'https://llmqvrndctfpuejcyxsa.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsbXF2cm5kY3RmcHVlamN5eHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjMwNzUsImV4cCI6MjA4NTA5OTA3NX0.y7tRBi7D47Pn5VwGyVlYRwqJE1BixgwbxpNwlQ5GSso'
        },
        app: {
            name: 'Neighbor Chat',
            version: '2.1.0'
        }
    }, 'localhost-fallback');

    console.log('✅ Supabase initialized (local mode)');
    return supabaseClient;
}

/**
 * Get the Supabase client (must call initSupabase first)
 */
export function getSupabase() {
    if (!supabaseClient) {
        throw new Error('Supabase not initialized. Call initSupabase() first.');
    }
    return supabaseClient;
}

async function handleOAuthRedirect() {
    return;
}

/**
 * Get the app config
 */
export function getConfig() {
    return config;
}

/**
 * Check if user is authenticated via Supabase (not a guest)
 * @returns {Promise<{authenticated: boolean, userId: string|null}>}
 */
export async function checkSupabaseAuth() {
    try {
        const user = await getClerkUser();
        if (user?.id) {
            return { authenticated: true, userId: user.id };
        }
    } catch (error) {
        console.error('Failed to check auth:', error);
    }
    return { authenticated: false, userId: null };
}

/**
 * Get the current authenticated user's ID (auth.uid())
 * @returns {Promise<string|null>}
 */
export async function getAuthUserId() {
    const { authenticated, userId } = await checkSupabaseAuth();
    if (authenticated && userId) return userId;
    return null;
}

/**
 * Resolve the current user's internal UUID via RPC (hybrid Clerk setup)
 * @returns {Promise<string|null>}
 */
export async function getAuthUserUuid() {
    const authUserId = await getAuthUserId();
    if (!authUserId) return null;

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('ensure_current_user_profile');
        if (error) {
            console.error('Failed to resolve ensure_current_user_profile:', error);
            return null;
        }
        return data || null;
    } catch (error) {
        console.error('Failed to resolve ensure_current_user_profile:', error);
        return null;
    }
}
