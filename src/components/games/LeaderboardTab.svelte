<script>
    import { onMount } from 'svelte';
    import {
        leaderboard,
        leaderboardLoading,
        leaderboardPeriod,
        leaderboardType,
        topPlayers,
        topTeams,
        GAME_TYPES
    } from '../../stores/games.js';
    import { fetchLeaderboard } from '../../services/games.service.js';
    import { currentUser } from '../../stores/auth.js';

    let viewType = 'individual';
    let period = 'all_time';
    let gameTypeFilter = null;

    $: entries = viewType === 'individual' ? $leaderboard.individual : $leaderboard.team;
    $: currentMembershipId = $currentUser?.membership_id || $currentUser?.membershipId;

    function getMedalEmoji(rank) {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return rank;
    }

    function handleRefresh() {
        fetchLeaderboard({ period, participantType: viewType, gameType: gameTypeFilter });
    }

    onMount(() => {
        handleRefresh();
    });

    $: {
        // Refetch when filters change
        if (viewType || period || gameTypeFilter !== undefined) {
            fetchLeaderboard({ period, participantType: viewType, gameType: gameTypeFilter });
        }
    }
</script>

<div class="leaderboard-tab">
    <!-- Filters -->
    <div class="filters">
        <div class="filter-group">
            <button
                class="filter-btn"
                class:active={viewType === 'individual'}
                on:click={() => viewType = 'individual'}
            >
                👤 Individual
            </button>
            <button
                class="filter-btn"
                class:active={viewType === 'team'}
                on:click={() => viewType = 'team'}
            >
                👥 Teams
            </button>
        </div>

        <div class="filter-group">
            <select bind:value={period} class="period-select">
                <option value="all_time">All Time</option>
                <option value="monthly">This Month</option>
                <option value="weekly">This Week</option>
            </select>
        </div>
    </div>

    <!-- Leaderboard Table -->
    {#if $leaderboardLoading}
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading leaderboard...</p>
        </div>
    {:else if entries.length === 0}
        <div class="empty-state">
            <span class="empty-icon">🏆</span>
            <p>No rankings yet. Play some games to get on the leaderboard!</p>
        </div>
    {:else}
        <div class="leaderboard-list">
            {#each entries as entry, idx}
                <div
                    class="leaderboard-row"
                    class:top-three={entry.rank <= 3}
                    class:is-me={viewType === 'individual' && entry.membershipId === currentMembershipId}
                >
                    <div class="rank" class:medal={entry.rank <= 3}>
                        {getMedalEmoji(entry.rank)}
                    </div>

                    {#if viewType === 'individual'}
                        <div class="participant">
                            <div class="avatar">
                                {#if entry.avatar}
                                    <img src={entry.avatar} alt={entry.displayName} />
                                {:else}
                                    <span class="avatar-placeholder">{(entry.displayName || '?')[0].toUpperCase()}</span>
                                {/if}
                            </div>
                            <div class="participant-info">
                                <span class="name">{entry.displayName || 'Unknown'}</span>
                                {#if entry.currentWinStreak >= 3}
                                    <span class="streak-badge">🔥 {entry.currentWinStreak}</span>
                                {/if}
                            </div>
                        </div>
                    {:else}
                        <div class="participant">
                            <div class="team-icon" style="background: {entry.color || '#5c34a5'}">
                                {entry.icon || '🎮'}
                            </div>
                            <div class="participant-info">
                                <span class="name">{entry.teamName || 'Unknown Team'}</span>
                                <span class="member-count">{entry.memberCount || 0} members</span>
                            </div>
                        </div>
                    {/if}

                    <div class="stats">
                        <div class="stat-item">
                            <span class="stat-value">{viewType === 'individual' ? entry.totalScore : entry.totalPoints}</span>
                            <span class="stat-label">pts</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">{viewType === 'individual' ? entry.gamesWon : entry.totalWins}</span>
                            <span class="stat-label">wins</span>
                        </div>
                        <div class="stat-item win-rate">
                            <span class="stat-value">{entry.winRate || 0}%</span>
                            <span class="stat-label">rate</span>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .leaderboard-tab {
        padding: 0;
    }

    .filters {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        flex-wrap: wrap;
        gap: 12px;
    }

    .filter-group {
        display: flex;
        gap: 8px;
    }

    .filter-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 20px;
        background: #f0f0f0;
        font-size: 13px;
        font-weight: 600;
        color: #666;
        cursor: pointer;
        transition: all 0.2s;
    }

    .filter-btn:hover {
        background: #e0e0e0;
    }

    .filter-btn.active {
        background: #4CAF50;
        color: white;
    }

    .period-select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 13px;
        background: white;
        cursor: pointer;
    }

    .loading-state,
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f0f0f0;
        border-top-color: #4CAF50;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 12px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .empty-icon {
        font-size: 48px;
        display: block;
        margin-bottom: 12px;
    }

    .leaderboard-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .leaderboard-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: white;
        border-radius: 12px;
        transition: all 0.2s;
    }

    .leaderboard-row:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .leaderboard-row.top-three {
        background: linear-gradient(135deg, #fff9e6 0%, #fff 100%);
    }

    .leaderboard-row.is-me {
        background: linear-gradient(135deg, #e8f5e9 0%, #fff 100%);
        border: 2px solid #4CAF50;
    }

    .rank {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        color: #999;
        background: #f5f5f5;
        border-radius: 8px;
    }

    .rank.medal {
        background: transparent;
        font-size: 24px;
    }

    .participant {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
    }

    .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        overflow: hidden;
        background: #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-placeholder {
        font-size: 16px;
        font-weight: 600;
        color: #666;
    }

    .team-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
    }

    .participant-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .name {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .member-count {
        font-size: 11px;
        color: #888;
    }

    .streak-badge {
        font-size: 11px;
        color: #FF5722;
        font-weight: 600;
    }

    .stats {
        display: flex;
        gap: 16px;
    }

    .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 40px;
    }

    .stat-value {
        font-size: 16px;
        font-weight: 700;
        color: #333;
    }

    .stat-label {
        font-size: 10px;
        color: #999;
        text-transform: uppercase;
    }

    .win-rate .stat-value {
        color: #4CAF50;
    }

    @media (max-width: 480px) {
        .stats {
            gap: 10px;
        }

        .stat-item.win-rate {
            display: none;
        }
    }
</style>
