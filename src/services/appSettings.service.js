import { getSupabase } from '../lib/supabase.js';
import { brandingSettings } from '../stores/appSettings.js';

export async function loadBrandingSettings() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('app_settings')
        .select('key,value')
        .eq('key', 'branding')
        .maybeSingle();

    if (error) throw error;

    if (data?.value) {
        brandingSettings.set({
            name: data.value.name || 'Neighbor Chat',
            logo: data.value.logo || '🏘️',
            tagline: data.value.tagline || 'Connect with neighbors, one chat at a time'
        });
    }

    return data?.value || null;
}
