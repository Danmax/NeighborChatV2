import { requireClerkUser } from './_clerk.js';
import { cors, getSupabaseAdmin, getOrCreateUserProfile, parseBody } from './_shared.js';

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

    const { fileName, contentType, base64 } = parseBody(req.body);

    if (!fileName || !contentType || !base64) {
        res.status(400).json({ error: 'Missing file payload' });
        return;
    }

    if (!contentType.startsWith('image/')) {
        res.status(400).json({ error: 'Only image uploads are supported' });
        return;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        res.status(500).json({ error: 'Server misconfigured' });
        return;
    }

    let userUuid;
    try {
        userUuid = await getOrCreateUserProfile(supabase, auth.userId);
    } catch (err) {
        res.status(500).json({ error: err.message });
        return;
    }

    const safeName = String(fileName).replace(/\s+/g, '_');
    const path = `${userUuid}/${Date.now()}_${safeName}`;
    const buffer = Buffer.from(base64, 'base64');

    const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(path, buffer, { contentType, upsert: false });

    if (uploadError) {
        res.status(500).json({ error: uploadError.message });
        return;
    }

    const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(path);

    res.status(200).json({ publicUrl: data.publicUrl });
}
