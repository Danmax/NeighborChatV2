import { getSupabase } from '../lib/supabase.js';
import { statusOptions, interestOptions, defaultStatusOptions, defaultInterestOptions } from '../stores/options.js';

export async function loadStatusOptions() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('status_options')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        statusOptions.set(defaultStatusOptions);
        throw error;
    }

    if (data && data.length > 0) {
        statusOptions.set(data);
    }

    return data || [];
}

export async function loadInterestOptions() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('interest_options')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        interestOptions.set(defaultInterestOptions);
        throw error;
    }

    if (data && data.length > 0) {
        interestOptions.set(data);
    }

    return data || [];
}

export async function loadOptions() {
    await Promise.allSettled([loadStatusOptions(), loadInterestOptions()]);
}
