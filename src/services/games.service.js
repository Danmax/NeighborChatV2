import { getSupabase, getAuthUserId } from '../lib/supabase.js';
import {
    setGameTemplates,
    gameTemplatesLoading,
    gameTemplatesError
} from '../stores/games.js';
import { getActiveMembershipId } from './events.service.js';

function transformTemplate(row) {
    return {
        id: row.id,
        instanceId: row.instance_id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        gameType: row.game_type,
        category: row.category,
        config: row.config || {},
        rules: row.rules || {},
        minPlayers: row.min_players,
        maxPlayers: row.max_players,
        estimatedDuration: row.estimated_duration_minutes,
        isTemplate: row.is_template,
        isPublic: row.is_public,
        createdAt: row.created_at
    };
}

export async function fetchGameTemplates() {
    const supabase = getSupabase();
    gameTemplatesLoading.set(true);
    gameTemplatesError.set(null);

    try {
        const { data, error } = await supabase
            .from('game_templates')
            .select('*')
            .eq('is_template', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        const templates = (data || []).map(transformTemplate);
        setGameTemplates(templates);
        return templates;
    } catch (error) {
        console.error('Failed to fetch game templates:', error);
        gameTemplatesError.set(error.message);
        return [];
    } finally {
        gameTemplatesLoading.set(false);
    }
}

export async function createGameSession({ template, name, scheduledStart, durationMinutes, heatCount, championshipEnabled }) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to create game sessions.');
    }

    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Join a community to create game sessions.');
    }

    const { data: membership, error: membershipError } = await supabase
        .from('instance_memberships')
        .select('instance_id')
        .eq('id', membershipId)
        .single();

    if (membershipError || !membership?.instance_id) {
        throw new Error('Unable to resolve instance.');
    }

    const sessionId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
        id: sessionId,
        instance_id: membership.instance_id,
        template_id: template.id,
        name: name || template.name,
        description: template.description || null,
        scheduled_start: scheduledStart,
        status: 'scheduled',
        host_membership_id: membershipId,
        settings: {
            duration_minutes: durationMinutes,
            heat_count: heatCount,
            championship_enabled: championshipEnabled,
            game_type: template.gameType
        }
    };

    const { data, error } = await supabase
        .from('game_sessions')
        .insert([payload])
        .select()
        .single();

    if (error) throw error;
    return data;
}
