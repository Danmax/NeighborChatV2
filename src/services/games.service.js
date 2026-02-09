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
    const authUserId = await getAuthUserId();
    if (!authUserId) return [];

    const { data, error} = await supabase
        .from('game_roles')
        .select('*')
        .eq('user_id', authUserId)
        .eq('instance_id', instanceId)
        .eq('is_active', true);

    if (error) {
        console.error('Failed to fetch game roles:', error);
        return [];
    }

    return (data || []).map(role => ({
        id: role.id,
        userId: role.user_id,
        instanceId: role.instance_id,
        role: role.role,
        grantedBy: role.granted_by,
        grantedAt: role.granted_at,
        expiresAt: role.expires_at,
        isActive: role.is_active
    }));
}

export async function fetchGameRoleRequests(instanceId) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('game_role_requests')
        .select(`
            *,
            user_profiles!user_id(user_id, display_name, username, avatar)
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
            userId: req.user_profiles.user_id,
            displayName: req.user_profiles.display_name,
            username: req.user_profiles.username,
            avatar: req.user_profiles.avatar
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
            avatar: hl.instance_memberships.avatar
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
            avatar: p.instance_memberships.avatar
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
            avatar: ref.instance_memberships.avatar
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
