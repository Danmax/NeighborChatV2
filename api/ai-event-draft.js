import { createClient } from '@supabase/supabase-js';

const EVENT_TYPES = [
    'meetup',
    'social',
    'dev-meetup',
    'potluck',
    'secret-santa',
    'workshop',
    'meeting',
    'other'
];

const DEFAULTS = {
    join_policy: 'open',
    status: 'draft'
};

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function isValidDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
}

function isValidTime(value) {
    return /^\d{2}:\d{2}$/.test(value || '');
}

function tomorrowISO() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

function clampText(value, max) {
    if (!value) return null;
    const trimmed = String(value).trim();
    return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function normalizeDraft(draft) {
    const warnings = [];

    const title = clampText(draft.title || draft.name, 100) || 'New Community Event';
    const type = EVENT_TYPES.includes(draft.type) ? draft.type : 'meetup';

    let date = draft.date;
    if (!isValidDate(date)) {
        warnings.push('Invalid or missing date. Using tomorrow.');
        date = tomorrowISO();
    }

    let time = draft.time || null;
    if (time && !isValidTime(time)) {
        warnings.push('Invalid time format. Expected HH:MM.');
        time = null;
    }

    const description = clampText(draft.description, 500);
    const location = clampText(draft.location || draft.location_name, 200);

    const max_attendees = Number.isInteger(draft.max_attendees) ? draft.max_attendees : null;
    const capacity = Number.isInteger(draft.capacity) ? draft.capacity : null;

    const join_policy = ['open', 'approval'].includes(draft.join_policy)
        ? draft.join_policy
        : DEFAULTS.join_policy;

    const meeting_link = clampText(draft.meeting_link, 300);
    const cover_image_url = clampText(draft.cover_image_url, 400);
    const attachments = Array.isArray(draft.attachments)
        ? draft.attachments.filter(Boolean).map(item => String(item).trim()).slice(0, 5)
        : [];

    const settings = typeof draft.settings === 'object' && draft.settings ? draft.settings : {};

    return {
        draft: {
            title,
            type,
            date,
            time,
            location,
            description,
            max_attendees,
            capacity,
            join_policy,
            meeting_link,
            cover_image_url,
            attachments,
            status: DEFAULTS.status,
            settings
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

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        res.status(401).json({ error: 'Missing auth token' });
        return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
        res.status(401).json({ error: 'Invalid auth token' });
        return;
    }

    const userId = userData.user.id;

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', userId)
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

    const requestId = `ai_${Date.now()}`;

    await supabase
        .from('ai_generation_requests')
        .insert({
            id: requestId,
            request_type: 'event_draft',
            prompt: String(prompt).trim(),
            parameters: { model, context },
            status: 'pending'
        });

    const system = `You are an assistant that drafts community events. Output ONLY JSON.
Return a JSON object with keys:
- title (string)
- description (string)
- type (one of: ${EVENT_TYPES.join(', ')})
- date (YYYY-MM-DD)
- time (HH:MM, 24h)
- location (string)
- join_policy (open|approval)
- capacity (integer or null)
- max_attendees (integer or null)
- meeting_link (string or null)
- cover_image_url (string or null)
- attachments (array of urls)
- settings (object)
Always pick a date in the future. Keep it concise.`;

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
                temperature: 0.3,
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
