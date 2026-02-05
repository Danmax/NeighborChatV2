import { createClient } from '@supabase/supabase-js';
import { requireClerkUser } from './_clerk.js';

const DEFAULTS = {
    is_public: true
};

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function clampText(value, max) {
    if (!value) return null;
    const trimmed = String(value).trim();
    return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function normalizeList(value, limit = 25) {
    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean).slice(0, limit);
    }
    if (typeof value === 'string') {
        return value
            .split(/\n|,/)
            .map(item => item.trim())
            .filter(Boolean)
            .slice(0, limit);
    }
    return [];
}

function normalizeDraft(draft) {
    const warnings = [];

    const title = clampText(draft.title || draft.name, 100) || 'New Recipe';
    const description = clampText(draft.description, 300);
    const instructions = clampText(draft.instructions || draft.steps, 1200) || 'Add your cooking steps here.';

    const ingredients = normalizeList(draft.ingredients, 30);
    if (!ingredients.length) {
        warnings.push('No ingredients returned. Add them manually.');
    }

    const tags = normalizeList(draft.tags, 8);

    const prep_time = Number.isInteger(draft.prep_time) ? draft.prep_time : (Number.isInteger(draft.prepTime) ? draft.prepTime : null);
    const cook_time = Number.isInteger(draft.cook_time) ? draft.cook_time : (Number.isInteger(draft.cookTime) ? draft.cookTime : null);
    const servings = Number.isInteger(draft.servings) ? draft.servings : null;

    const image_url = clampText(draft.image_url || draft.imageUrl, 400);
    const is_public = typeof draft.is_public === 'boolean' ? draft.is_public : DEFAULTS.is_public;

    return {
        draft: {
            title,
            description,
            ingredients,
            instructions,
            prep_time,
            cook_time,
            servings,
            tags,
            image_url,
            is_public
        },
        warnings
    };
}

function extractJson(text) {
    if (!text) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch {
        return null;
    }
}

export default async function handler(req, res) {
    cors(res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!supabaseUrl || !serviceKey) {
        res.status(500).json({ error: 'Server misconfigured' });
        return;
    }

    if (!openaiKey) {
        res.status(500).json({ error: 'AI is not configured' });
        return;
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const authResult = await requireClerkUser(req);
    if (authResult?.error) {
        res.status(authResult.status || 401).json({ error: authResult.error });
        return;
    }

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', authResult.userId)
        .maybeSingle();

    const role = profile?.role || 'user';
    if (!['admin', 'event_manager'].includes(role)) {
        res.status(403).json({ error: 'Not authorized' });
        return;
    }

    const { data: aiSettingsRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'ai_settings')
        .maybeSingle();

    if (aiSettingsRow?.value && aiSettingsRow.value.enabled === false) {
        res.status(403).json({ error: 'AI is disabled' });
        return;
    }

    const { prompt, context = {} } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
        res.status(400).json({ error: 'Prompt required' });
        return;
    }
    if (String(prompt).length > 1000) {
        res.status(400).json({ error: 'Prompt too long' });
        return;
    }

    const requestId = `ai_${Date.now()}`;

    await supabase
        .from('ai_generation_requests')
        .insert({
            id: requestId,
            user_id: authResult.userId,
            request_type: 'recipe_draft',
            prompt: String(prompt).trim(),
            parameters: { model, context },
            status: 'pending'
        });

    const system = `You are an assistant that drafts recipes. Output ONLY JSON.
Return a JSON object with keys:
- title (string)
- description (string)
- ingredients (array of strings)
- instructions (string)
- prep_time (integer minutes or null)
- cook_time (integer minutes or null)
- servings (integer or null)
- tags (array of strings)
- image_url (string or null)
- is_public (boolean)
Keep it concise and practical.`;

    const userMessage = {
        role: 'user',
        content: `Prompt: ${prompt}\nContext: ${JSON.stringify(context)}`
    };

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
                model,
                max_tokens: 700,
                temperature: 0.4,
                messages: [
                    { role: 'system', content: system },
                    userMessage
                ]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            await supabase
                .from('ai_generation_requests')
                .update({ status: 'error', error_message: errorBody, completed_at: new Date().toISOString() })
                .eq('id', requestId);
            res.status(500).json({ error: 'AI request failed' });
            return;
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || '';
        const json = extractJson(text);

        if (!json) {
            await supabase
                .from('ai_generation_requests')
                .update({ status: 'error', error_message: 'Invalid AI response', completed_at: new Date().toISOString() })
                .eq('id', requestId);
            res.status(500).json({ error: 'Invalid AI response' });
            return;
        }

        const normalized = normalizeDraft(json);

        await supabase
            .from('ai_generation_requests')
            .update({
                status: 'completed',
                result: normalized,
                model_used: model,
                tokens_used: data?.usage?.total_tokens || null,
                completed_at: new Date().toISOString()
            })
            .eq('id', requestId);

        res.status(200).json({
            requestId,
            ...normalized
        });
    } catch (err) {
        await supabase
            .from('ai_generation_requests')
            .update({ status: 'error', error_message: err.message, completed_at: new Date().toISOString() })
            .eq('id', requestId);
        res.status(500).json({ error: 'AI request failed' });
    }
}
