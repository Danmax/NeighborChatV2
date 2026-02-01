// Supabase client initialization
import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;
let config = null;

/**
 * Initialize Supabase client by fetching config from API
 */
export async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    try {
        console.log('🔄 Fetching config from API...');

        const response = await fetch('/api/config');

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        config = await response.json();

        console.log('📦 Config received:', {
            hasSupabase: !!config.supabase,
            hasUrl: !!config.supabase?.url,
            hasKey: !!config.supabase?.anonKey,
            url: config.supabase?.url
        });

        // Validate config
        if (!config.supabase) {
            throw new Error('Config missing supabase section');
        }

        if (!config.supabase.url) {
            throw new Error('Config missing supabase.url');
        }

        if (!config.supabase.anonKey) {
            throw new Error('Config missing supabase.anonKey');
        }

        // Initialize Supabase client
        supabaseClient = createClient(
            config.supabase.url,
            config.supabase.anonKey
        );

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
    config = {
        supabase: {
            url: 'https://llmqvrndctfpuejcyxsa.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsbXF2cm5kY3RmcHVlamN5eHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjMwNzUsImV4cCI6MjA4NTA5OTA3NX0.y7tRBi7D47Pn5VwGyVlYRwqJE1BixgwbxpNwlQ5GSso'
        },
        app: {
            name: 'Neighbor Chat',
            version: '2.1.0'
        }
    };

    supabaseClient = createClient(
        config.supabase.url,
        config.supabase.anonKey
    );

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
    if (!supabaseClient) {
        return { authenticated: false, userId: null };
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session?.user?.id) {
            return { authenticated: true, userId: session.user.id };
        }
        return { authenticated: false, userId: null };
    } catch (error) {
        console.error('Failed to check auth:', error);
        return { authenticated: false, userId: null };
    }
}

/**
 * Get the current authenticated user's ID (auth.uid())
 * @returns {Promise<string|null>}
 */
export async function getAuthUserId() {
    const { authenticated, userId } = await checkSupabaseAuth();
    if (authenticated && userId) return userId;

    if (!supabaseClient) return null;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        return user?.id || null;
    } catch (error) {
        console.error('Failed to fetch auth user:', error);
        return null;
    }
}
