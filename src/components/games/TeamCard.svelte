<script>
    import { createEventDispatcher } from 'svelte';
    import Avatar from '../avatar/Avatar.svelte';

    export let team;
    export let isMyTeam = false;
    export let isCaptain = false;
    export let compact = false;
    export let loading = false;

    const dispatch = createEventDispatcher();

    $: memberCount = team.members?.filter(m => m.status === 'active').length || 0;
    $: activeMembers = team.members?.filter(m => m.status === 'active') || [];
    $: captain = activeMembers.find(m => m.role === 'captain');
    $: displayMembers = activeMembers.slice(0, 5);
    $: extraMemberCount = Math.max(0, memberCount - 5);
    $: stats = team.teamStats || { totalGames: 0, totalWins: 0, totalPoints: 0 };

    function handleJoin() {
        dispatch('join', { teamId: team.id });
    }

    function handleLeave() {
        dispatch('leave', { teamId: team.id });
    }

    function handleEdit() {
        dispatch('edit', { team });
    }

    function handleView() {
        dispatch('view', { team });
    }
</script>

<div
    class="team-card"
    class:compact
    class:my-team={isMyTeam}
    style="--team-color: {team.color || '#5c34a5'}"
>
    <div class="team-header">
        <div class="team-icon-wrapper">
            <span class="team-icon">{team.icon || '🎮'}</span>
        </div>
        <div class="team-info">
            <h4 class="team-name">{team.name}</h4>
            {#if captain && !compact}
                <span class="team-captain">Captain: {captain.displayName || 'Unknown'}</span>
            {/if}
        </div>
        {#if isMyTeam}
            <span class="my-team-badge">My Team</span>
        {/if}
    </div>

    {#if !compact && team.description}
        <p class="team-description">{team.description}</p>
    {/if}

    <!-- Members -->
    <div class="team-members">
        <div class="members-avatars">
            {#each displayMembers as member}
                <div class="member-avatar" title={member.displayName || 'Member'}>
                    {#if member.avatar}
                        <img src={member.avatar} alt={member.displayName} />
                    {:else}
                        <span class="avatar-placeholder">{(member.displayName || '?')[0].toUpperCase()}</span>
                    {/if}
                    {#if member.role === 'captain'}
                        <span class="captain-badge">👑</span>
                    {/if}
                </div>
            {/each}
            {#if extraMemberCount > 0}
                <div class="member-avatar extra">
                    <span>+{extraMemberCount}</span>
                </div>
            {/if}
        </div>
        <span class="member-count">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
    </div>

    <!-- Stats -->
    {#if !compact}
        <div class="team-stats">
            <div class="stat">
                <span class="stat-value">{stats.totalGames}</span>
                <span class="stat-label">Games</span>
            </div>
            <div class="stat">
                <span class="stat-value">{stats.totalWins}</span>
                <span class="stat-label">Wins</span>
            </div>
            <div class="stat">
                <span class="stat-value">{stats.totalPoints}</span>
                <span class="stat-label">Points</span>
            </div>
        </div>
    {/if}

    <!-- Actions -->
    <div class="team-actions">
        {#if isMyTeam}
            {#if isCaptain}
                <button class="btn btn-secondary btn-small" on:click={handleEdit} disabled={loading}>
                    Edit
                </button>
            {/if}
            <button class="btn btn-outline btn-small" on:click={handleLeave} disabled={loading}>
                {loading ? '...' : 'Leave'}
            </button>
        {:else}
            <button class="btn btn-primary btn-small" on:click={handleJoin} disabled={loading || memberCount >= (team.maxMembers || 10)}>
                {#if loading}
                    Joining...
                {:else if memberCount >= (team.maxMembers || 10)}
                    Full
                {:else}
                    Join Team
                {/if}
            </button>
        {/if}
    </div>
</div>

<style>
    .team-card {
        background: white;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        border: 2px solid transparent;
        transition: all 0.2s ease;
    }

    .team-card:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }

    .team-card.my-team {
        border-color: var(--team-color);
        background: linear-gradient(135deg, white 0%, color-mix(in srgb, var(--team-color) 5%, white) 100%);
    }

    .team-card.compact {
        padding: 12px;
    }

    .team-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .team-icon-wrapper {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--team-color);
        border-radius: 12px;
    }

    .compact .team-icon-wrapper {
        width: 40px;
        height: 40px;
    }

    .team-icon {
        font-size: 24px;
        line-height: 1;
    }

    .compact .team-icon {
        font-size: 20px;
    }

    .team-info {
        flex: 1;
        min-width: 0;
    }

    .team-name {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .compact .team-name {
        font-size: 14px;
    }

    .team-captain {
        font-size: 12px;
        color: #666;
    }

    .my-team-badge {
        padding: 4px 8px;
        background: var(--team-color);
        color: white;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        border-radius: 4px;
    }

    .team-description {
        margin: 0 0 12px;
        font-size: 13px;
        color: #666;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .team-members {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .members-avatars {
        display: flex;
        margin-left: 4px;
    }

    .member-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #e0e0e0;
        border: 2px solid white;
        margin-left: -8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .member-avatar:first-child {
        margin-left: 0;
    }

    .member-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-placeholder {
        font-size: 12px;
        font-weight: 600;
        color: #666;
    }

    .member-avatar.extra {
        background: #f5f5f5;
        font-size: 10px;
        font-weight: 600;
        color: #666;
    }

    .captain-badge {
        position: absolute;
        bottom: -2px;
        right: -2px;
        font-size: 10px;
        background: white;
        border-radius: 50%;
        padding: 1px;
    }

    .member-count {
        font-size: 12px;
        color: #888;
    }

    .team-stats {
        display: flex;
        gap: 16px;
        padding: 12px;
        background: #f8f8f8;
        border-radius: 8px;
        margin-bottom: 12px;
    }

    .stat {
        flex: 1;
        text-align: center;
    }

    .stat-value {
        display: block;
        font-size: 18px;
        font-weight: 700;
        color: var(--team-color);
    }

    .stat-label {
        font-size: 11px;
        color: #888;
        text-transform: uppercase;
    }

    .team-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }

    .btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
    }

    .btn-small {
        padding: 6px 12px;
        font-size: 12px;
    }

    .btn-primary {
        background: var(--team-color, #4CAF50);
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        filter: brightness(1.1);
    }

    .btn-secondary {
        background: #f0f0f0;
        color: #333;
    }

    .btn-secondary:hover:not(:disabled) {
        background: #e0e0e0;
    }

    .btn-outline {
        background: transparent;
        border: 1px solid #ddd;
        color: #666;
    }

    .btn-outline:hover:not(:disabled) {
        background: #f5f5f5;
        border-color: #ccc;
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
