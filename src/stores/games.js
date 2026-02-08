import { writable, derived } from 'svelte/store';
import { currentUser } from './auth.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const GAME_TYPES = [
    { id: 'nerf-target', label: 'Nerf Target Challenge', icon: '🎯', color: '#F44336' },
    { id: 'trivia', label: 'Trivia', icon: '🧠', color: '#9C27B0' },
    { id: 'puzzle', label: 'Puzzle Challenge', icon: '🧩', color: '#2196F3' },
    { id: 'time-trial', label: 'Time Trial', icon: '⏱️', color: '#FF9800' },
    { id: 'table-tennis', label: 'Table Tennis', icon: '🏓', color: '#4CAF50' },
    { id: 'minute-to-win-it', label: 'Minute to Win It', icon: '⏱️', color: '#E91E63' },
    { id: 'tournament', label: 'Tournament', icon: '🏆', color: '#FFC107' },
    { id: 'skills-check', label: 'Skills Check', icon: '🎯', color: '#00BCD4' }
];

export const PARTICIPATION_MODES = [
    { id: 'individual', label: 'Individual', icon: '👤' },
    { id: 'team', label: 'Team-based', icon: '👥' },
    { id: 'mixed', label: 'Mixed', icon: '👥👤' }
];

export const AWARD_CATEGORIES = [
    { id: 'milestone', label: 'Milestones', icon: '🎯' },
    { id: 'streak', label: 'Streaks', icon: '🔥' },
    { id: 'game_type', label: 'Game Mastery', icon: '🎮' },
    { id: 'team', label: 'Team', icon: '👥' },
    { id: 'special', label: 'Special', icon: '⭐' }
];

export const AWARD_RARITIES = {
    common: { label: 'Common', color: '#9E9E9E' },
    uncommon: { label: 'Uncommon', color: '#4CAF50' },
    rare: { label: 'Rare', color: '#2196F3' },
    epic: { label: 'Epic', color: '#9C27B0' },
    legendary: { label: 'Legendary', color: '#FF9800' }
};

// ============================================================================
// EXISTING STORES - Templates & Sessions
// ============================================================================

export const gameTemplates = writable([]);
export const gameTemplatesLoading = writable(false);
export const gameTemplatesError = writable(null);
export const gameSessions = writable([]);
export const gameSessionsLoading = writable(false);
export const gameSessionsError = writable(null);

// ============================================================================
// NEW STORES - Teams
// ============================================================================

export const gameTeams = writable([]);
export const gameTeamsLoading = writable(false);
export const gameTeamsError = writable(null);

// ============================================================================
// NEW STORES - Leaderboard
// ============================================================================

export const leaderboard = writable({ individual: [], team: [] });
export const leaderboardLoading = writable(false);
export const leaderboardError = writable(null);
export const leaderboardPeriod = writable('all_time'); // 'all_time' | 'monthly' | 'weekly'
export const leaderboardType = writable('individual'); // 'individual' | 'team'

// ============================================================================
// NEW STORES - Awards
// ============================================================================

export const gameAwards = writable([]);
export const playerAwards = writable([]);
export const awardsLoading = writable(false);
export const awardsError = writable(null);

// ============================================================================
// NEW STORES - Live Session Scores
// ============================================================================

export const sessionScores = writable({}); // { [sessionId]: scores[] }

// ============================================================================
// DERIVED STORES
// ============================================================================

// Current user's team
export const myTeam = derived([gameTeams, currentUser], ([$teams, $user]) => {
    if (!$user || !$teams.length) return null;
    const membershipId = $user.membership_id || $user.membershipId;
    if (!membershipId) return null;
    return $teams.find(t =>
        t.members?.some(m => m.membershipId === membershipId && m.status === 'active')
    ) || null;
});

// Top 10 individual players
export const topPlayers = derived(leaderboard, ($lb) =>
    ($lb.individual || []).slice(0, 10)
);

// Top 10 teams
export const topTeams = derived(leaderboard, ($lb) =>
    ($lb.team || []).slice(0, 10)
);

// Count of player's awards
export const myAwardsCount = derived(playerAwards, ($pa) => $pa.length);

