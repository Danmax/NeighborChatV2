import { getSupabase, getAuthUserId, getAuthUserUuid } from '../lib/supabase.js';
import {
    setGameTemplates,
    gameTemplatesLoading,
    gameTemplatesError,
    addGameTemplate,
    updateGameTemplate as updateGameTemplateStore,
    removeGameTemplate,
    setGameSessions,
    gameSessionsLoading,
    gameSessionsError,
    setGameTeams,
    gameTeamsLoading,
    gameTeamsError,
    addGameTeam,
    updateGameTeam,
    removeGameTeam,
    setLeaderboardIndividual,
    setLeaderboardTeam,
    leaderboardLoading,
    leaderboardError,
    setGameAwards,
    setPlayerAwards,
    addPlayerAward,
    awardsLoading,
    awardsError,
    setSessionScores,
    updateSessionScore,
    addSessionScore,
    updateGameSession,
    setGameRoles,
    gameRolesLoading
} from '../stores/games.js';
import { getActiveMembershipId } from './events.service.js';

function normalizeAvatarUrl(avatar) {
    if (!avatar) return null;
    if (typeof avatar === 'string') return avatar;
    if (typeof avatar === 'object') {
        return avatar.url || avatar.image_url || avatar.avatar_url || avatar.src || null;
    }
    return null;
}

function transformGameProfile(row) {
    if (!row) return null;
    return {
        id: row.id,
        membershipId: row.membership_id,
        displayName: row.display_name || '',
        avatar: normalizeAvatarUrl(row.avatar),
        skillLevel: row.skill_level || 'beginner',
        favoriteGameTypes: Array.isArray(row.favorite_game_types) ? row.favorite_game_types : [],
        bio: row.bio || '',
        visibility: row.visibility || 'instance',
        preferences: row.preferences || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function getActiveMembershipContext() {
    const supabase = getSupabase();
    const membershipId = await getActiveMembershipId();
    if (!membershipId) return null;

    const { data: membership, error } = await supabase
        .from('instance_memberships')
        .select('id, instance_id, role')
        .eq('id', membershipId)
        .single();

    if (error || !membership?.instance_id) return null;
    return {
        membershipId: membership.id,
        instanceId: membership.instance_id,
        role: membership.role
    };
}

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

export async function getMyMembershipId() {
    return await getActiveMembershipId();
}

// ============================================================================
// GAME PROFILE FUNCTIONS
// ============================================================================

export async function fetchMyGameProfile() {
    const supabase = getSupabase();
    const ctx = await getActiveMembershipContext();
    if (!ctx) return null;

    const { data, error } = await supabase
        .from('game_player_profiles')
        .select('*')
        .eq('membership_id', ctx.membershipId)
        .maybeSingle();

    if (error) {
        // Table might not exist before migration is applied.
        if (error.code === 'PGRST205' || error.code === '42P01') return null;
        throw error;
    }

    return transformGameProfile(data);
}

export async function saveMyGameProfile(profile) {
    const supabase = getSupabase();
    const ctx = await getActiveMembershipContext();
    if (!ctx) {
        throw new Error('Join a community to save your game profile.');
    }

    const payload = {
        id: profile.id || `gprof_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        membership_id: ctx.membershipId,
        display_name: profile.displayName?.trim() || null,
        avatar: profile.avatar || null,
        skill_level: profile.skillLevel || 'beginner',
        favorite_game_types: Array.isArray(profile.favoriteGameTypes) ? profile.favoriteGameTypes : [],
        bio: profile.bio?.trim() || null,
        visibility: profile.visibility || 'instance',
        preferences: profile.preferences || {},
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('game_player_profiles')
        .upsert(payload, { onConflict: 'membership_id' })
        .select()
        .single();

    if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
            throw new Error('Game profile feature is not ready yet. Run migration_084 first.');
        }
        throw error;
    }

    return transformGameProfile(data);
}

// ============================================================================
// TEMPLATE CRUD FUNCTIONS (Admin/Moderator/Game Manager)
// ============================================================================

async function getTemplateManagementContext() {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to manage game templates.');
    }

    const authUserUuid = await getAuthUserUuid();
    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Join a community to manage game templates.');
    }

    const { data: membership, error: membershipError } = await supabase
        .from('instance_memberships')
        .select('instance_id, role')
        .eq('id', membershipId)
        .single();

    if (membershipError || !membership?.instance_id) {
        throw new Error('Unable to resolve instance.');
    }

    let canManageTemplates = ['admin', 'moderator'].includes(membership.role);

    if (!canManageTemplates && authUserUuid) {
        const { data: gameManagerRoles, error: roleError } = await supabase
            .from('game_roles')
            .select('id')
            .eq('user_id', authUserUuid)
            .eq('instance_id', membership.instance_id)
            .eq('role', 'game_manager')
            .eq('is_active', true)
            .limit(1);

        if (!roleError && (gameManagerRoles || []).length > 0) {
            canManageTemplates = true;
        }
    }

    if (!canManageTemplates) {
        throw new Error('Only admins, moderators, or game managers can manage game templates.');
    }

    return {
        membershipId,
        instanceId: membership.instance_id
    };
}

export async function createGameTemplate({
    name,
    description,
    icon,
    gameType,
    category,
    minPlayers,
    maxPlayers,
    estimatedDuration,
    rules,
    config
}) {
    const supabase = getSupabase();
    const { membershipId, instanceId } = await getTemplateManagementContext();

    const templateId = `game_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
        id: templateId,
        instance_id: instanceId,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || '🎮',
        game_type: gameType || 'custom',
        category: category || 'general',
        min_players: minPlayers || 2,
        max_players: maxPlayers || null,
        estimated_duration_minutes: estimatedDuration || 60,
        rules: rules || { list: [] },
        config: config || {},
        is_template: true,
        is_public: false,
        created_by_membership_id: membershipId
    };

    const { data, error } = await supabase
        .from('game_templates')
        .insert([payload])
        .select()
        .single();

    if (error) {
        if (error.message?.includes('unique') || error.code === '23505') {
            throw new Error('A template with this name already exists.');
        }
        throw error;
    }

    const template = transformTemplate(data);
    addGameTemplate(template);
    return template;
}

export async function updateGameTemplate(templateId, updates) {
    const supabase = getSupabase();
    await getTemplateManagementContext();

    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
    if (updates.description !== undefined) dbUpdates.description = updates.description?.trim() || null;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.gameType !== undefined) dbUpdates.game_type = updates.gameType;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.minPlayers !== undefined) dbUpdates.min_players = updates.minPlayers;
    if (updates.maxPlayers !== undefined) dbUpdates.max_players = updates.maxPlayers;
    if (updates.estimatedDuration !== undefined) dbUpdates.estimated_duration_minutes = updates.estimatedDuration;
    if (updates.rules !== undefined) dbUpdates.rules = updates.rules;
    if (updates.config !== undefined) dbUpdates.config = updates.config;

    const { data, error } = await supabase
        .from('game_templates')
        .update(dbUpdates)
        .eq('id', templateId)
        .select()
        .single();

    if (error) throw error;

    const template = transformTemplate(data);
    updateGameTemplateStore(templateId, template);
    return template;
}

