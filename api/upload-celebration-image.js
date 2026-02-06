import { createClient } from '@supabase/supabase-js';
import { requireClerkUser } from './_clerk.js';

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    const auth = await requireClerkUser(req);
    if (auth.error) {
        res.status(auth.status || 401).json({ error: auth.error });
        return;
    }

    const { fileName, contentType, base64 } = typeof req.body === 'string'
        ? JSON.parse(req.body)
        : (req.body || {});

    if (!fileName || !contentType || !base64) {
        res.status(400).json({ error: 'Missing file payload' });
        return;
    }

    if (!contentType.startsWith('image/')) {
        res.status(400).json({ error: 'Only image uploads are supported' });
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        res.status(500).json({ error: 'Server misconfigured' });
        return;
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: existing, error: findError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('clerk_user_id', auth.userId)
        .maybeSingle();

    if (findError) {
        res.status(500).json({ error: 'Failed to resolve user profile' });
        return;
    }

    let userUuid = existing?.id;
    if (!userUuid) {
        const { data: inserted, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
                clerk_user_id: auth.userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (insertError) {
            res.status(500).json({ error: 'Failed to create user profile' });
            return;
        }

        userUuid = inserted?.id;
    }

    const safeName = String(fileName).replace(/\s+/g, '_');
    const path = `${userUuid}/${Date.now()}_${safeName}`;
    const buffer = Buffer.from(base64, 'base64');

    const { error: uploadError } = await supabase.storage
        .from('celebration-images')
        .upload(path, buffer, { contentType, upsert: false });

    if (uploadError) {
        res.status(500).json({ error: uploadError.message });
        return;
    }

    const { data } = supabase.storage
        .from('celebration-images')
        .getPublicUrl(path);

    res.status(200).json({ publicUrl: data.publicUrl });
}
