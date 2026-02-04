import { getSupabase } from '../lib/supabase.js';

export async function generateEventDraft({ prompt, context = {} }) {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
        throw new Error('Please sign in to use AI drafts.');
    }

    const response = await fetch('/api/ai-event-draft', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ prompt, context })
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || 'AI draft failed');
    }

    return response.json();
}

export async function generateRecipeDraft({ prompt, context = {} }) {
    const supabase = getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
        throw new Error('Please sign in to use AI drafts.');
    }

    const response = await fetch('/api/ai-recipe-draft', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ prompt, context })
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || 'AI draft failed');
    }

    return response.json();
}