export async function deleteGameTemplate(templateId) {
    const supabase = getSupabase();
    await getTemplateManagementContext();

    const { error } = await supabase
        .from('game_templates')
        .delete()
        .eq('id', templateId);

    if (error) throw error;

    removeGameTemplate(templateId);
    return true;
}

export async function createGameSession({
    template,
    templateId = null,
    name,
    scheduledStart,
    durationMinutes,
    heatCount,
    championshipEnabled,
    maxPlayers = null,
    allowSelfJoin = true,
    registrationDeadline = null,
    teamMode = null
}) {
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

    let resolvedTemplate = template || null;
    if (!resolvedTemplate && templateId) {
        const { data: templateData, error: templateError } = await supabase
            .from('game_templates')
            .select('id, name, description, game_type, config')
            .eq('id', templateId)
            .single();
        if (templateError || !templateData) {
            throw new Error('Selected game template is not available.');
        }
        resolvedTemplate = {
            id: templateData.id,
            name: templateData.name,
            description: templateData.description,
            gameType: templateData.game_type,
            config: templateData.config || {}
        };
    }

    if (!resolvedTemplate) {
        throw new Error('Please select a game template.');
    }

    const resolvedTeamMode = teamMode || resolvedTemplate?.config?.teams?.mode || 'individual';
    const sessionId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
        id: sessionId,
        instance_id: membership.instance_id,
        template_id: resolvedTemplate.id,
        name: name || resolvedTemplate.name,
        description: resolvedTemplate.description || null,
        scheduled_start: scheduledStart,
        status: 'scheduled',
        host_membership_id: membershipId,
        team_mode: resolvedTeamMode,
        max_players: maxPlayers || null,
        allow_self_join: allowSelfJoin !== false,
        registration_deadline: registrationDeadline || null,
        settings: {
            duration_minutes: durationMinutes,
            heat_count: heatCount,
            championship_enabled: championshipEnabled,
            game_type: resolvedTemplate.gameType
        }
    };

    let { data, error } = await supabase
        .from('game_sessions')
        .insert([payload])
        .select()
        .single();

    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        const legacyPayload = {
            id: payload.id,
            instance_id: payload.instance_id,
            template_id: payload.template_id,
            name: payload.name,
            description: payload.description,
            scheduled_start: payload.scheduled_start,
            status: payload.status,
            host_membership_id: payload.host_membership_id,
            team_mode: payload.team_mode,
            settings: payload.settings
        };
        const legacyResult = await supabase
            .from('game_sessions')
            .insert([legacyPayload])
            .select()
            .single();
        data = legacyResult.data;
        error = legacyResult.error;
    }

    if (error) throw error;
    return data;
}

export async function fetchGameSessions() {
    const supabase = getSupabase();
    gameSessionsLoading.set(true);
    gameSessionsError.set(null);

    try {
        const authUserId = await getAuthUserId();
        if (!authUserId) {
            setGameSessions([]);
            return [];
        }

        const membershipId = await getActiveMembershipId();
        if (!membershipId) {
            setGameSessions([]);
            return [];
        }

        const { data: membership, error: membershipError } = await supabase
            .from('instance_memberships')
            .select('instance_id')
            .eq('id', membershipId)
            .single();

        if (membershipError || !membership?.instance_id) {
            throw new Error('Unable to resolve instance.');
        }

        let { data, error } = await supabase
            .from('game_sessions')
            .select('id, name, scheduled_start, status, settings, template_id, host_membership_id, created_at, team_mode, max_players, allow_self_join, registration_deadline')
            .eq('instance_id', membership.instance_id)
            .order('scheduled_start', { ascending: true });

        if (error && (error.code === '42703' || error.code === 'PGRST204')) {
            const legacyResult = await supabase
                .from('game_sessions')
                .select('id, name, scheduled_start, status, settings, template_id, host_membership_id, created_at, team_mode')
                .eq('instance_id', membership.instance_id)
                .order('scheduled_start', { ascending: true });
            data = legacyResult.data;
            error = legacyResult.error;
        }

        if (error) throw error;
        const sessions = (data || []).map(row => ({
            id: row.id,
            name: row.name,
            scheduledStart: row.scheduled_start,
            status: row.status,
            settings: row.settings || {},
            templateId: row.template_id,
            hostMembershipId: row.host_membership_id,
            teamMode: row.team_mode || 'individual',
            maxPlayers: row.max_players,
            allowSelfJoin: row.allow_self_join !== false,
            registrationDeadline: row.registration_deadline,
            createdAt: row.created_at
        }));
        setGameSessions(sessions);
        return sessions;
    } catch (error) {
        console.error('Failed to fetch game sessions:', error);
        gameSessionsError.set(error.message);
        setGameSessions([]);
        return [];
    } finally {
        gameSessionsLoading.set(false);
    }
}

// ============================================================================
// SESSION MANAGEMENT FUNCTIONS (Admin/Host only)
// ============================================================================

export async function startGameSession(sessionId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to start game sessions.');
    }

    const { data, error } = await supabase
        .from('game_sessions')
        .update({
            status: 'active',
            actual_start: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;

    updateGameSession(sessionId, { status: 'active' });
    return data;
}

export async function endGameSession(sessionId, winnerMembershipId = null, winningTeamId = null) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to end game sessions.');
    }

    const updates = {
        status: 'completed',
        ended_at: new Date().toISOString()
    };

    if (winningTeamId) {
        updates.winning_team_id = winningTeamId;
    }

    const { data, error } = await supabase
        .from('game_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;

    // Update ranks for all players in the session
    await updateSessionRanks(sessionId);

    updateGameSession(sessionId, { status: 'completed' });
    return data;
}

export async function cancelGameSession(sessionId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to cancel game sessions.');
    }

    const { data, error } = await supabase
        .from('game_sessions')
        .update({ status: 'cancelled' })
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;

    updateGameSession(sessionId, { status: 'cancelled' });
    return data;
}

