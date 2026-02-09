<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import {
        gameTemplates,
        gameTemplatesLoading,
        gameTemplatesError,
        gameSessions,
        gameSessionsLoading,
        gameSessionsError,
        gameTeams,
        gameTeamsLoading,
        myTeam,
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
        createGameSession,
        createGameTeam,
        updateGameTeamDetails,
        joinGameTeam,
        leaveGameTeam,
        createGameTemplate,
        updateGameTemplate,
        deleteGameTemplate,
        startGameSession,
        endGameSession,
        cancelGameSession,
        addPlayerToSession,
        fetchSessionScores,
        fetchMyGameRoles
    } from '../../services/games.service.js';
    import { showToast } from '../../stores/toasts.js';
    import { getActiveMembershipId, getUserRole, getActiveInstanceId } from '../../services/events.service.js';

    // Components
    import GameRulesModal from '../../components/games/GameRulesModal.svelte';
    import TeamCard from '../../components/games/TeamCard.svelte';
    import CreateTeamModal from '../../components/games/CreateTeamModal.svelte';
    import LeaderboardTab from '../../components/games/LeaderboardTab.svelte';
    import AwardsSection from '../../components/games/AwardsSection.svelte';
    import GameScoreEntry from '../../components/games/GameScoreEntry.svelte';
    import CreateGameTemplateModal from '../../components/games/CreateGameTemplateModal.svelte';
    import AddPlayersModal from '../../components/games/AddPlayersModal.svelte';
    import UserDashboard from '../../components/games/UserDashboard.svelte';

    // State
    let activeTab = 'dashboard';
    let selectedTemplate = null;
    let showSessionModal = false;
    let showRulesModal = false;
    let showCreateTeamModal = false;
    let showCreateTemplateModal = false;
    let showAddPlayersModal = false;
    let selectedSession = null;
    let sessionActionLoading = {};
    let editTeam = null;
    let editTemplateData = null;
    let currentMembershipId = null;
    let currentInstanceId = null;
    let userRole = null;
    let savingTemplate = false;

    $: isAdmin = userRole === 'admin' || userRole === 'moderator';
    $: isGameManager = $gameRoles.some(r => r.role === 'game_manager' && r.isActive) || isAdmin;
    $: isTeamLead = $gameRoles.some(r => r.role === 'team_lead' && r.isActive);
    $: isReferee = $gameRoles.some(r => r.role === 'referee' && r.isActive);
    $: hasAnyGameRole = isGameManager || isTeamLead || isReferee;

    // Session form
    let sessionName = '';
    let sessionDate = '';
    let sessionTime = '';
    let sessionDuration = '';
    let heatCount = '';
    let championshipEnabled = true;
    let savingSession = false;
    let scoringMode = 'team';

    // Team actions
    let teamActionLoading = {};

    // Base tabs (always visible)
    const baseTabs = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'templates', label: 'Templates', icon: '🎮' },
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
            currentInstanceId = await getActiveInstanceId();
            userRole = await getUserRole();
            fetchGameTemplates();
            fetchGameSessions();
            fetchGameTeams();
            if (currentInstanceId) {
                fetchMyGameRoles(currentInstanceId);
            }
        }
    });

    function selectTemplate(template) {
        selectedTemplate = template;
    }

    function openRulesModal(template) {
        selectedTemplate = template;
        showRulesModal = true;
    }

    function openSessionModal() {
        if (!selectedTemplate) return;
        sessionName = `${selectedTemplate.name} Session`;
        sessionDuration = selectedTemplate.estimatedDuration || 60;
        heatCount = selectedTemplate?.config?.sessions?.rounds || 4;
        championshipEnabled = true;
        showSessionModal = true;
    }

    async function handleCreateSession() {
        if (!sessionDate || !sessionTime || savingSession) return;
        savingSession = true;
        try {
            const scheduledStart = new Date(`${sessionDate}T${sessionTime}`).toISOString();
            await createGameSession({
                template: selectedTemplate,
                name: sessionName,
                scheduledStart,
                durationMinutes: Number(sessionDuration) || selectedTemplate.estimatedDuration || 60,
                heatCount: Number(heatCount) || 4,
                championshipEnabled
            });
            await fetchGameSessions();
            showToast('Game session scheduled!', 'success');
            showSessionModal = false;
        } catch (err) {
            showToast(err.message || 'Failed to create session', 'error');
        } finally {
            savingSession = false;
        }
    }

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

    // Template CRUD handlers
    function openCreateTemplateModal() {
        editTemplateData = null;
        showCreateTemplateModal = true;
    }

    function openEditTemplateModal(template) {
        editTemplateData = template;
        showCreateTemplateModal = true;
    }

    async function handleCreateTemplate(event) {
        const data = event.detail;
        savingTemplate = true;
        try {
            if (data.templateId) {
                await updateGameTemplate(data.templateId, data);
                showToast('Template updated!', 'success');
            } else {
                await createGameTemplate(data);
                showToast('Template created!', 'success');
            }
            showCreateTemplateModal = false;
            editTemplateData = null;
        } catch (err) {
            showToast(err.message || 'Failed to save template', 'error');
        } finally {
            savingTemplate = false;
        }
    }

    async function handleDeleteTemplate(template) {
        if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
        try {
            await deleteGameTemplate(template.id);
            if (selectedTemplate?.id === template.id) {
                selectedTemplate = null;
            }
            showToast('Template deleted', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to delete template', 'error');
        }
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
        </div>

        <div class="screen-subtitle">
            Compete in office games, join teams, climb the leaderboard, and earn awards!
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

        <!-- Templates Tab -->
        {#if activeTab === 'templates'}
            <div class="tab-content">
                {#if isAdmin}
                    <div class="admin-actions">
                        <button class="btn btn-primary btn-small" on:click={openCreateTemplateModal}>
                            + Create Template
                        </button>
                    </div>
                {/if}

                {#if $gameTemplatesLoading}
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading game templates...</p>
                    </div>
                {:else if $gameTemplatesError}
                    <div class="empty-state">
                        <p>{$gameTemplatesError}</p>
                    </div>
                {:else if $gameTemplates.length === 0}
                    <div class="empty-state">
                        <span class="empty-icon">🎮</span>
                        <p>No game templates yet.</p>
                        {#if isAdmin}
                            <button class="btn btn-primary" on:click={openCreateTemplateModal}>Create First Template</button>
                        {/if}
                    </div>
                {:else}
                    <div class="templates-grid">
                        {#each $gameTemplates as template (template.id)}
                            <button
                                class="template-card"
                                class:selected={selectedTemplate?.id === template.id}
                                on:click={() => selectTemplate(template)}
                            >
                                <div class="template-icon">{template.icon || '🎮'}</div>
                                <div class="template-content">
                                    <h3>{template.name}</h3>
                                    <p>{template.description}</p>
                                    <div class="template-meta">
                                        <span>{template.gameType}</span>
                                        <span>{template.estimatedDuration} min</span>
                                        <span>{template.minPlayers}+ players</span>
                                    </div>
                                </div>
                                <div class="template-actions">
                                    <button
                                        class="action-btn"
                                        on:click|stopPropagation={() => openRulesModal(template)}
                                        title="View rules"
                                    >
                                        📋
                                    </button>
                                    {#if isAdmin && template.instanceId}
                                        <button
                                            class="action-btn"
                                            on:click|stopPropagation={() => openEditTemplateModal(template)}
                                            title="Edit template"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            class="action-btn action-btn-danger"
                                            on:click|stopPropagation={() => handleDeleteTemplate(template)}
                                            title="Delete template"
                                        >
                                            🗑️
                                        </button>
                                    {/if}
                                </div>
                            </button>
                        {/each}
                    </div>
                {/if}

                <!-- Selected Template Detail -->
                {#if selectedTemplate}
                    <div class="detail-card">
                        <div class="detail-header">
                            <div class="detail-title">
                                <span class="detail-icon">{selectedTemplate.icon}</span>
                                <div>
                                    <h3>{selectedTemplate.name}</h3>
                                    <p>{selectedTemplate.description}</p>
                                </div>
                            </div>
                            <div class="detail-actions">
                                <button class="btn btn-secondary" on:click={() => openRulesModal(selectedTemplate)}>
                                    📋 Rules
                                </button>
                                <button class="btn btn-primary" on:click={openSessionModal}>
                                    📅 Schedule
                                </button>
                            </div>
                        </div>
                        <div class="detail-meta">
                            <span class="badge">{selectedTemplate.gameType}</span>
                            <span class="badge">{selectedTemplate.estimatedDuration} min</span>
                            <span class="badge">{selectedTemplate.minPlayers}-{selectedTemplate.maxPlayers || '∞'} players</span>
                            <span class="badge">{selectedTemplate.config?.teams?.mode || 'Any'} mode</span>
                        </div>
                    </div>
                {/if}
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
                            <p>No upcoming sessions. Schedule one from the Templates tab!</p>
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
                    <button class="btn btn-primary btn-small">
                        + Add Location
                    </button>
                </div>
                <div class="empty-state">
                    <span class="empty-icon">📍</span>
                    <p>Location management coming soon!</p>
                    <p style="font-size: 13px; color: #999;">Manage game venues, capacity, and amenities</p>
                </div>
            </div>
        {/if}

        <!-- Modals -->
        <GameRulesModal
            show={showRulesModal}
            template={selectedTemplate}
            on:close={() => showRulesModal = false}
        />

        <CreateTeamModal
            show={showCreateTeamModal}
            {editTeam}
            on:close={() => { showCreateTeamModal = false; editTeam = null; }}
            on:submit={handleCreateTeam}
        />

        <CreateGameTemplateModal
            show={showCreateTemplateModal}
            editTemplate={editTemplateData}
            loading={savingTemplate}
            on:close={() => { showCreateTemplateModal = false; editTemplateData = null; }}
            on:submit={handleCreateTemplate}
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

        {#if showSessionModal}
            <div class="session-modal" role="dialog" aria-modal="true" on:click|self={() => showSessionModal = false}>
                <div class="session-modal-content">
                    <div class="session-modal-header">
                        <h3>Schedule Game Session</h3>
                        <button class="modal-close" on:click={() => showSessionModal = false}>✕</button>
                    </div>
                    <div class="session-form">
                        <label>
                            Session Name
                            <input type="text" bind:value={sessionName} />
                        </label>
                        <div class="session-row">
                            <label>
                                Date
                                <input type="date" bind:value={sessionDate} />
                            </label>
                            <label>
                                Time
                                <input type="time" bind:value={sessionTime} />
                            </label>
                        </div>
                        <div class="session-row">
                            <label>
                                Duration (minutes)
                                <input type="number" min="10" max="240" bind:value={sessionDuration} />
                            </label>
                            <label>
                                Heats / Rounds
                                <input type="number" min="1" max="20" bind:value={heatCount} />
                            </label>
                        </div>
                        <label class="session-toggle">
                            <input type="checkbox" bind:checked={championshipEnabled} />
                            Championship round enabled
                        </label>
                        <label>
                            Scoring Mode
                            <select bind:value={scoringMode}>
                                <option value="team">Team-based</option>
                                <option value="individual">Individual</option>
                            </select>
                        </label>
                        <div class="session-actions">
                            <button class="btn btn-secondary" on:click={() => showSessionModal = false}>Cancel</button>
                            <button class="btn btn-primary" on:click={handleCreateSession} disabled={savingSession || !sessionDate || !sessionTime}>
                                {savingSession ? 'Saving...' : 'Create Session'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .games-screen {
        padding-bottom: 40px;
    }

    .screen-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 8px;
    }

    .header-content {
        flex: 1;
    }

    .card-title {
        margin: 0 0 8px;
    }

    .role-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
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
        letter-spacing: 0.5px;
    }

    .screen-subtitle {
        color: var(--text-muted);
        font-size: 14px;
        margin-bottom: 16px;
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
        gap: 8px;
        margin-bottom: 20px;
        overflow-x: auto;
        padding-bottom: 4px;
    }

    .tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        border: none;
        border-radius: 100px;
        background: var(--cream, #f5f5f5);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .tab:hover {
        background: #e8e8e8;
    }

    .tab.active {
        background: var(--primary, #4CAF50);
        color: white;
    }

    .tab-icon {
        font-size: 16px;
    }

    .tab-content {
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* Section Headers */
    .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
    }

    .section-header h3 {
        margin: 0;
        font-size: 16px;
    }

    .count-badge {
        background: #f0f0f0;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        color: #666;
    }

    .live-indicator {
        color: #F44336;
        font-size: 12px;
        font-weight: 600;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    /* Templates Grid */
    .templates-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }

    .template-card {
        background: white;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        gap: 12px;
        border: 2px solid #eee;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
    }

    .template-card:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }

    .template-card.selected {
        border-color: var(--primary, #4CAF50);
    }

    .template-icon {
        font-size: 32px;
        flex-shrink: 0;
    }

    .template-content {
        flex: 1;
        min-width: 0;
    }

    .template-content h3 {
        margin: 0 0 6px;
        font-size: 15px;
    }

    .template-content p {
        margin: 0 0 8px;
        font-size: 13px;
        color: #666;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .template-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 11px;
        color: var(--text-muted);
    }

    .admin-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 16px;
    }

    .template-actions {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 4px;
    }

    .action-btn {
        width: 30px;
        height: 30px;
        border: none;
        background: #f5f5f5;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .action-btn:hover {
        background: #e8e8e8;
        transform: scale(1.05);
    }

    .action-btn-danger:hover {
        background: #ffebee;
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
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 16px;
    }

    .detail-title {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }

    .detail-icon {
        font-size: 40px;
    }

    .detail-title h3 {
        margin: 0 0 4px;
    }

    .detail-title p {
        margin: 0;
        font-size: 14px;
        color: #666;
    }

    .detail-actions {
        display: flex;
        gap: 8px;
    }

    .detail-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    /* Sessions */
    .sessions-section {
        background: white;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
    }

    .sessions-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .session-card {
        padding: 16px;
        background: #f8f8f8;
        border-radius: 12px;
        border: 1px solid #eee;
    }

    .session-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
    }

    .session-icon {
        font-size: 24px;
    }

    .session-info {
        flex: 1;
    }

    .session-info h4 {
        margin: 0 0 4px;
        font-size: 15px;
    }

    .session-info p {
        margin: 0;
        font-size: 13px;
        color: #666;
    }

    .session-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .session-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e0e0e0;
    }

    .host-badge {
        background: #4CAF50 !important;
        color: white !important;
    }

    .active-session-wrapper {
        background: white;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .active-session-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #f0f0f0;
    }

    .btn-danger {
        background: #ffebee;
        color: #D32F2F;
    }

    .btn-danger:hover:not(:disabled) {
        background: #ffcdd2;
    }

    /* Teams Grid */
    .teams-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
    }

    /* Common */
    .badge {
        padding: 4px 10px;
        border-radius: 999px;
        background: #f0f0f0;
        font-size: 12px;
        font-weight: 600;
    }

    .status-pill {
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
    }

    .status-pill.scheduled {
        background: #e3f2fd;
        color: #1a73e8;
    }

    .status-pill.active {
        background: #e8f5e9;
        color: #2e7d32;
    }

    .status-pill.completed {
        background: #ede7f6;
        color: #5e35b1;
    }

    .loading-state,
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }

    .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f0f0f0;
        border-top-color: var(--primary, #4CAF50);
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

    /* Buttons */
    .btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
    }

    .btn-small {
        padding: 8px 14px;
        font-size: 13px;
    }

    .btn-primary {
        background: var(--primary, #4CAF50);
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

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Session Modal */
    .session-modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 200;
    }

    .session-modal-content {
        width: min(520px, 100%);
        background: white;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .session-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
    }

    .session-modal-header h3 {
        margin: 0;
    }

    .modal-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #999;
        padding: 4px 8px;
    }

    .session-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .session-form label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        color: var(--text-muted);
    }

    .session-form input[type="text"],
    .session-form input[type="date"],
    .session-form input[type="time"],
    .session-form input[type="number"],
    .session-form select {
        padding: 10px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
    }

    .session-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .session-toggle {
        flex-direction: row !important;
        align-items: center !important;
        gap: 10px !important;
        font-size: 14px !important;
        color: var(--text) !important;
    }

    .session-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 8px;
    }

    @media (max-width: 640px) {
        .detail-header {
            flex-direction: column;
        }

        .session-row {
            grid-template-columns: 1fr;
        }

        .tabs {
            justify-content: flex-start;
        }

        .tab-label {
            display: none;
        }

        .tab {
            padding: 10px 12px;
        }
    }
</style>
