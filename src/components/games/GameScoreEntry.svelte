<script>
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { sessionScores } from '../../stores/games.js';
    import { fetchSessionScores, recordPlayerScore, updatePlayerScore, subscribeToSessionScores, removePlayerFromSession } from '../../services/games.service.js';
    import { showToast } from '../../stores/toasts.js';

    export let sessionId;
    export let isHost = false;
    export let teamMode = 'individual'; // 'individual' | 'team'

    const dispatch = createEventDispatcher();

    let scores = [];
    let subscription = null;
    let loading = false;
    let removingPlayer = {};

    $: scores = $sessionScores[sessionId] || [];
    $: sortedScores = [...scores].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    // Group by team if team mode
    $: teamScores = teamMode === 'team'
        ? groupByTeam(sortedScores)
        : null;

    function groupByTeam(playerScores) {
        const teams = {};
        playerScores.forEach(p => {
            const teamId = p.teamId || 'no-team';
            if (!teams[teamId]) {
                teams[teamId] = {
                    teamId,
                    teamName: p.teamName || 'Unassigned',
                    teamIcon: p.teamIcon || '👥',
                    teamColor: p.teamColor || '#666',
                    totalScore: 0,
                    players: []
                };
            }
            teams[teamId].players.push(p);
            teams[teamId].totalScore += (p.finalScore || 0);
        });
        return Object.values(teams).sort((a, b) => b.totalScore - a.totalScore);
    }

    async function handleScoreChange(membershipId, delta) {
        if (!isHost) return;
        loading = true;
        try {
            await updatePlayerScore(sessionId, membershipId, delta);
        } catch (err) {
            console.error('Failed to update score:', err);
            showToast(err.message || 'Failed to update score', 'error');
        } finally {
            loading = false;
        }
    }

    async function handleRemovePlayer(membershipId, playerName) {
        if (!isHost) return;
        if (!confirm(`Remove ${playerName || 'this player'} from the session?`)) return;

        removingPlayer[membershipId] = true;
        try {
            await removePlayerFromSession(sessionId, membershipId);
        } catch (err) {
            console.error('Failed to remove player:', err);
        } finally {
            removingPlayer[membershipId] = false;
        }
    }

    function getRankEmoji(idx) {
        if (idx === 0) return '🥇';
        if (idx === 1) return '🥈';
        if (idx === 2) return '🥉';
        return `#${idx + 1}`;
    }

    onMount(async () => {
        await fetchSessionScores(sessionId);
        subscription = subscribeToSessionScores(sessionId, () => {
            fetchSessionScores(sessionId);
        });
    });

    onDestroy(() => {
        subscription?.unsubscribe();
    });
</script>