export async function addPlayerToSession(sessionId, membershipId, teamId = null) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to add players.');
    }

    // Check if player already exists
    const { data: existing } = await supabase
        .from('game_players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('membership_id', membershipId)
        .maybeSingle();

    if (existing) {
        throw new Error('Player is already in this session.');
    }

    const playerId = `gp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
        .from('game_players')
        .insert([{
            id: playerId,
            session_id: sessionId,
            membership_id: membershipId,
            team_id: teamId,
            final_score: 0,
            status: 'joined'
        }])
        .select('id, membership_id, team_id, final_score')
        .single();

    if (error) throw error;

    addSessionScore(sessionId, {
        id: playerId,
        membershipId,
        teamId,
        finalScore: data?.final_score ?? 0
    });

    return data;
}

export async function removePlayerFromSession(sessionId, membershipId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to remove players.');
    }

    const { error } = await supabase
        .from('game_players')
        .delete()
        .eq('session_id', sessionId)
        .eq('membership_id', membershipId);

    if (error) throw error;

    // Refresh scores
    await fetchSessionScores(sessionId);
    return true;
}

export async function joinGameSession(sessionId, teamId = null) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to join game sessions.');
    }

    const ctx = await getActiveMembershipContext();
    if (!ctx) {
        throw new Error('Join a community to participate in games.');
    }

    let { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .select('id, instance_id, status, max_players, allow_self_join, registration_deadline')
        .eq('id', sessionId)
        .single();

    if (sessionError && (sessionError.code === '42703' || sessionError.code === 'PGRST204')) {
        const legacyResult = await supabase
            .from('game_sessions')
            .select('id, instance_id, status')
            .eq('id', sessionId)
            .single();
        session = legacyResult.data
            ? { ...legacyResult.data, max_players: null, allow_self_join: true, registration_deadline: null }
            : null;
        sessionError = legacyResult.error;
    }

    if (sessionError || !session) {
        throw new Error('Game session not found.');
    }

    if (session.instance_id !== ctx.instanceId) {
        throw new Error('You can only join sessions in your active community.');
    }

    if (session.status !== 'scheduled' && session.status !== 'active') {
        throw new Error('This session is not open for joining.');
    }

    if (session.allow_self_join === false) {
        throw new Error('This session requires host approval to join.');
    }

    if (session.registration_deadline && new Date(session.registration_deadline) < new Date()) {
        throw new Error('Registration has closed for this session.');
    }

    if (session.max_players) {
        const { count, error: countError } = await supabase
            .from('game_players')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', sessionId);
        if (countError) throw countError;
        if ((count || 0) >= session.max_players) {
            throw new Error('This session is already full.');
        }
    }

    return await addPlayerToSession(sessionId, ctx.membershipId, teamId);
}

export async function leaveGameSession(sessionId) {
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to leave game sessions.');
    }

    const ctx = await getActiveMembershipContext();
    if (!ctx) {
        throw new Error('No active community found.');
    }

    await removePlayerFromSession(sessionId, ctx.membershipId);
    return true;
}

export async function fetchMyJoinedSessionIds() {
    const supabase = getSupabase();
    const ctx = await getActiveMembershipContext();
    if (!ctx) return [];

    const { data, error } = await supabase
        .from('game_players')
        .select('session_id, status')
        .eq('membership_id', ctx.membershipId);

    if (error) {
        console.error('Failed to fetch joined sessions:', error);
        return [];
    }

    return [...new Set((data || []).map(row => row.session_id).filter(Boolean))];
}

async function updateSessionRanks(sessionId) {
    const supabase = getSupabase();

    // Get all players ordered by score
    const { data: players } = await supabase
        .from('game_players')
        .select('id, final_score')
        .eq('session_id', sessionId)
        .order('final_score', { ascending: false });

    if (!players || players.length === 0) return;

    // Update ranks
    for (let i = 0; i < players.length; i++) {
        await supabase
            .from('game_players')
            .update({
                final_rank: i + 1,
                points_earned: calculatePointsEarned(i + 1, players.length)
            })
            .eq('id', players[i].id);
    }
}

function calculatePointsEarned(rank, totalPlayers) {
    // Points based on placement
    if (rank === 1) return 100;
    if (rank === 2) return 75;
    if (rank === 3) return 50;
    if (rank <= Math.ceil(totalPlayers / 2)) return 25;
    return 10; // Participation points
}

export async function fetchInstanceMembers() {
    const supabase = getSupabase();

    const membershipId = await getActiveMembershipId();
    if (!membershipId) return [];

    const { data: membership } = await supabase
        .from('instance_memberships')
        .select('instance_id')
        .eq('id', membershipId)
        .single();

    if (!membership?.instance_id) return [];

    const { data, error } = await supabase
        .from('instance_memberships')
        .select('id, display_name, avatar, role, status')
        .eq('instance_id', membership.instance_id)
        .eq('status', 'active')
        .order('display_name', { ascending: true });

    if (error) {
        console.error('Failed to fetch instance members:', error);
        return [];
    }

    return (data || []).map(m => ({
        membershipId: m.id,
        displayName: m.display_name,
        avatar: normalizeAvatarUrl(m.avatar),
        role: m.role
    }));
}

// ============================================================================
// TEAM FUNCTIONS
// ============================================================================

function transformTeam(row) {
    return {
        id: row.id,
        instanceId: row.instance_id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        color: row.color,
        captainMembershipId: row.captain_membership_id,
        maxMembers: row.max_members,
        isActive: row.is_active,
        teamStats: row.team_stats || { totalGames: 0, totalWins: 0, totalPoints: 0, winStreak: 0, bestWinStreak: 0 },
        createdByMembershipId: row.created_by_membership_id,
        createdAt: row.created_at,
        members: (row.game_team_members || []).map(m => ({
            id: m.id,
            membershipId: m.membership_id,
            role: m.role,
            status: m.status,
            joinedAt: m.joined_at,
            playerStats: m.player_stats || { gamesPlayed: 0, gamesWon: 0, pointsContributed: 0 },
            displayName: m.instance_memberships?.display_name,
            avatar: normalizeAvatarUrl(m.instance_memberships?.avatar)
        }))
    };
}

export async function fetchGameTeams() {
    const supabase = getSupabase();
    gameTeamsLoading.set(true);
    gameTeamsError.set(null);

    try {
        const authUserId = await getAuthUserId();
        if (!authUserId) {
            setGameTeams([]);
            return [];
        }

        const membershipId = await getActiveMembershipId();
        if (!membershipId) {
            setGameTeams([]);
            return [];
        }

        const { data: membership } = await supabase
            .from('instance_memberships')
            .select('instance_id')
            .eq('id', membershipId)
            .single();

        if (!membership?.instance_id) {
            setGameTeams([]);
            return [];
        }

        const { data, error } = await supabase
            .from('game_teams')
            .select(`
                *,
                game_team_members (
                    id, membership_id, role, status, joined_at, player_stats,
                    instance_memberships!game_team_members_membership_id_fkey (display_name, avatar)
                )
            `)
            .eq('instance_id', membership.instance_id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const teams = (data || []).map(transformTeam);
        setGameTeams(teams);
        return teams;
    } catch (error) {
        console.error('Failed to fetch game teams:', error);
        gameTeamsError.set(error.message);
        return [];
    } finally {
        gameTeamsLoading.set(false);
    }
}

export async function createGameTeam({ name, description, icon, color }) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to create a team.');
    }

    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Join a community to create teams.');
    }

    const { data: membership } = await supabase
        .from('instance_memberships')
        .select('instance_id')
        .eq('id', membershipId)
        .single();

    if (!membership?.instance_id) {
        throw new Error('Unable to resolve instance.');
    }

    const teamId = `team_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
        id: teamId,
        instance_id: membership.instance_id,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || '🎮',
        color: color || '#5c34a5',
        captain_membership_id: membershipId,
        created_by_membership_id: membershipId
    };

    const { data, error } = await supabase
        .from('game_teams')
        .insert([payload])
        .select()
        .single();

    if (error) {
        if (error.message?.includes('unique') || error.code === '23505') {
            throw new Error('A team with this name already exists.');
        }
        throw error;
    }

    // Add creator as captain member
    const memberId = `gtm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await supabase
        .from('game_team_members')
        .insert([{
            id: memberId,
            team_id: teamId,
            membership_id: membershipId,
            role: 'captain',
            status: 'active'
        }]);

    const team = transformTeam({ ...data, game_team_members: [] });
    addGameTeam(team);
    return team;
}

export async function updateGameTeamDetails(teamId, updates) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to update the team.');
    }

    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
    if (updates.description !== undefined) dbUpdates.description = updates.description?.trim() || null;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.color !== undefined) dbUpdates.color = updates.color;

    const { data, error } = await supabase
        .from('game_teams')
        .update(dbUpdates)
        .eq('id', teamId)
        .select()
        .single();

    if (error) throw error;

    updateGameTeam(teamId, {
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color
    });

    return data;
}

export async function deleteGameTeam(teamId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to delete the team.');
    }

    const { error } = await supabase
        .from('game_teams')
        .delete()
        .eq('id', teamId);

    if (error) throw error;

    removeGameTeam(teamId);
    return true;
}

export async function joinGameTeam(teamId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to join a team.');
    }

    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Join a community first.');
    }

    const memberId = `gtm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
        .from('game_team_members')
        .insert([{
            id: memberId,
            team_id: teamId,
            membership_id: membershipId,
            role: 'member',
            status: 'active'
        }])
        .select(`
            *,
            instance_memberships!game_team_members_membership_id_fkey (display_name, avatar)
        `)
        .single();

    if (error) {
        if (error.message?.includes('unique') || error.code === '23505') {
            throw new Error('You are already a member of this team.');
        }
        throw error;
    }

    // Refresh teams to get updated member list
    await fetchGameTeams();
    return data;
}

