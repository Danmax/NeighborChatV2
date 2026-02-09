import { getSupabase, getAuthUserId } from '../lib/supabase.js';
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
    updateGameSession
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

// ============================================================================
// TEMPLATE CRUD FUNCTIONS (Admin/Moderator only)
// ============================================================================

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
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to create game templates.');
    }

    const membershipId = await getActiveMembershipId();
    if (!membershipId) {
        throw new Error('Join a community to create game templates.');
    }

    const { data: membership } = await supabase
        .from('instance_memberships')
        .select('instance_id, role')
        .eq('id', membershipId)
        .single();

    if (!membership?.instance_id) {
        throw new Error('Unable to resolve instance.');
    }

    if (!['admin', 'moderator'].includes(membership.role)) {
        throw new Error('Only admins and moderators can create game templates.');
    }

    const templateId = `game_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
        id: templateId,
        instance_id: membership.instance_id,
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
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to update game templates.');
    }

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
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        throw new Error('Please sign in to delete game templates.');
    }

    const { error } = await supabase
        .from('game_templates')
        .delete()
        .eq('id', templateId);

    if (error) throw error;

    removeGameTemplate(templateId);
    return true;
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

        const { data, error } = await supabase
            .from('game_sessions')
            .select('id, name, scheduled_start, status, settings, template_id, host_membership_id, created_at')
            .eq('instance_id', membership.instance_id)
            .order('scheduled_start', { ascending: true });

        if (error) throw error;
        const sessions = (data || []).map(row => ({
            id: row.id,
            name: row.name,
            scheduledStart: row.scheduled_start,
            status: row.status,
            settings: row.settings || {},
            templateId: row.template_id,
            hostMembershipId: row.host_membership_id,
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
            started_at: new Date().toISOString()
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
        .select(`
            *,
            instance_memberships (display_name, avatar)
        `)
        .single();

    if (error) throw error;

    addSessionScore(sessionId, {
        id: playerId,
        membershipId,
        teamId,
        finalScore: 0,
        displayName: data.instance_memberships?.display_name,
        avatar: data.instance_memberships?.avatar
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
        avatar: m.avatar,
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
            avatar: m.instance_memberships?.avatar
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
                    instance_memberships (display_name, avatar)
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
            instance_memberships (display_name, avatar)
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
                const entries = (individualData || []).map((row, idx) => ({
                    rank: idx + 1,
                    membershipId: row.membership_id,
                    displayName: row.display_name,
                    avatar: row.avatar,
                    gameType: row.game_type,
                    gamesPlayed: row.games_played,
                    gamesWon: row.games_won,
                    totalScore: row.total_score,
                    bestScore: row.best_score,
                    winRate: row.win_rate,
                    currentWinStreak: row.current_win_streak,
                    bestWinStreak: row.best_win_streak
                }));
                setLeaderboardIndividual(entries);
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
                const entries = (teamData || []).map((row, idx) => ({
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
                setLeaderboardTeam(entries);
            }
        }

        return { individual: [], team: [] };
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

export async function fetchSessionScores(sessionId) {
    const supabase = getSupabase();

    try {
        const { data, error } = await supabase
            .from('game_players')
            .select(`
                *,
                instance_memberships (display_name, avatar),
                game_teams (name, icon, color)
            `)
            .eq('session_id', sessionId)
            .order('final_score', { ascending: false, nullsFirst: false });

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
            avatar: row.instance_memberships?.avatar,
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
        .select('id')
        .eq('session_id', sessionId)
        .eq('membership_id', membershipId)
        .maybeSingle();

    if (existing) {
        // Update existing score
        const { data, error } = await supabase
            .from('game_players')
            .update({ final_score: score, team_id: teamId })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;

        updateSessionScore(sessionId, membershipId, score);
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
