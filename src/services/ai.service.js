import { getClerkToken } from '../lib/clerk.js';

export async function generateEventDraft({ prompt, context = {} }) {
    const accessToken = await getClerkToken();

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
    const accessToken = await getClerkToken();

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
