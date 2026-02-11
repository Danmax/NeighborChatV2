<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { currentUser } from '../../stores/auth.js';
    import { playerAwards, gameSessions, gameRoles, leaderboard, myTeam } from '../../stores/games.js';
    import { fetchMyGameRoles, fetchPlayerAwards, fetchGameSessions } from '../../services/games.service.js';
    import { getGameTypeInfo } from '../../stores/games.js';

    export let instanceId;
    export let profileName = '';
    export let profileAvatar = '';
    export let profileSkillLevel = '';
    export let profileActionLabel = 'Edit Profile';

    const dispatch = createEventDispatcher();

    let loading = true;
    let stats = {
        totalGamesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalPoints: 0,
        averagePoints: 0,
        currentStreak: 0,
        bestStreak: 0,
        rank: '-',
        topThree: 0
    };

    $: upcomingSessions = $gameSessions
        .filter(s => s.status === 'scheduled' && new Date(s.scheduledStart) > new Date())
        .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))
        .slice(0, 5);

    $: recentSessions = $gameSessions
        .filter(s => s.status === 'completed')
        .sort((a, b) => new Date(b.actualEnd || b.scheduledStart) - new Date(a.actualEnd || a.scheduledStart))
        .slice(0, 5);

    $: recentAwards = $playerAwards
        .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt))
        .slice(0, 6);

    $: myRoles = $gameRoles.filter(r => r.isActive);
    $: displayName = profileName?.trim() || $currentUser?.displayName || $currentUser?.name || 'Player';
    $: avatarValue = profileAvatar?.trim() || $currentUser?.avatar || '';
    $: avatarIsImage = /^https?:\/\//i.test(avatarValue) || avatarValue.startsWith('data:image/');
    $: avatarFallback = avatarValue || displayName[0]?.toUpperCase() || 'P';
    $: skillLabel = profileSkillLevel
        ? `${profileSkillLevel[0].toUpperCase()}${profileSkillLevel.slice(1)} skill level`
        : 'Complete your game profile';

    $: {
        if ($currentUser && $gameSessions.length > 0) {
            calculateStats();
        }
    }

    function calculateStats() {
        const membershipId = $currentUser?.membership_id || $currentUser?.membershipId;
        if (!membershipId) return;

        const completedGames = $gameSessions.filter(s => s.status === 'completed');
        stats.totalGamesPlayed = completedGames.length;

        // Calculate wins/losses (simplified - assumes winner is player with most points)
        let wins = 0;
        let totalPoints = 0;

        completedGames.forEach(session => {
            const playerScore = session.players?.find(p => p.membershipId === membershipId);
            if (playerScore) {
                totalPoints += playerScore.finalScore || 0;
                if (playerScore.placement === 1) wins++;
            }
        });

        stats.wins = wins;
        stats.losses = stats.totalGamesPlayed - wins;
        stats.winRate = stats.totalGamesPlayed > 0 ? Math.round((wins / stats.totalGamesPlayed) * 100) : 0;
        stats.totalPoints = totalPoints;
        stats.averagePoints = stats.totalGamesPlayed > 0 ? Math.round(totalPoints / stats.totalGamesPlayed) : 0;

        // Find rank in leaderboard
        const myEntry = $leaderboard.individual?.find(e => e.membershipId === membershipId);
        if (myEntry) {
            const rankIndex = $leaderboard.individual.findIndex(e => e.membershipId === membershipId);
            stats.rank = rankIndex >= 0 ? `#${rankIndex + 1}` : '-';
        }

        // Count top 3 finishes
        stats.topThree = completedGames.filter(session => {
            const playerScore = session.players?.find(p => p.membershipId === membershipId);
            return playerScore && playerScore.placement && playerScore.placement <= 3;
        }).length;
    }

    function getRoleIcon(role) {
        const icons = {
            game_manager: '🎮',
            team_lead: '👥',
            referee: '⚖️'
        };
        return icons[role] || '🎯';
    }

    function getRoleLabel(role) {
        const labels = {
            game_manager: 'Game Manager',
            team_lead: 'Team Lead',
            referee: 'Referee'
        };
        return labels[role] || role;
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = date - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatTime(dateStr) {
        return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function handleEditProfile() {
        dispatch('editProfile');
    }

    onMount(async () => {
        loading = true;
        try {
            await Promise.all([
                fetchMyGameRoles(instanceId),
                fetchPlayerAwards(),
                fetchGameSessions(instanceId)
            ]);
        } catch (err) {
            console.error('Failed to load dashboard:', err);
        } finally {
            loading = false;
        }
    });
</script>

<div class="user-dashboard">
    {#if loading}
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading your dashboard...</p>
        </div>
    {:else}
        <!-- Header Section -->
        <div class="dashboard-header">
            <div class="dashboard-header-main">
                <div class="user-info">
                    <div class="user-avatar">
                        {#if avatarIsImage}
                            <img src={avatarValue} alt={displayName} />
                        {:else}
                            <span>{avatarFallback}</span>
                        {/if}
                    </div>
                    <div class="user-details">
                        <h2>{displayName}</h2>
                        <p class="profile-subtitle">{skillLabel}</p>
                        {#if myRoles.length > 0}
                            <div class="role-badges">
                                {#each myRoles as role}
                                    <span class="role-badge">
                                        {getRoleIcon(role.role)} {getRoleLabel(role.role)}
                                    </span>
                                {/each}
                            </div>
                        {/if}
                        {#if $myTeam}
                            <div class="team-badge">
                                <span class="team-icon">{$myTeam.icon}</span>
                                <span class="team-name">{$myTeam.name}</span>
                            </div>
                        {/if}
                    </div>
                </div>
                <button class="btn btn-secondary btn-small profile-action-btn" type="button" on:click={handleEditProfile}>
                    {profileActionLabel}
                </button>
            </div>
        </div>

        <!-- Stats Grid -->
        <div class="stats-grid">
            <div class="stat-card primary">
                <div class="stat-icon">🏆</div>
                <div class="stat-value">{stats.rank}</div>
                <div class="stat-label">Leaderboard Rank</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">🎮</div>
                <div class="stat-value">{stats.totalGamesPlayed}</div>
                <div class="stat-label">Games Played</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-value">{stats.wins}</div>
                <div class="stat-label">Wins</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value">{stats.winRate}%</div>
                <div class="stat-label">Win Rate</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <div class="stat-value">{stats.totalPoints}</div>
                <div class="stat-label">Total Points</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">🥇</div>
                <div class="stat-value">{stats.topThree}</div>
                <div class="stat-label">Top 3 Finishes</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">🎖️</div>
                <div class="stat-value">{$playerAwards.length}</div>
                <div class="stat-label">Awards Earned</div>
            </div>

            <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-value">{stats.averagePoints}</div>
                <div class="stat-label">Avg Points/Game</div>
            </div>
        </div>

        <!-- Recent Awards -->
        {#if recentAwards.length > 0}
            <div class="section">
                <h3 class="section-title">Recent Awards</h3>
                <div class="awards-grid">
                    {#each recentAwards as award}
                        <div class="award-card">
                            <div class="award-icon">{award.icon || '🏅'}</div>
                            <div class="award-info">
                                <div class="award-name">{award.name}</div>
                                <div class="award-date">{formatDate(award.earnedAt)}</div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Upcoming Sessions -->
        {#if upcomingSessions.length > 0}
            <div class="section">
                <h3 class="section-title">Upcoming Games</h3>
                <div class="sessions-list">
                    {#each upcomingSessions as session}
                        <div class="session-card">
                            <div class="session-game-type">
                                <span class="game-icon">{getGameTypeInfo(session.gameType).icon}</span>
                                <span class="game-name">{getGameTypeInfo(session.gameType).label}</span>
                            </div>
                            <div class="session-details">
                                <div class="session-time">
                                    <span class="time-icon">📅</span>
                                    <span>{formatDate(session.scheduledStart)}</span>
                                    <span class="time-icon">🕐</span>
                                    <span>{formatTime(session.scheduledStart)}</span>
                                </div>
                                {#if session.location}
                                    <div class="session-location">
                                        <span class="location-icon">📍</span>
                                        <span>{session.location}</span>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Recent Match History -->
        {#if recentSessions.length > 0}
            <div class="section">
                <h3 class="section-title">Recent Matches</h3>
                <div class="sessions-list">
                    {#each recentSessions as session}
                        {@const membershipId = $currentUser?.membership_id || $currentUser?.membershipId}
                        {@const myScore = session.players?.find(p => p.membershipId === membershipId)}
                        <div class="session-card completed">
                            <div class="session-game-type">
                                <span class="game-icon">{getGameTypeInfo(session.gameType).icon}</span>
                                <span class="game-name">{getGameTypeInfo(session.gameType).label}</span>
                            </div>
                            <div class="session-details">
                                <div class="session-result">
                                    {#if myScore}
                                        <span class="result-badge" class:winner={myScore.placement === 1}>
                                            {myScore.placement === 1 ? '🥇 Winner' : `#${myScore.placement || '-'}`}
                                        </span>
                                        <span class="score-value">{myScore.finalScore || 0} pts</span>
                                    {:else}
                                        <span class="result-badge">Not Participated</span>
                                    {/if}
                                </div>
                                <div class="session-date">
                                    {formatDate(session.actualEnd || session.scheduledStart)}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Empty States -->
        {#if upcomingSessions.length === 0 && recentSessions.length === 0}
            <div class="empty-state">
                <span class="empty-icon">🎮</span>
                <h3>No Games Yet</h3>
                <p>Join your first game session to start tracking your stats!</p>
            </div>
        {/if}
    {/if}
</div>

<style>
    .user-dashboard {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
    }

    .loading-state {
        text-align: center;
        padding: 60px 20px;
        color: #666;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f0f0f0;
        border-top-color: #4CAF50;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .dashboard-header {
        background: white;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .dashboard-header-main {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
    }

    .user-info {
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 0;
    }

    .user-avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .user-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .user-avatar span {
        font-size: 24px;
        font-weight: 700;
        color: white;
    }

    .user-details h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: #333;
    }

    .profile-subtitle {
        margin: 2px 0 8px;
        font-size: 13px;
        color: #666;
        font-weight: 500;
    }

    .role-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
    }

    .role-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 11px;
        font-weight: 600;
        border-radius: 12px;
        text-transform: uppercase;
    }

    .team-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: #e8f5e9;
        color: #2E7D32;
        font-size: 13px;
        font-weight: 600;
        border-radius: 12px;
    }

    .team-icon {
        font-size: 14px;
    }

    .profile-action-btn {
        white-space: nowrap;
        align-self: center;
        flex-shrink: 0;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }

    .stat-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .stat-card.primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }

    .stat-icon {
        font-size: 28px;
        margin-bottom: 8px;
    }

    .stat-value {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 4px;
    }

    .stat-label {
        font-size: 12px;
        opacity: 0.8;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .section {
        background: white;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .section-title {
        margin: 0 0 16px;
        font-size: 18px;
        font-weight: 700;
        color: #333;
    }

    .awards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 12px;
    }

    .award-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #f8f8f8;
        border-radius: 8px;
        transition: background 0.2s;
    }

    .award-card:hover {
        background: #f0f0f0;
    }

    .award-icon {
        font-size: 32px;
        flex-shrink: 0;
    }

    .award-info {
        flex: 1;
        min-width: 0;
    }

    .award-name {
        font-size: 13px;
        font-weight: 600;
        color: #333;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .award-date {
        font-size: 11px;
        color: #666;
        margin-top: 2px;
    }

    .sessions-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .session-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        background: #f8f8f8;
        border-radius: 12px;
        transition: background 0.2s;
    }

    .session-card:hover {
        background: #f0f0f0;
    }

    .session-card.completed {
        border-left: 4px solid #4CAF50;
    }

    .session-game-type {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .game-icon {
        font-size: 24px;
    }

    .game-name {
        font-size: 14px;
        font-weight: 600;
        color: #333;
    }

    .session-details {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
    }

    .session-time,
    .session-location {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #666;
    }

    .time-icon,
    .location-icon {
        font-size: 12px;
    }

    .session-result {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .result-badge {
        padding: 4px 10px;
        background: #e0e0e0;
        color: #666;
        font-size: 12px;
        font-weight: 600;
        border-radius: 12px;
    }

    .result-badge.winner {
        background: #FFD700;
        color: #855800;
    }

    .score-value {
        font-size: 14px;
        font-weight: 700;
        color: #4CAF50;
    }

    .session-date {
        font-size: 12px;
        color: #999;
    }

    .empty-state {
        text-align: center;
        padding: 60px 20px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .empty-icon {
        font-size: 64px;
        display: block;
        margin-bottom: 16px;
    }

    .empty-state h3 {
        margin: 0 0 8px;
        font-size: 20px;
        font-weight: 700;
        color: #333;
    }

    .empty-state p {
        margin: 0;
        color: #666;
        font-size: 14px;
    }

    @media (max-width: 768px) {
        .user-dashboard {
            padding: 12px;
        }

        .dashboard-header-main {
            flex-direction: column;
            align-items: stretch;
        }

        .profile-action-btn {
            width: 100%;
        }

        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }

        .awards-grid {
            grid-template-columns: 1fr;
        }

        .session-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
        }

        .session-details {
            align-items: flex-start;
            width: 100%;
        }
    }
</style>