<div class="score-entry">
    <div class="score-header">
        <h3>Live Scoreboard</h3>
        {#if isHost}
            <span class="host-badge">Host Controls</span>
        {/if}
    </div>

    {#if teamMode === 'team' && teamScores}
        <!-- Team View -->
        <div class="teams-list">
            {#each teamScores as team, teamIdx}
                <div class="team-block" style="--team-color: {team.teamColor}">
                    <div class="team-header-row">
                        <span class="team-rank">{getRankEmoji(teamIdx)}</span>
                        <span class="team-icon-small">{team.teamIcon}</span>
                        <span class="team-name-text">{team.teamName}</span>
                        <span class="team-total">{team.totalScore} pts</span>
                    </div>
                    <div class="team-players">
                        {#each team.players as player}
                            <div class="player-row">
                                <div class="player-info">
                                    <div class="player-avatar">
                                        {#if player.avatar}
                                            <img src={player.avatar} alt={player.displayName} />
                                        {:else}
                                            <span>{(player.displayName || '?')[0]}</span>
                                        {/if}
                                    </div>
                                    <span class="player-name">{player.displayName || 'Player'}</span>
                                </div>
                                <div class="player-score">
                                    {#if isHost}
                                        <button class="score-btn minus" on:click={() => handleScoreChange(player.membershipId, -1)} disabled={loading}>-1</button>
                                    {/if}
                                    <span class="score-value">{player.finalScore || 0}</span>
                                    {#if isHost}
                                        <button class="score-btn plus" on:click={() => handleScoreChange(player.membershipId, 1)} disabled={loading}>+1</button>
                                        <button class="score-btn plus-five" on:click={() => handleScoreChange(player.membershipId, 5)} disabled={loading}>+5</button>
                                        <button class="score-btn plus-ten" on:click={() => handleScoreChange(player.membershipId, 10)} disabled={loading}>+10</button>
                                        <button
                                            class="remove-player-btn"
                                            on:click={() => handleRemovePlayer(player.membershipId, player.displayName)}
                                            disabled={removingPlayer[player.membershipId]}
                                            title="Remove player"
                                        >✕</button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <!-- Individual View -->
        {#if sortedScores.length === 0}
            <div class="empty-state">
                <span class="empty-icon">🎮</span>
                <p>No players yet. Add players to start tracking scores!</p>
            </div>
        {:else}
            <div class="players-list">
                {#each sortedScores as player, idx}
                    <div class="player-row" class:top-three={idx < 3}>
                        <div class="rank">{getRankEmoji(idx)}</div>
                        <div class="player-info">
                            <div class="player-avatar">
                                {#if player.avatar}
                                    <img src={player.avatar} alt={player.displayName} />
                                {:else}
                                    <span>{(player.displayName || '?')[0].toUpperCase()}</span>
                                {/if}
                            </div>
                            <span class="player-name">{player.displayName || 'Player'}</span>
                        </div>
                        <div class="player-score">
                            {#if isHost}
                                <button class="score-btn minus" on:click={() => handleScoreChange(player.membershipId, -1)} disabled={loading}>-1</button>
                            {/if}
                            <span class="score-value">{player.finalScore || 0}</span>
                            {#if isHost}
                                <button class="score-btn plus" on:click={() => handleScoreChange(player.membershipId, 1)} disabled={loading}>+1</button>
                                <button class="score-btn plus-five" on:click={() => handleScoreChange(player.membershipId, 5)} disabled={loading}>+5</button>
                                <button class="score-btn plus-ten" on:click={() => handleScoreChange(player.membershipId, 10)} disabled={loading}>+10</button>
                                <button
                                    class="remove-player-btn"
                                    on:click={() => handleRemovePlayer(player.membershipId, player.displayName)}
                                    disabled={removingPlayer[player.membershipId]}
                                    title="Remove player"
                                >✕</button>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    .score-entry {
        background: white;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .score-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
    }

    .score-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: #333;
    }

    .host-badge {
        padding: 4px 8px;
        background: #4CAF50;
        color: white;
        font-size: 10px;
        font-weight: 600;
        border-radius: 4px;
        text-transform: uppercase;
    }

    .empty-state {
        text-align: center;
        padding: 32px 20px;
        color: #666;
    }

    .empty-icon {
        font-size: 40px;
        display: block;
        margin-bottom: 8px;
    }

    .teams-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .team-block {
        border: 2px solid var(--team-color);
        border-radius: 12px;
        overflow: hidden;
    }

    .team-header-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--team-color);
        color: white;
    }

    .team-rank {
        font-size: 18px;
    }

    .team-icon-small {
        font-size: 18px;
    }

    .team-name-text {
        flex: 1;
        font-weight: 600;
        font-size: 14px;
    }

    .team-total {
        font-size: 16px;
        font-weight: 700;
    }

    .team-players {
        padding: 8px;
    }

    .players-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .player-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        background: #f8f8f8;
        border-radius: 8px;
        transition: background 0.2s;
    }

    .player-row.top-three {
        background: #fff9e6;
    }

    .rank {
        width: 32px;
        text-align: center;
        font-size: 16px;
        font-weight: 700;
    }

    .player-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
    }

    .player-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #e0e0e0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .player-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .player-avatar span {
        font-size: 12px;
        font-weight: 600;
        color: #666;
    }

    .player-name {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .player-score {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .score-value {
        font-size: 18px;
        font-weight: 700;
        color: #4CAF50;
        min-width: 40px;
        text-align: center;
    }

    .score-btn {
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
    }

    .score-btn.minus {
        background: #ffebee;
        color: #F44336;
    }

    .score-btn.minus:hover:not(:disabled) {
        background: #ffcdd2;
    }

    .score-btn.plus {
        background: #e8f5e9;
        color: #4CAF50;
    }

    .score-btn.plus:hover:not(:disabled) {
        background: #c8e6c9;
    }

    .score-btn.plus-five {
        background: #4CAF50;
        color: white;
    }

    .score-btn.plus-five:hover:not(:disabled) {
        background: #43A047;
    }

    .score-btn.plus-ten {
        background: #1976D2;
        color: white;
    }

    .score-btn.plus-ten:hover:not(:disabled) {
        background: #1565C0;
    }

    .score-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .remove-player-btn {
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 50%;
        background: #ffebee;
        color: #F44336;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        margin-left: 4px;
    }

    .remove-player-btn:hover:not(:disabled) {
        background: #F44336;
        color: white;
    }

    .remove-player-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