// Awards grouped by category
export const awardsByCategory = derived(gameAwards, ($awards) => {
    return AWARD_CATEGORIES.reduce((acc, cat) => {
        acc[cat.id] = $awards.filter(a => a.category === cat.id);
        return acc;
    }, {});
});

// Upcoming sessions (scheduled, not yet started)
export const upcomingSessions = derived(gameSessions, ($sessions) =>
    $sessions
        .filter(s => s.status === 'scheduled' && new Date(s.scheduledStart) > new Date())
        .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))
);

// Active sessions (in progress)
export const activeSessions = derived(gameSessions, ($sessions) =>
    $sessions.filter(s => s.status === 'active')
);

// ============================================================================
// SETTERS - Templates & Sessions
// ============================================================================

export function setGameTemplates(list) {
    gameTemplates.set(list);
}

export function setGameSessions(list) {
    gameSessions.set(list);
}

export function updateGameTemplate(templateId, updates) {
    gameTemplates.update(list =>
        list.map(t => (t.id === templateId ? { ...t, ...updates } : t))
    );
}

export function addGameTemplate(template) {
    gameTemplates.update(list => [template, ...list]);
}

export function removeGameTemplate(templateId) {
    gameTemplates.update(list => list.filter(t => t.id !== templateId));
}

export function addGameSession(session) {
    gameSessions.update(list => [session, ...list]);
}

export function updateGameSession(sessionId, updates) {
    gameSessions.update(list =>
        list.map(s => (s.id === sessionId ? { ...s, ...updates } : s))
    );
}

export function removeGameSession(sessionId) {
    gameSessions.update(list => list.filter(s => s.id !== sessionId));
}

// ============================================================================
// SETTERS - Teams
// ============================================================================

export function setGameTeams(list) {
    gameTeams.set(list);
}

export function addGameTeam(team) {
    gameTeams.update(list => [team, ...list]);
}

export function updateGameTeam(teamId, updates) {
    gameTeams.update(list =>
        list.map(t => (t.id === teamId ? { ...t, ...updates } : t))
    );
}

export function removeGameTeam(teamId) {
    gameTeams.update(list => list.filter(t => t.id !== teamId));
}

// ============================================================================
// SETTERS - Leaderboard
// ============================================================================

export function setLeaderboard(type, entries) {
    leaderboard.update(lb => ({ ...lb, [type]: entries }));
}

export function setLeaderboardIndividual(entries) {
    leaderboard.update(lb => ({ ...lb, individual: entries }));
}

export function setLeaderboardTeam(entries) {
    leaderboard.update(lb => ({ ...lb, team: entries }));
}

// ============================================================================
// SETTERS - Awards
// ============================================================================

export function setGameAwards(list) {
    gameAwards.set(list);
}

export function setPlayerAwards(list) {
    playerAwards.set(list);
}

export function addPlayerAward(award) {
    playerAwards.update(list => [award, ...list]);
}

// ============================================================================
// SETTERS - Session Scores
// ============================================================================

export function setSessionScores(sessionId, scores) {
    sessionScores.update(ss => ({ ...ss, [sessionId]: scores }));
}

export function updateSessionScore(sessionId, participantId, points) {
    sessionScores.update(ss => {
        const sessionData = ss[sessionId] || [];
        const idx = sessionData.findIndex(s => s.participantId === participantId);
        if (idx >= 0) {
            sessionData[idx] = { ...sessionData[idx], points };
            return { ...ss, [sessionId]: [...sessionData] };
        }
        return ss;
    });
}

export function addSessionScore(sessionId, scoreEntry) {
    sessionScores.update(ss => {
        const sessionData = ss[sessionId] || [];
        return { ...ss, [sessionId]: [...sessionData, scoreEntry] };
    });
}

export function clearSessionScores(sessionId) {
    sessionScores.update(ss => {
        const newSs = { ...ss };
        delete newSs[sessionId];
        return newSs;
    });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getGameTypeInfo(gameType) {
    return GAME_TYPES.find(g => g.id === gameType) || { id: gameType, label: gameType, icon: '🎮', color: '#607D8B' };
}

export function getAwardRarityInfo(rarity) {
    return AWARD_RARITIES[rarity] || AWARD_RARITIES.common;
}
