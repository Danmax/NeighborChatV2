<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
    import {
        gameTemplates,
        gameSessions,
        gameSessionsLoading,
        gameTeams,
        gameTeamsLoading,
        upcomingSessions,
        activeSessions,
        getGameTypeInfo,
        gameRoles,
        sessionScores
    } from '../../stores/games.js';
    import {
        fetchGameTemplates,
        fetchGameSessions,
        fetchGameTeams,
        createGameTeam,
        updateGameTeamDetails,
        joinGameTeam,
        leaveGameTeam,
        startGameSession,
        endGameSession,
        cancelGameSession,
        addPlayerToSession,
        fetchSessionScores,
        fetchMyGameRoles
    } from '../../services/games.service.js';
    import { showToast } from '../../stores/toasts.js';
    import { getActiveMembershipId, getUserRole } from '../../services/events.service.js';
    import { getSupabase } from '../../lib/supabase.js';

    // Components
    import TeamCard from '../../components/games/TeamCard.svelte';
    import CreateTeamModal from '../../components/games/CreateTeamModal.svelte';
    import LeaderboardTab from '../../components/games/LeaderboardTab.svelte';
    import AwardsSection from '../../components/games/AwardsSection.svelte';
    import GameScoreEntry from '../../components/games/GameScoreEntry.svelte';
    import AddPlayersModal from '../../components/games/AddPlayersModal.svelte';
    import UserDashboard from '../../components/games/UserDashboard.svelte';
    import RoleRequestModal from '../../components/games/RoleRequestModal.svelte';
    import CreateLocationModal from '../../components/games/CreateLocationModal.svelte';
    import CreateTournamentModal from '../../components/games/CreateTournamentModal.svelte';
    import LocationCard from '../../components/games/LocationCard.svelte';
    import JoinInstanceModal from '../../components/games/JoinInstanceModal.svelte';
    import { gameLocations, gameLocationsLoading } from '../../stores/games.js';
    import { fetchGameLocations, deleteGameLocation, fetchAvailableInstances, joinInstance } from '../../services/games.service.js';

    // State
    let activeTab = 'dashboard';
    let showCreateTeamModal = false;
    let showAddPlayersModal = false;
    let selectedSession = null;
    let sessionActionLoading = {};
    let editTeam = null;
    let currentMembershipId = null;
    let currentInstanceId = null;
    let userRole = null;
    let availableInstances = [];
    let loadingInstances = false;
    let showJoinInstanceModal = false;

    $: isAdmin = userRole === 'admin' || userRole === 'moderator';
    $: isGameManager = $gameRoles.some(r => r.role === 'game_manager' && r.isActive) || isAdmin;
    $: isTeamLead = $gameRoles.some(r => r.role === 'team_lead' && r.isActive);
    $: isReferee = $gameRoles.some(r => r.role === 'referee' && r.isActive);
    $: hasAnyGameRole = isGameManager || isTeamLead || isReferee;

    // Team actions
    let teamActionLoading = {};

    // Base tabs (always visible)
    const baseTabs = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'sessions', label: 'Sessions', icon: '📅' },
        { id: 'teams', label: 'Teams', icon: '👥' },
        { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
        { id: 'awards', label: 'Awards', icon: '🎖️' }
    ];

    // Role-specific tabs
    const roleBasedTabs = [
        { id: 'locations', label: 'Locations', icon: '📍', requiresRole: 'game_manager' }
    ];

    // Dynamic tabs based on roles
    $: tabs = [
        ...baseTabs,
        ...roleBasedTabs.filter(tab => {
            if (tab.requiresRole === 'game_manager') return isGameManager;
            return true;
        })
    ];

    // Helper functions for role badges
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

    $: isCaptain = (team) => {
        return team.captainMembershipId === currentMembershipId;
    };

    $: isMyTeam = (team) => {
        return team.members?.some(m => m.membershipId === currentMembershipId && m.status === 'active');
    };

    onMount(async () => {
        if ($isAuthenticated) {
            currentMembershipId = await getActiveMembershipId();

            // Get instance ID from the active membership
            if (currentMembershipId) {
                try {
                    const supabase = getSupabase();
                    const { data: membership } = await supabase
                        .from('instance_memberships')
                        .select('instance_id')
                        .eq('id', currentMembershipId)
                        .single();

                    if (membership?.instance_id) {
                        currentInstanceId = membership.instance_id;
                    }
                } catch (error) {
                    console.error('Error fetching instance ID:', error);
                }
            }

            userRole = await getUserRole();
            fetchGameTemplates();
            fetchGameSessions();
            fetchGameTeams();

            if (currentInstanceId) {
                fetchMyGameRoles(currentInstanceId);
                fetchGameLocations(currentInstanceId);
            } else {
                // Show join instance modal if user doesn't have active instance
                showJoinInstanceModal = true;
                await loadAvailableInstances();
            }
        }
    });

    async function handleCreateTeam(event) {
        const { name, description, icon, color, teamId } = event.detail;
        try {
            if (teamId) {
                await updateGameTeamDetails(teamId, { name, description, icon, color });
                showToast('Team updated!', 'success');
            } else {
                await createGameTeam({ name, description, icon, color });
                showToast('Team created!', 'success');
            }
            showCreateTeamModal = false;
            editTeam = null;
        } catch (err) {
            showToast(err.message || 'Failed to save team', 'error');
        }
    }

    async function handleJoinTeam(event) {
        const { teamId } = event.detail;
        teamActionLoading[teamId] = true;
        try {
            await joinGameTeam(teamId);
            showToast('Joined team!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to join team', 'error');
        } finally {
            teamActionLoading[teamId] = false;
        }
    }

    async function handleLeaveTeam(event) {
        const { teamId } = event.detail;
        teamActionLoading[teamId] = true;
        try {
            await leaveGameTeam(teamId);
            showToast('Left team', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to leave team', 'error');
        } finally {
            teamActionLoading[teamId] = false;
        }
    }

    function handleEditTeam(event) {
        editTeam = event.detail.team;
        showCreateTeamModal = true;
    }

    function formatSessionDate(value) {
        if (!value) return 'TBD';
        const date = new Date(value);
        return date.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatSessionTime(value) {
        if (!value) return '';
        const date = new Date(value);
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    // Session Management Functions
    function isSessionHost(session) {
        return session.hostMembershipId === currentMembershipId;
    }

    function canManageSession(session) {
        return isAdmin || isSessionHost(session);
    }

    async function handleStartSession(session) {
        if (!confirm(`Start "${session.name}"? Players can begin competing.`)) return;
        sessionActionLoading[session.id] = true;
        try {
            await startGameSession(session.id);
            await fetchGameSessions();
            showToast('Game started!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to start game', 'error');
        } finally {
            sessionActionLoading[session.id] = false;
        }
    }

    async function handleEndSession(session) {
        if (!confirm(`End "${session.name}"? Final scores will be recorded.`)) return;
        sessionActionLoading[session.id] = true;
        try {
            await endGameSession(session.id);
            await fetchGameSessions();
            showToast('Game ended! Scores recorded.', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to end game', 'error');
        } finally {
            sessionActionLoading[session.id] = false;
        }
    }

    async function handleCancelSession(session) {
        if (!confirm(`Cancel "${session.name}"? This cannot be undone.`)) return;
        sessionActionLoading[session.id] = true;
        try {
            await cancelGameSession(session.id);
            await fetchGameSessions();
            showToast('Game cancelled', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to cancel game', 'error');
        } finally {
            sessionActionLoading[session.id] = false;
        }
    }

    function openAddPlayersModal(session) {
        selectedSession = session;
        fetchSessionScores(session.id);
        showAddPlayersModal = true;
    }

    async function handleAddPlayers(event) {
        const { members, teamId } = event.detail;
        if (!selectedSession || members.length === 0) return;

        sessionActionLoading[selectedSession.id] = true;
        try {
            for (const member of members) {
                await addPlayerToSession(selectedSession.id, member.membershipId, teamId);
            }
            showToast(`Added ${members.length} player${members.length > 1 ? 's' : ''}!`, 'success');
            showAddPlayersModal = false;
            selectedSession = null;
        } catch (err) {
            showToast(err.message || 'Failed to add players', 'error');
        } finally {
            if (selectedSession) {
                sessionActionLoading[selectedSession.id] = false;
            }
        }
    }

    $: existingPlayerIds = selectedSession
        ? ($sessionScores[selectedSession.id] || []).map(p => p.membershipId)
        : [];

    // Location Management
    async function handleLocationCreated(event) {
        showToast('Location created successfully!', 'success');
        if (currentInstanceId) {
            await fetchGameLocations(currentInstanceId);
        }
    }

    async function handleDeleteLocation(locationId) {
        if (!confirm('Are you sure you want to delete this location?')) return;
        try {
            await deleteGameLocation(locationId);
            showToast('Location deleted', 'success');
            if (currentInstanceId) {
                await fetchGameLocations(currentInstanceId);
            }
        } catch (err) {
            showToast(err.message || 'Failed to delete location', 'error');
        }
    }

    async function handleTournamentCreated(event) {
        showToast('Tournament created successfully!', 'success');
        if (currentInstanceId) {
            // Tournaments will be fetched when needed
        }
    }

    function handleRoleRequested(event) {
        // Re-fetch roles to reflect the request
        if (currentInstanceId) {
            fetchMyGameRoles(currentInstanceId);
        }
    }

    async function loadAvailableInstances() {
        loadingInstances = true;
        try {
            availableInstances = await fetchAvailableInstances();
        } catch (error) {
            console.error('Error loading instances:', error);
            showToast('Failed to load communities', 'error');
        } finally {
            loadingInstances = false;
        }
    }

    async function handleJoinInstance(event) {
        const { instanceId } = event.detail;
        try {
            await joinInstance(instanceId);
            showToast('Successfully joined community!', 'success');
            // Reload page or update instance
            currentInstanceId = instanceId;
            await fetchMyGameRoles(instanceId);
            fetchGameTemplates();
            fetchGameSessions();
            fetchGameTeams();
            fetchGameLocations(instanceId);
        } catch (error) {
            console.error('Error joining instance:', error);
            showToast(error.message || 'Failed to join community', 'error');
        }
    }
</script>

{#if $isAuthenticated}
    <div class="games-screen">
        <div class="screen-header">
            <button class="back-btn" on:click={() => push('/')}>← Back</button>
            <div class="header-content">
                <h2 class="card-title">Office Games</h2>
                {#if hasAnyGameRole}
                    <div class="role-badges">
                        {#each $gameRoles.filter(r => r.isActive) as role}
                            <span class="role-badge">
                                {getRoleIcon(role.role)} {getRoleLabel(role.role)}
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>
            <div class="header-actions">
                <RoleRequestModal
                    instanceId={currentInstanceId}
                    currentRoles={$gameRoles}
                    on:roleRequested={handleRoleRequested}
                />
            </div>
        </div>

        <div class="screen-subtitle">
            Compete in office games, join teams, climb the leaderboard, and earn awards!
        </div>

        <!-- Quick Action Buttons -->
        <div class="quick-actions">
            <button
                class="quick-action-btn"
                on:click={() => activeTab = 'dashboard'}
                class:active={activeTab === 'dashboard'}
            >
                <div class="quick-action-icon-wrapper profile-icon">
                    <span class="quick-action-icon">👤</span>
                </div>
                <div class="quick-action-text">
                    <span class="quick-action-label">Player Profile</span>
                    <span class="quick-action-sublabel">Stats & Progress</span>
                </div>
            </button>
            <button
                class="quick-action-btn play-btn"
                on:click={() => activeTab = 'sessions'}
                class:active={activeTab === 'sessions'}
            >
                <div class="quick-action-icon-wrapper play-icon">
                    <span class="quick-action-icon">▶️</span>
                </div>
                <div class="quick-action-text">
                    <span class="quick-action-label">Play Now</span>
                    <span class="quick-action-sublabel">Join Sessions</span>
                </div>
            </button>
        </div>

        <!-- Tab Navigation -->
        <div class="tabs">
            {#each tabs as tab}
                <button
                    class="tab"
                    class:active={activeTab === tab.id}
                    on:click={() => activeTab = tab.id}
                >
                    <span class="tab-icon">{tab.icon}</span>
                    <span class="tab-label">{tab.label}</span>
                </button>
            {/each}
        </div>

        <!-- Dashboard Tab -->
        {#if activeTab === 'dashboard'}
            <div class="tab-content">
                <UserDashboard instanceId={currentInstanceId} />
            </div>
        {/if}

        <!-- Sessions Tab -->
        {#if activeTab === 'sessions'}
            <div class="tab-content">
                <div class="sessions-section">
                    <div class="section-header">
                        <h3>Upcoming Sessions</h3>
                        <span class="count-badge">{$upcomingSessions.length}</span>
                    </div>

                    {#if $gameSessionsLoading}
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <p>Loading sessions...</p>
                        </div>
                    {:else if $upcomingSessions.length === 0}
                        <div class="empty-state">
                            <span class="empty-icon">📅</span>
                            <p>No upcoming sessions yet.</p>
                        </div>
                    {:else}
                        <div class="sessions-list">
                            {#each $upcomingSessions as session (session.id)}
                                {@const gameInfo = getGameTypeInfo(session.settings?.game_type)}
                                {@const canManage = canManageSession(session)}
                                <div class="session-card">
                                    <div class="session-header">
                                        <span class="session-icon">{gameInfo.icon}</span>
                                        <div class="session-info">
                                            <h4>{session.name}</h4>
                                            <p>
                                                {formatSessionDate(session.scheduledStart)}
                                                {#if formatSessionTime(session.scheduledStart)}
                                                    · {formatSessionTime(session.scheduledStart)}
                                                {/if}
                                            </p>
                                        </div>
                                        <span class="status-pill {session.status}">{session.status}</span>
                                    </div>
                                    <div class="session-meta">
                                        <span class="badge">{session.settings?.duration_minutes || 60} min</span>
                                        <span class="badge">{session.settings?.heat_count || 4} rounds</span>
                                        {#if isSessionHost(session)}
                                            <span class="badge host-badge">Host</span>
                                        {/if}
                                    </div>
                                    {#if canManage}
                                        <div class="session-actions">
                                            <button
                                                class="btn btn-primary btn-small"
                                                on:click={() => handleStartSession(session)}
                                                disabled={sessionActionLoading[session.id]}
                                            >
                                                {sessionActionLoading[session.id] ? '...' : '▶ Start Game'}
                                            </button>
                                            <button
                                                class="btn btn-secondary btn-small"
                                                on:click={() => openAddPlayersModal(session)}
                                                disabled={sessionActionLoading[session.id]}
                                            >
                                                👥 Add Players
                                            </button>
                                            <button
                                                class="btn btn-danger btn-small"
                                                on:click={() => handleCancelSession(session)}
                                                disabled={sessionActionLoading[session.id]}
                                            >
                                                ✕ Cancel
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Active Sessions with Scoreboard -->
                {#if $activeSessions.length > 0}
                    <div class="sessions-section">
                        <div class="section-header">
                            <h3>Live Games</h3>
                            <span class="live-indicator">● Live</span>
                        </div>
                        {#each $activeSessions as session (session.id)}
                            {@const canManage = canManageSession(session)}
                            <div class="active-session-wrapper">
                                {#if canManage}
                                    <div class="active-session-controls">
                                        <button
                                            class="btn btn-secondary btn-small"
                                            on:click={() => openAddPlayersModal(session)}
                                            disabled={sessionActionLoading[session.id]}
                                        >
                                            👥 Add Players
                                        </button>
                                        <button
                                            class="btn btn-danger btn-small"
                                            on:click={() => handleEndSession(session)}
                                            disabled={sessionActionLoading[session.id]}
                                        >
                                            {sessionActionLoading[session.id] ? '...' : '🏁 End Game'}
                                        </button>
                                    </div>
                                {/if}
                                <GameScoreEntry
                                    sessionId={session.id}
                                    isHost={canManage}
                                    teamMode={session.settings?.scoring_mode || 'individual'}
                                />
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Teams Tab -->
        {#if activeTab === 'teams'}
            <div class="tab-content">
                <div class="section-header">
                    <h3>Game Teams</h3>
                    <button class="btn btn-primary btn-small" on:click={() => { editTeam = null; showCreateTeamModal = true; }}>
                        + Create Team
                    </button>
                </div>

                {#if $gameTeamsLoading}
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading teams...</p>
                    </div>
                {:else if $gameTeams.length === 0}
                    <div class="empty-state">
                        <span class="empty-icon">👥</span>
                        <p>No teams yet. Create one to get started!</p>
                    </div>
                {:else}
                    <div class="teams-grid">
                        {#each $gameTeams as team (team.id)}
                            <TeamCard
                                {team}
                                isMyTeam={isMyTeam(team)}
                                isCaptain={isCaptain(team)}
                                loading={teamActionLoading[team.id]}
                                on:join={handleJoinTeam}
                                on:leave={handleLeaveTeam}
                                on:edit={handleEditTeam}
                            />
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Leaderboard Tab -->
        {#if activeTab === 'leaderboard'}
            <div class="tab-content">
                <LeaderboardTab />
            </div>
        {/if}

        <!-- Awards Tab -->
        {#if activeTab === 'awards'}
            <div class="tab-content">
                <AwardsSection />
            </div>
        {/if}

        <!-- Locations Tab (Game Manager Only) -->
        {#if activeTab === 'locations'}
            <div class="tab-content">
                <div class="section-header">
                    <h3>Game Locations</h3>
                    <CreateLocationModal
                        instanceId={currentInstanceId}
                        isGameManager={isGameManager}
                        on:locationCreated={handleLocationCreated}
                    />
                </div>

                {#if $gameLocationsLoading}
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading locations...</p>
                    </div>
                {:else if $gameLocations.length === 0}
                    <div class="empty-state">
                        <span class="empty-icon">📍</span>
                        <p>No game locations yet.</p>
                        <p style="font-size: 13px; color: #999;">Create locations to host your games</p>
                    </div>
                {:else}
                    <div class="locations-grid">
                        {#each $gameLocations as location (location.id)}
                            <LocationCard
                                {location}
                                isGameManager={isGameManager}
                                onDelete={() => handleDeleteLocation(location.id)}
                            />
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Modals -->
        <CreateTeamModal
            show={showCreateTeamModal}
            {editTeam}
            on:close={() => { showCreateTeamModal = false; editTeam = null; }}
            on:submit={handleCreateTeam}
        />

        <CreateTournamentModal
            instanceId={currentInstanceId}
            gameTemplates={$gameTemplates}
            isGameManager={isGameManager}
            on:tournamentCreated={handleTournamentCreated}
        />

        <AddPlayersModal
            show={showAddPlayersModal}
            sessionId={selectedSession?.id}
            {existingPlayerIds}
            teamMode={selectedSession?.settings?.scoring_mode || 'individual'}
            loading={selectedSession ? sessionActionLoading[selectedSession.id] : false}
            on:close={() => { showAddPlayersModal = false; selectedSession = null; }}
            on:add={handleAddPlayers}
        />

        <JoinInstanceModal
            show={showJoinInstanceModal}
            availableInstances={availableInstances}
            isLoading={loadingInstances}
            on:close={() => showJoinInstanceModal = false}
            on:joinInstance={handleJoinInstance}
        />

    </div>
{/if}

<style>
    .games-screen {
        padding-bottom: 48px;
    }

    .screen-header {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 12px;
    }

    .header-content {
        flex: 1;
    }

    .header-actions {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .card-title {
        margin: 0 0 10px;
        font-size: 28px;
        font-weight: 800;
        color: #1f2937;
        letter-spacing: -0.02em;
    }

    .role-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .role-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 11px;
        font-weight: 700;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .screen-subtitle {
        color: #6b7280;
        font-size: 15px;
        margin-bottom: 24px;
        line-height: 1.5;
    }

    /* Quick Action Buttons */
    .quick-actions {
        display: flex;
        gap: 16px;
        margin-bottom: 28px;
    }

    .quick-action-btn {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 18px 20px;
        border: none;
        border-radius: 16px;
        background: white;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        position: relative;
        overflow: hidden;
    }

    .quick-action-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: transparent;
        transition: background 0.3s ease;
    }

    .quick-action-btn:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
    }

    .quick-action-btn.active::before {
        background: linear-gradient(90deg, #667eea, #764ba2);
    }

    .quick-action-btn.active {
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
    }

    .quick-action-icon-wrapper {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.3s ease;
    }

    .quick-action-btn:hover .quick-action-icon-wrapper {
        transform: scale(1.08);
    }

    .profile-icon {
        background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
    }

    .games-icon {
        background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
    }

    .play-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .quick-action-icon {
        font-size: 1.6rem;
        line-height: 1;
    }

    .quick-action-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }

    .quick-action-label {
        font-size: 1rem;
        font-weight: 700;
        color: #1f2937;
        letter-spacing: -0.01em;
    }

    .quick-action-sublabel {
        font-size: 0.8rem;
        color: #6b7280;
        font-weight: 500;
    }

    .quick-action-btn.play-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .quick-action-btn.play-btn .quick-action-label,
    .quick-action-btn.play-btn .quick-action-sublabel {
        color: white;
    }

    .quick-action-btn.play-btn .quick-action-sublabel {
        opacity: 0.85;
    }

    .quick-action-btn.play-btn .play-icon {
        background: rgba(255, 255, 255, 0.2);
    }

    .quick-action-btn.play-btn:hover {
        background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
    }

    .quick-action-btn.play-btn.active::before {
        background: rgba(255, 255, 255, 0.5);
    }

    .back-btn {
        background: none;
        border: none;
        color: var(--primary);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        padding: 8px 0;
    }

    /* Tabs */
    .tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 24px;
        overflow-x: auto;
        padding: 6px;
        background: #f3f4f6;
        border-radius: 14px;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .tabs::-webkit-scrollbar {
        display: none;
    }

    .tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 18px;
        border: none;
        border-radius: 10px;
        background: transparent;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
        color: #6b7280;
        position: relative;
    }

    .tab:hover {
        background: rgba(255, 255, 255, 0.6);
        color: #374151;
    }

    .tab.active {
        background: white;
        color: #1f2937;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .tab-icon {
        font-size: 16px;
        transition: transform 0.2s ease;
    }

    .tab:hover .tab-icon {
        transform: scale(1.1);
    }

    .tab-label {
        transition: color 0.2s ease;
    }

    .tab-content {
        animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* Section Headers */
    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
    }

    .section-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #1f2937;
    }

    .count-badge {
        background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        color: #4f46e5;
    }

    .live-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #dc2626;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .live-indicator::before {
        content: '';
        width: 8px;
        height: 8px;
        background: #dc2626;
        border-radius: 50%;
        animation: pulse-live 1.5s infinite;
    }

    @keyframes pulse-live {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.9); }
    }

    /* Templates Grid */
    .templates-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        margin-bottom: 28px;
    }

    .template-card {
        background: white;
        border-radius: 16px;
        padding: 20px;
        display: flex;
        gap: 16px;
        border: 1px solid #e5e7eb;
        text-align: left;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
    }

    .template-card::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(180deg, #667eea, #764ba2);
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .template-card:hover {
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
        transform: translateY(-4px);
        border-color: #d1d5db;
    }

    .template-card:hover::after {
        opacity: 1;
    }

    .template-card.selected {
        border-color: #667eea;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.15);
    }

    .template-card.selected::after {
        opacity: 1;
    }

    .template-icon {
        font-size: 40px;
        flex-shrink: 0;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
        border-radius: 14px;
    }

    .template-content {
        flex: 1;
        min-width: 0;
    }

    .template-content h3 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 700;
        color: #1f2937;
    }

    .template-content p {
        margin: 0 0 12px;
        font-size: 14px;
        color: #6b7280;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        line-height: 1.5;
    }

    .template-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .template-meta span {
        font-size: 12px;
        padding: 4px 10px;
        background: #f3f4f6;
        border-radius: 6px;
        color: #4b5563;
        font-weight: 500;
    }

    .admin-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 20px;
    }

    .template-actions {
        position: absolute;
        top: 14px;
        right: 14px;
        display: flex;
        gap: 6px;
        opacity: 0;
        transform: translateY(-4px);
        transition: all 0.25s ease;
    }

    .template-card:hover .template-actions {
        opacity: 1;
        transform: translateY(0);
    }

    .action-btn {
        width: 34px;
        height: 34px;
        border: none;
        background: white;
        border-radius: 10px;
        font-size: 15px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .action-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .action-btn-danger:hover {
        background: #fef2f2;
    }

    .action-btn-schedule {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }

    .action-btn-schedule:hover {
        background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
    }

    /* Keep old class for backwards compatibility */
    .rules-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 32px;
        height: 32px;
        border: none;
        background: #f5f5f5;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s;
    }

    .rules-btn:hover {
        background: #e8e8e8;
    }

    /* Detail Card */
    .detail-card {
        background: white;
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        border: 1px solid #e5e7eb;
        margin-top: 24px;
    }

    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        margin-bottom: 20px;
    }

    .detail-title {
        display: flex;
        gap: 16px;
        align-items: flex-start;
    }

    .detail-icon {
        font-size: 48px;
        width: 72px;
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
        border-radius: 16px;
    }

    .detail-title h3 {
        margin: 0 0 6px;
        font-size: 20px;
        font-weight: 700;
        color: #1f2937;
    }

    .detail-title p {
        margin: 0;
        font-size: 15px;
        color: #6b7280;
        line-height: 1.5;
    }

    .detail-actions {
        display: flex;
        gap: 10px;
    }

    .detail-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    /* Sessions */
    .sessions-section {
        background: white;
        border-radius: 18px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    }

    .sessions-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .session-card {
        padding: 20px;
        background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
        border-radius: 14px;
        border: 1px solid #e5e7eb;
        transition: all 0.3s ease;
    }

    .session-card:hover {
        border-color: #d1d5db;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    }

    .session-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 14px;
    }

    .session-icon {
        font-size: 28px;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .session-info {
        flex: 1;
    }

    .session-info h4 {
        margin: 0 0 4px;
        font-size: 16px;
        font-weight: 700;
        color: #1f2937;
    }

    .session-info p {
        margin: 0;
        font-size: 14px;
        color: #6b7280;
    }

    .session-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .session-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
    }

    .host-badge {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
        color: white !important;
    }

    .active-session-wrapper {
        background: white;
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        border: 1px solid #e5e7eb;
    }

    .active-session-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid #f0f0f0;
    }

    .btn-danger {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
    }

    .btn-danger:hover:not(:disabled) {
        background: #fee2e2;
        border-color: #fca5a5;
    }

    /* Teams Grid */
    .teams-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
    }

    /* Locations Grid */
    .locations-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 20px;
    }

    /* Common */
    .badge {
        padding: 6px 12px;
        border-radius: 8px;
        background: #f3f4f6;
        font-size: 12px;
        font-weight: 600;
        color: #4b5563;
    }

    .status-pill {
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .status-pill.scheduled {
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        color: #1d4ed8;
    }

    .status-pill.active {
        background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
        color: #047857;
        animation: pulse-subtle 2s infinite;
    }

    @keyframes pulse-subtle {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.85; }
    }

    .status-pill.completed {
        background: linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%);
        color: #7c3aed;
    }

    .loading-state,
    .empty-state {
        text-align: center;
        padding: 60px 24px;
        color: #6b7280;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #e5e7eb;
        border-top-color: #667eea;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .empty-icon {
        font-size: 56px;
        display: block;
        margin-bottom: 16px;
        opacity: 0.8;
    }

    .empty-state p {
        font-size: 15px;
        margin: 0;
    }

    /* Buttons */
    .btn {
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .btn-small {
        padding: 10px 16px;
        font-size: 13px;
        border-radius: 8px;
    }

    .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #e5e7eb;
    }

    .btn-secondary:hover:not(:disabled) {
        background: #e5e7eb;
        border-color: #d1d5db;
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
    }

    /* Session Modal */
    .session-modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 200;
    }

    .session-modal-content {
        width: min(520px, 100%);
        background: white;
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.25);
        animation: modal-enter 0.3s ease;
    }

    @keyframes modal-enter {
        from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }

    .session-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
    }

    .session-modal-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #1f2937;
    }

    .modal-close {
        background: #f3f4f6;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #6b7280;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .modal-close:hover {
        background: #e5e7eb;
        color: #374151;
    }

    .session-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .session-form label {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #374151;
    }

    .session-form input[type="text"],
    .session-form input[type="date"],
    .session-form input[type="time"],
    .session-form input[type="number"],
    .session-form select {
        padding: 12px 14px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        font-size: 15px;
        transition: all 0.2s ease;
        background: #fafafa;
    }

    .session-form input:focus,
    .session-form select:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        background: white;
    }

    .session-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }

    .session-toggle {
        flex-direction: row !important;
        align-items: center !important;
        gap: 12px !important;
        font-size: 14px !important;
        color: #374151 !important;
        padding: 12px;
        background: #f9fafb;
        border-radius: 10px;
        cursor: pointer;
    }

    .session-toggle input[type="checkbox"] {
        width: 20px;
        height: 20px;
        accent-color: #667eea;
    }

    .session-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 12px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
    }

    @media (max-width: 640px) {
        .card-title {
            font-size: 22px;
        }

        .detail-header {
            flex-direction: column;
        }

        .detail-icon {
            width: 56px;
            height: 56px;
            font-size: 32px;
        }

        .session-row {
            grid-template-columns: 1fr;
        }

        .tabs {
            padding: 4px;
            border-radius: 12px;
        }

        .tab-label {
            display: none;
        }

        .tab {
            padding: 10px 14px;
            border-radius: 8px;
        }

        .quick-actions {
            flex-direction: column;
            gap: 12px;
        }

        .quick-action-btn {
            padding: 16px;
        }

        .quick-action-icon-wrapper {
            width: 44px;
            height: 44px;
            border-radius: 12px;
        }

        .quick-action-icon {
            font-size: 1.3rem;
        }

        .quick-action-label {
            font-size: 0.95rem;
        }

        .quick-action-sublabel {
            font-size: 0.75rem;
        }

        .templates-grid {
            grid-template-columns: 1fr;
            gap: 16px;
        }

        .template-card {
            padding: 16px;
        }

        .template-icon {
            width: 50px;
            height: 50px;
            font-size: 28px;
        }

        .template-actions {
            opacity: 1;
            transform: none;
        }

        .sessions-section {
            padding: 16px;
            border-radius: 14px;
        }

        .session-card {
            padding: 16px;
        }

        .session-icon {
            width: 42px;
            height: 42px;
            font-size: 22px;
        }

        .btn {
            padding: 10px 18px;
        }

        .btn-small {
            padding: 8px 14px;
        }
    }
</style>