export async function leaveGameTeam(teamId) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in.');
    }

    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Unable to resolve membership.');
    }

    const { error } = await supabase
        .from('game_team_members')
        .update({ status: 'inactive', left_at: new Date().toISOString() })
        .eq('team_id', teamId)
        .eq('membership_id', membershipId);

    if (error) throw error;

    await fetchGameTeams();
    return true;
}

export async function addTeamMember(teamId, membershipId) {
    const supabase = getSupabase();

    const memberId = `gtm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
        .from('game_team_members')
        .insert([{
            id: memberId,
            team_id: teamId,
            membership_id: membershipId,
            role: 'member',
            status: 'active'
        }])
        .select()
        .single();

    if (error) throw error;

    await fetchGameTeams();
    return data;
}

export async function removeTeamMember(teamId, membershipId) {
    const supabase = getSupabase();

    const { error } = await supabase
        .from('game_team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('membership_id', membershipId);

    if (error) throw error;

    await fetchGameTeams();
    return true;
}

// ============================================================================
// LEADERBOARD FUNCTIONS
// ============================================================================

export async function fetchLeaderboard({ period = 'all_time', participantType = 'individual', gameType = null, limit = 50 } = {}) {
    const supabase = getSupabase();
    leaderboardLoading.set(true);
    leaderboardError.set(null);

    try {
        const membershipId = await getActiveMembershipId();
        if (!membershipId) {
            setLeaderboardIndividual([]);
            setLeaderboardTeam([]);
            return { individual: [], team: [] };
        }

        const { data: membership } = await supabase
            .from('instance_memberships')
            .select('instance_id')
            .eq('id', membershipId)
            .single();

        if (!membership?.instance_id) {
            return { individual: [], team: [] };
        }

        const instanceId = membership.instance_id;

        let individualEntries = [];
        let teamEntries = [];

        if (participantType === 'individual' || participantType === 'both') {
            let query = supabase
                .from('game_leaderboard_individual')
                .select('*')
                .eq('instance_id', instanceId)
                .order('total_score', { ascending: false })
                .limit(limit);

            if (gameType) {
                query = query.eq('game_type', gameType);
            }

            const { data: individualData, error: individualError } = await query;

            if (individualError) {
                console.error('Individual leaderboard error:', individualError);
            } else {
                individualEntries = (individualData || []).map((row, idx) => ({
                    rank: idx + 1,
                    membershipId: row.membership_id,
                    displayName: row.display_name,
                    avatar: normalizeAvatarUrl(row.avatar),
                    gameType: row.game_type,
                    gamesPlayed: row.games_played,
                    gamesWon: row.games_won,
                    totalScore: row.total_score,
                    bestScore: row.best_score,
                    winRate: row.win_rate,
                    currentWinStreak: row.current_win_streak,
                    bestWinStreak: row.best_win_streak
                }));
                setLeaderboardIndividual(individualEntries);
            }
        }

        if (participantType === 'team' || participantType === 'both') {
            const { data: teamData, error: teamError } = await supabase
                .from('game_leaderboard_teams')
                .select('*')
                .eq('instance_id', instanceId)
                .order('total_points', { ascending: false })
                .limit(limit);

            if (teamError) {
                console.error('Team leaderboard error:', teamError);
            } else {
                teamEntries = (teamData || []).map((row, idx) => ({
                    rank: idx + 1,
                    teamId: row.team_id,
                    teamName: row.team_name,
                    icon: row.icon,
                    color: row.color,
                    totalGames: row.total_games,
                    totalWins: row.total_wins,
                    totalPoints: row.total_points,
                    winRate: row.win_rate,
                    currentWinStreak: row.current_win_streak,
                    memberCount: row.member_count
                }));
                setLeaderboardTeam(teamEntries);
            }
        }

        return { individual: individualEntries, team: teamEntries };
    } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
        leaderboardError.set(error.message);
        return { individual: [], team: [] };
    } finally {
        leaderboardLoading.set(false);
    }
}

// ============================================================================
// AWARD FUNCTIONS
// ============================================================================

function transformAward(row) {
    return {
        id: row.id,
        instanceId: row.instance_id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        badgeImageUrl: row.badge_image_url,
        category: row.category,
        gameType: row.game_type,
        criteria: row.criteria || {},
        rarity: row.rarity,
        pointsValue: row.points_value,
        maxPerPerson: row.max_per_person,
        isAutomatic: row.is_automatic,
        isActive: row.is_active,
        sortOrder: row.sort_order
    };
}

function transformPlayerAward(row) {
    return {
        id: row.id,
        awardId: row.award_id,
        membershipId: row.membership_id,
        teamId: row.team_id,
        sessionId: row.session_id,
        reason: row.reason,
        awardedByMembershipId: row.awarded_by_membership_id,
        isAutomatic: row.is_automatic,
        metadata: row.metadata || {},
        awardedAt: row.awarded_at,
        award: row.game_awards ? transformAward(row.game_awards) : null
    };
}

export async function fetchGameAwards() {
    const supabase = getSupabase();
    awardsLoading.set(true);
    awardsError.set(null);

    try {
        const membershipId = await getActiveMembershipId();
        let instanceId = null;

        if (membershipId) {
            const { data: membership } = await supabase
                .from('instance_memberships')
                .select('instance_id')
                .eq('id', membershipId)
                .single();
            instanceId = membership?.instance_id;
        }

        // Fetch global awards and instance-specific awards
        let query = supabase
            .from('game_awards')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (instanceId) {
            query = query.or(`instance_id.is.null,instance_id.eq.${instanceId}`);
        } else {
            query = query.is('instance_id', null);
        }

        const { data, error } = await query;

        if (error) throw error;

        const awards = (data || []).map(transformAward);
        setGameAwards(awards);
        return awards;
    } catch (error) {
        console.error('Failed to fetch game awards:', error);
        awardsError.set(error.message);
        return [];
    } finally {
        awardsLoading.set(false);
    }
}

export async function fetchPlayerAwards(membershipId = null) {
    const supabase = getSupabase();

    try {
        let targetMembershipId = membershipId;
        if (!targetMembershipId) {
            targetMembershipId = await getActiveMembershipId();
        }

        if (!targetMembershipId) {
            setPlayerAwards([]);
            return [];
        }

        const { data, error } = await supabase
            .from('game_player_awards')
            .select(`
                *,
                game_awards (*)
            `)
            .eq('membership_id', targetMembershipId)
            .order('awarded_at', { ascending: false });

        if (error) throw error;

        const awards = (data || []).map(transformPlayerAward);
        setPlayerAwards(awards);
        return awards;
    } catch (error) {
        console.error('Failed to fetch player awards:', error);
        return [];
    }
}

export async function grantAward(awardId, membershipId, sessionId = null, reason = null) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to grant awards.');
    }

    const currentMembershipId = await getActiveMembershipId();

    const awardPaId = `gpa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
        .from('game_player_awards')
        .insert([{
            id: awardPaId,
            award_id: awardId,
            membership_id: membershipId,
            session_id: sessionId,
            reason: reason,
            awarded_by_membership_id: currentMembershipId,
            is_automatic: false
        }])
        .select(`
            *,
            game_awards (*)
        `)
        .single();

    if (error) throw error;

    const award = transformPlayerAward(data);
    addPlayerAward(award);
    return award;
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

async function logScoreEvent({
    sessionId,
    membershipId,
    teamId = null,
    pointsDelta,
    reason = null,
    eventType = 'score_adjustment',
    metadata = {}
}) {
    if (!Number.isFinite(pointsDelta) || pointsDelta === 0) return;

    const supabase = getSupabase();
    const createdByMembershipId = await getActiveMembershipId();
    if (!createdByMembershipId) return;

    const payload = {
        id: `gse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        session_id: sessionId,
        membership_id: membershipId,
        team_id: teamId,
        event_type: eventType,
        points_delta: Math.trunc(pointsDelta),
        reason,
        metadata,
        created_by_membership_id: createdByMembershipId
    };

    const { error } = await supabase.from('game_score_events').insert([payload]);
    if (error) {
        // Keep scoring functional even if migration/policy isn't applied yet.
        console.error('Failed to log score event:', error);
    }
}

export async function fetchSessionScores(sessionId) {
    const supabase = getSupabase();

    try {
        let { data, error } = await supabase
            .from('game_players')
            .select(`
                *,
                instance_memberships (display_name, avatar),
                game_teams (name, icon, color)
            `)
            .eq('session_id', sessionId)
            .order('final_score', { ascending: false, nullsFirst: false });

        if (error) {
            const fallback = await supabase
                .from('game_players')
                .select('*')
                .eq('session_id', sessionId)
                .order('final_score', { ascending: false, nullsFirst: false });
            data = fallback.data;
            error = fallback.error;
        }

        if (error) throw error;

        const scores = (data || []).map(row => ({
            id: row.id,
            sessionId: row.session_id,
            membershipId: row.membership_id,
            teamId: row.team_id,
            status: row.status,
            playerState: row.player_state || {},
            finalScore: row.final_score,
            finalRank: row.final_rank,
            pointsEarned: row.points_earned,
            joinedAt: row.joined_at,
            finishedAt: row.finished_at,
            displayName: row.instance_memberships?.display_name,
            avatar: normalizeAvatarUrl(row.instance_memberships?.avatar),
            teamName: row.game_teams?.name,
            teamIcon: row.game_teams?.icon,
            teamColor: row.game_teams?.color
        }));

        setSessionScores(sessionId, scores);
        return scores;
    } catch (error) {
        console.error('Failed to fetch session scores:', error);
        return [];
    }
}

export async function recordPlayerScore(sessionId, membershipId, score, teamId = null) {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to record scores.');
    }

    // Check if player already exists in session
    const { data: existing } = await supabase
        .from('game_players')
        .select('id, final_score')
        .eq('session_id', sessionId)
        .eq('membership_id', membershipId)
        .maybeSingle();

    if (existing) {
        const previousScore = existing.final_score || 0;
        // Update existing score
        const { data, error } = await supabase
            .from('game_players')
            .update({ final_score: score, team_id: teamId })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;

        updateSessionScore(sessionId, membershipId, score);
        await logScoreEvent({
            sessionId,
            membershipId,
            teamId,
            pointsDelta: score - previousScore,
            reason: 'Manual score update',
            metadata: { previousScore, newScore: score }
        });
        return data;
    } else {
        // Create new player entry
        const playerId = `gp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const { data, error } = await supabase
            .from('game_players')
            .insert([{
                id: playerId,
                session_id: sessionId,
                membership_id: membershipId,
                team_id: teamId,
                final_score: score,
                status: 'joined'
            }])
            .select()
            .single();

        if (error) throw error;

        addSessionScore(sessionId, {
            id: playerId,
            membershipId,
            teamId,
            finalScore: score
        });
        await logScoreEvent({
            sessionId,
            membershipId,
            teamId,
            pointsDelta: score,
            reason: 'Initial score set',
            metadata: { previousScore: 0, newScore: score }
        });
        return data;
    }
}

export async function updatePlayerScore(sessionId, membershipId, scoreDelta) {
    const supabase = getSupabase();

    const { data: existing } = await supabase
        .from('game_players')
        .select('id, final_score')
        .eq('session_id', sessionId)
        .eq('membership_id', membershipId)
        .single();

    if (!existing) {
        throw new Error('Player not found in session.');
    }

    const newScore = (existing.final_score || 0) + scoreDelta;

    const { data, error } = await supabase
        .from('game_players')
        .update({ final_score: newScore })
        .eq('id', existing.id)
        .select()
        .single();

    if (error) throw error;

    updateSessionScore(sessionId, membershipId, newScore);
    await logScoreEvent({
        sessionId,
        membershipId,
        pointsDelta: scoreDelta,
        reason: 'Score delta applied',
        metadata: { previousScore: existing.final_score || 0, newScore }
    });
    return data;
}

export async function finalizeSession(sessionId, winnerId = null, winnerType = 'individual') {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to finalize sessions.');
    }

    const updates = {
        status: 'completed',
        ended_at: new Date().toISOString()
    };

    if (winnerId && winnerType === 'team') {
        updates.winning_team_id = winnerId;
    }

    const { data, error } = await supabase
        .from('game_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;

    updateGameSession(sessionId, { status: 'completed' });
    return data;
}

export function subscribeToSessionScores(sessionId, callback) {
    const supabase = getSupabase();

    const subscription = supabase
        .channel(`session-scores-${sessionId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'game_players',
            filter: `session_id=eq.${sessionId}`
        }, (payload) => {
            fetchSessionScores(sessionId);
            callback?.(payload);
        })
        .subscribe();

    return subscription;
}

// ============================================================================
// ROLE MANAGEMENT FUNCTIONS
// ============================================================================

export async function requestGameRole(instanceId, role, reason = '') {
    const supabase = getSupabase();
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to request game roles.');
    }

    const { data, error } = await supabase
        .rpc('request_game_role', {
            p_instance_id: instanceId,
            p_role: role,
            p_reason: reason
        });

    if (error) throw error;
    return data;
}

export async function fetchMyGameRoles(instanceId) {
    const supabase = getSupabase();
    const authUserUuid = await getAuthUserUuid();
    if (!authUserUuid) {
        setGameRoles([]);
        return [];
    }

    gameRolesLoading.set(true);

    const { data, error} = await supabase
        .from('game_roles')
        .select('*')
        .eq('user_id', authUserUuid)
        .eq('instance_id', instanceId)
        .eq('is_active', true);

    if (error) {
        if (error.code === 'PGRST205') {
            // Backward compatibility for deployments where migration_079 hasn't run yet.
            console.warn('game_roles table not found; returning no roles.');
            setGameRoles([]);
            gameRolesLoading.set(false);
            return [];
        }
        console.error('Failed to fetch game roles:', error);
        setGameRoles([]);
        gameRolesLoading.set(false);
        return [];
    }

    const roles = (data || []).map(role => ({
        id: role.id,
        userId: role.user_id,
        instanceId: role.instance_id,
        role: role.role,
        grantedBy: role.granted_by,
        grantedAt: role.granted_at,
        expiresAt: role.expires_at,
        isActive: role.is_active
    }));
    setGameRoles(roles);
    gameRolesLoading.set(false);
    return roles;
}

export async function fetchGameRoleRequests(instanceId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_role_requests')
        .select(`
            *,
            user_profiles!user_id(id, display_name, username, avatar)
        `)
        .eq('instance_id', instanceId)
        .order('requested_at', { ascending: false });

    if (error) {
        console.error('Failed to fetch role requests:', error);
        return [];
    }

    return (data || []).map(req => ({
        id: req.id,
        userId: req.user_id,
        instanceId: req.instance_id,
        requestedRole: req.requested_role,
        reason: req.reason,
        status: req.status,
        requestedAt: req.requested_at,
        reviewedBy: req.reviewed_by,
        reviewedAt: req.reviewed_at,
        user: req.user_profiles ? {
            userId: req.user_profiles.id,
            displayName: req.user_profiles.display_name,
            username: req.user_profiles.username,
            avatar: normalizeAvatarUrl(req.user_profiles.avatar)
        } : null
    }));
}

export async function reviewGameRoleRequest(requestId, status) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .rpc('review_game_role_request', {
            p_request_id: requestId,
            p_status: status
        });

    if (error) throw error;
    return data;
}

// ============================================================================
// LOCATION MANAGEMENT FUNCTIONS
// ============================================================================

export async function fetchGameLocations(instanceId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_locations')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('is_active', true)
        .order('name');

    if (error) {
        console.error('Failed to fetch locations:', error);
        return [];
    }

    return (data || []).map(loc => ({
        id: loc.id,
        instanceId: loc.instance_id,
        name: loc.name,
        description: loc.description,
        address: loc.address,
        coordinates: loc.coordinates,
        venueType: loc.venue_type,
        capacity: loc.capacity,
        amenities: loc.amenities || [],
        imageUrl: loc.image_url,
        isActive: loc.is_active,
        createdByMembershipId: loc.created_by_membership_id,
        createdAt: loc.created_at
    }));
}

export async function createGameLocation(instanceId, locationData) {
    const supabase = getSupabase();
    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Please sign in to create locations.');
    }

    const locationId = `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await supabase
        .from('game_locations')
        .insert([{
            id: locationId,
            instance_id: instanceId,
            created_by_membership_id: membershipId,
            name: locationData.name,
            description: locationData.description,
            address: locationData.address,
            coordinates: locationData.coordinates,
            venue_type: locationData.venueType || 'office',
            capacity: locationData.capacity,
            amenities: locationData.amenities || [],
            image_url: locationData.imageUrl
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        instanceId: data.instance_id,
        name: data.name,
        description: data.description,
        address: data.address,
        coordinates: data.coordinates,
        venueType: data.venue_type,
        capacity: data.capacity,
        amenities: data.amenities || [],
        imageUrl: data.image_url,
        createdAt: data.created_at
    };
}

export async function updateGameLocation(locationId, updates) {
    const supabase = getSupabase();

    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.coordinates !== undefined) dbUpdates.coordinates = updates.coordinates;
    if (updates.venueType !== undefined) dbUpdates.venue_type = updates.venueType;
    if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;
    if (updates.amenities !== undefined) dbUpdates.amenities = updates.amenities;
    if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('game_locations')
        .update(dbUpdates)
        .eq('id', locationId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteGameLocation(locationId) {
    const supabase = getSupabase();

    const { error } = await supabase
        .from('game_locations')
        .delete()
        .eq('id', locationId);

    if (error) throw error;
    return true;
}

// ============================================================================
// HIGHLIGHT MANAGEMENT FUNCTIONS
// ============================================================================

export async function createHighlight(sessionId, highlightData) {
    const supabase = getSupabase();
    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Please sign in to create highlights.');
    }

    const highlightId = `hl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await supabase
        .from('game_highlights')
        .insert([{
            id: highlightId,
            session_id: sessionId,
            created_by_membership_id: membershipId,
            membership_id: highlightData.membershipId,
            team_id: highlightData.teamId,
            highlight_type: highlightData.type,
            title: highlightData.title,
            description: highlightData.description,
            media_url: highlightData.mediaUrl,
            media_type: highlightData.mediaType,
            timestamp_in_game: highlightData.timestampInGame,
            is_featured: highlightData.isFeatured || false
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        sessionId: data.session_id,
        membershipId: data.membership_id,
        teamId: data.team_id,
        type: data.highlight_type,
        title: data.title,
        description: data.description,
        mediaUrl: data.media_url,
        mediaType: data.media_type,
        timestampInGame: data.timestamp_in_game,
        reactions: data.reactions,
        isFeatured: data.is_featured,
        createdAt: data.created_at
    };
}

export async function fetchSessionHighlights(sessionId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_highlights')
        .select(`
            *,
            instance_memberships!membership_id(id, display_name, avatar),
            game_teams(id, name, icon, color)
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Failed to fetch highlights:', error);
        return [];
    }

    return (data || []).map(hl => ({
        id: hl.id,
        sessionId: hl.session_id,
        membershipId: hl.membership_id,
        teamId: hl.team_id,
        type: hl.highlight_type,
        title: hl.title,
        description: hl.description,
        mediaUrl: hl.media_url,
        mediaType: hl.media_type,
        timestampInGame: hl.timestamp_in_game,
        reactions: hl.reactions || { likes: 0, loves: 0, fire: 0, clap: 0 },
        isFeatured: hl.is_featured,
        createdAt: hl.created_at,
        player: hl.instance_memberships ? {
            id: hl.instance_memberships.id,
            displayName: hl.instance_memberships.display_name,
            avatar: normalizeAvatarUrl(hl.instance_memberships.avatar)
        } : null,
        team: hl.game_teams ? {
            id: hl.game_teams.id,
            name: hl.game_teams.name,
            icon: hl.game_teams.icon,
            color: hl.game_teams.color
        } : null
    }));
}

export async function updateHighlightReactions(highlightId, reactionType) {
    const supabase = getSupabase();

    // Get current reactions
    const { data: current, error: fetchError } = await supabase
        .from('game_highlights')
        .select('reactions')
        .eq('id', highlightId)
        .single();

    if (fetchError) throw fetchError;

    const reactions = current.reactions || { likes: 0, loves: 0, fire: 0, clap: 0 };
    reactions[reactionType] = (reactions[reactionType] || 0) + 1;

    const { data, error } = await supabase
        .from('game_highlights')
        .update({ reactions, updated_at: new Date().toISOString() })
        .eq('id', highlightId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function toggleHighlightFeatured(highlightId, isFeatured) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_highlights')
        .update({ is_featured: isFeatured, updated_at: new Date().toISOString() })
        .eq('id', highlightId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================================
// TOURNAMENT MANAGEMENT FUNCTIONS
// ============================================================================

export async function createTournament(instanceId, tournamentData) {
    const supabase = getSupabase();
    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Please sign in to create tournaments.');
    }

    const tournamentId = `trn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await supabase
        .from('game_tournaments')
        .insert([{
            id: tournamentId,
            instance_id: instanceId,
            organizer_membership_id: membershipId,
            name: tournamentData.name,
            description: tournamentData.description,
            icon: tournamentData.icon || '🏆',
            banner_image_url: tournamentData.bannerImageUrl,
            tournament_type: tournamentData.tournamentType || 'single_elimination',
            game_template_id: tournamentData.gameTemplateId,
            status: 'upcoming',
            start_date: tournamentData.startDate,
            end_date: tournamentData.endDate,
            registration_deadline: tournamentData.registrationDeadline,
            max_participants: tournamentData.maxParticipants,
            participant_type: tournamentData.participantType || 'individual',
            prize_info: tournamentData.prizeInfo || {},
            rules: tournamentData.rules
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        instanceId: data.instance_id,
        name: data.name,
        description: data.description,
        icon: data.icon,
        bannerImageUrl: data.banner_image_url,
        tournamentType: data.tournament_type,
        gameTemplateId: data.game_template_id,
        status: data.status,
        startDate: data.start_date,
        endDate: data.end_date,
        registrationDeadline: data.registration_deadline,
        maxParticipants: data.max_participants,
        participantType: data.participant_type,
        prizeInfo: data.prize_info,
        bracketData: data.bracket_data,
        rules: data.rules,
        organizerMembershipId: data.organizer_membership_id,
        createdAt: data.created_at
    };
}

export async function fetchTournaments(instanceId, status = null) {
    const supabase = getSupabase();

    let query = supabase
        .from('game_tournaments')
        .select('*')
        .eq('instance_id', instanceId)
        .order('start_date', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch tournaments:', error);
        return [];
    }

    return (data || []).map(t => ({
        id: t.id,
        instanceId: t.instance_id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        bannerImageUrl: t.banner_image_url,
        tournamentType: t.tournament_type,
        gameTemplateId: t.game_template_id,
        status: t.status,
        startDate: t.start_date,
        endDate: t.end_date,
        registrationDeadline: t.registration_deadline,
        maxParticipants: t.max_participants,
        participantType: t.participant_type,
        prizeInfo: t.prize_info,
        bracketData: t.bracket_data,
        rules: t.rules,
        organizerMembershipId: t.organizer_membership_id,
        createdAt: t.created_at
    }));
}

export async function registerForTournament(tournamentId, teamId = null) {
    const supabase = getSupabase();
    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Please sign in to register for tournaments.');
    }

    const participantId = `tp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await supabase
        .from('game_tournament_participants')
        .insert([{
            id: participantId,
            tournament_id: tournamentId,
            membership_id: teamId ? null : membershipId,
            team_id: teamId,
            status: 'registered'
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function withdrawFromTournament(tournamentId) {
    const supabase = getSupabase();
    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Please sign in.');
    }

    const { error } = await supabase
        .from('game_tournament_participants')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('membership_id', membershipId);

    if (error) throw error;
    return true;
}

export async function updateTournamentBracket(tournamentId, bracketData) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_tournaments')
        .update({
            bracket_data: bracketData,
            updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateTournamentStatus(tournamentId, status) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_tournaments')
        .update({
            status,
            updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function fetchTournamentParticipants(tournamentId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_tournament_participants')
        .select(`
            *,
            instance_memberships(id, display_name, avatar),
            game_teams(id, name, icon, color)
        `)
        .eq('tournament_id', tournamentId)
        .order('registered_at');

    if (error) {
        console.error('Failed to fetch tournament participants:', error);
        return [];
    }

    return (data || []).map(p => ({
        id: p.id,
        tournamentId: p.tournament_id,
        membershipId: p.membership_id,
        teamId: p.team_id,
        seedNumber: p.seed_number,
        status: p.status,
        currentWins: p.current_wins,
        currentLosses: p.current_losses,
        placement: p.placement,
        registeredAt: p.registered_at,
        player: p.instance_memberships ? {
            id: p.instance_memberships.id,
            displayName: p.instance_memberships.display_name,
            avatar: normalizeAvatarUrl(p.instance_memberships.avatar)
        } : null,
        team: p.game_teams ? {
            id: p.game_teams.id,
            name: p.game_teams.name,
            icon: p.game_teams.icon,
            color: p.game_teams.color
        } : null
    }));
}

// ============================================================================
// REFEREE MANAGEMENT FUNCTIONS
// ============================================================================

export async function assignReferee(sessionId, membershipId, refereeRole = 'scorer') {
    const supabase = getSupabase();
    const assignedByMembershipId = await getActiveMembershipId();
    if (!assignedByMembershipId) {
        throw new Error('Please sign in to assign referees.');
    }

    const refereeId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await supabase
        .from('game_referees')
        .insert([{
            id: refereeId,
            session_id: sessionId,
            membership_id: membershipId,
            referee_role: refereeRole,
            assigned_by_membership_id: assignedByMembershipId
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function fetchSessionReferees(sessionId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_referees')
        .select(`
            *,
            instance_memberships(id, display_name, avatar)
        `)
        .eq('session_id', sessionId)
        .order('assigned_at');

    if (error) {
        console.error('Failed to fetch referees:', error);
        return [];
    }

    return (data || []).map(ref => ({
        id: ref.id,
        sessionId: ref.session_id,
        membershipId: ref.membership_id,
        refereeRole: ref.referee_role,
        notes: ref.notes,
        assignedByMembershipId: ref.assigned_by_membership_id,
        assignedAt: ref.assigned_at,
        referee: ref.instance_memberships ? {
            id: ref.instance_memberships.id,
            displayName: ref.instance_memberships.display_name,
            avatar: normalizeAvatarUrl(ref.instance_memberships.avatar)
        } : null
    }));
}

export async function updateRefereeNotes(refereeId, notes) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_referees')
        .update({
            notes,
            updated_at: new Date().toISOString()
        })
        .eq('id', refereeId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function removeReferee(refereeId) {
    const supabase = getSupabase();

    const { error } = await supabase
        .from('game_referees')
        .delete()
        .eq('id', refereeId);

    if (error) throw error;
    return true;
}

// ============================================================================
// INSTANCE MEMBERSHIP FUNCTIONS
// ============================================================================

export async function fetchAvailableInstances() {
    const supabase = getSupabase();
    const userUuid = await getAuthUserUuid();

    if (!userUuid) {
        throw new Error('User not authenticated');
    }

    // Get instances user is NOT already a member of.
    // Some environments do not have deleted_at or icon; query only stable columns first.
    const runInstanceQuery = async ({ includeLogo = true, filterDeleted = true } = {}) => {
        const columns = [
            'id',
            'name',
            'description',
            ...(includeLogo ? ['logo'] : []),
            'member_count:instance_memberships(count)'
        ].join(',');

        let query = supabase
            .from('community_instances')
            .select(columns)
            .order('name', { ascending: true });

        if (filterDeleted) {
            query = query.is('deleted_at', null);
        }

        return query;
    };

    let instances = [];
    let instancesError = null;

    // Preferred: include logo and exclude deleted rows.
    ({ data: instances, error: instancesError } = await runInstanceQuery({ includeLogo: true, filterDeleted: true }));

    // Fallback: schema without deleted_at.
    if (instancesError?.code === '42703' && instancesError?.message?.includes('deleted_at')) {
        ({ data: instances, error: instancesError } = await runInstanceQuery({ includeLogo: true, filterDeleted: false }));
    }

    // Fallback: schema without logo.
    if (instancesError?.code === '42703' && instancesError?.message?.includes('logo')) {
        ({ data: instances, error: instancesError } = await runInstanceQuery({ includeLogo: false, filterDeleted: false }));
    }

    if (instancesError) throw instancesError;

    // Filter out instances user already belongs to
    const { data: userMemberships } = await supabase
        .from('instance_memberships')
        .select('instance_id')
        .eq('user_id', userUuid);

    const userInstanceIds = userMemberships?.map(m => m.instance_id) || [];

    const toCount = (value) => {
        if (typeof value === 'number') return value;
        if (Array.isArray(value)) return Number(value[0]?.count || 0);
        if (value && typeof value === 'object') return Number(value.count || 0);
        return 0;
    };

    return (instances || [])
        .filter(instance => !userInstanceIds.includes(instance.id))
        .map(instance => ({
            ...instance,
            icon: instance.logo || '🏘️',
            member_count: toCount(instance.member_count)
        }));
}

export async function joinInstance(instanceId) {
    const supabase = getSupabase();
    const userUuid = await getAuthUserUuid();

    if (!userUuid) {
        throw new Error('User not authenticated');
    }

    // Check if already a member
    const { data: existing } = await supabase
        .from('instance_memberships')
        .select('id')
        .eq('user_id', userUuid)
        .eq('instance_id', instanceId)
        .single();

    if (existing) {
        throw new Error('Already a member of this community');
    }

    // Create membership
    const { data, error } = await supabase
        .from('instance_memberships')
        .insert({
            user_id: userUuid,
            instance_id: instanceId,
            status: 'active',
            role: 'member'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getUserInstances() {
    const supabase = getSupabase();
    const userUuid = await getAuthUserUuid();

    if (!userUuid) {
        throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
        .from('instance_memberships')
        .select(`
            id,
            user_id,
            instance_id,
            role,
            status,
            community_instances(id, name, logo, description)
        `)
        .eq('user_id', userUuid)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function leaveInstance(membershipId) {
    const supabase = getSupabase();

    const { error } = await supabase
        .from('instance_memberships')
        .update({ status: 'inactive' })
        .eq('id', membershipId);

    if (error) throw error;
    return true;
}
