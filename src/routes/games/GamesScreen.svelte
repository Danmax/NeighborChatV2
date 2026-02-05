<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
    import {
        gameTemplates,
        gameTemplatesLoading,
        gameTemplatesError,
        gameSessions,
        gameSessionsLoading,
        gameSessionsError
    } from '../../stores/games.js';
    import { fetchGameTemplates, fetchGameSessions, createGameSession } from '../../services/games.service.js';
    import { showToast } from '../../stores/toasts.js';

    let selectedTemplate = null;
    let showSessionModal = false;
    let sessionName = '';
    let sessionDate = '';
    let sessionTime = '';
    let sessionDuration = '';
    let heatCount = '';
    let championshipEnabled = true;
    let savingSession = false;
    let scoringMode = 'team';
    let scoresVersion = 0;

    const sessionTeams = new Map();
    const sessionPlayers = new Map();

    function getTeams(sessionId) {
        if (!sessionTeams.has(sessionId)) {
            sessionTeams.set(sessionId, [
                { id: `team_${sessionId}_1`, name: 'Team A', points: 0 },
                { id: `team_${sessionId}_2`, name: 'Team B', points: 0 }
            ]);
        }
        return sessionTeams.get(sessionId);
    }

    function getPlayers(sessionId) {
        if (!sessionPlayers.has(sessionId)) {
            sessionPlayers.set(sessionId, [
                { id: `player_${sessionId}_1`, name: 'Player 1', points: 0 },
                { id: `player_${sessionId}_2`, name: 'Player 2', points: 0 }
            ]);
        }
        return sessionPlayers.get(sessionId);
    }

    function addTeam(sessionId) {
        const teams = getTeams(sessionId);
        const nextIndex = teams.length + 1;
        teams.push({ id: `team_${sessionId}_${nextIndex}`, name: `Team ${nextIndex}`, points: 0 });
        sessionTeams.set(sessionId, [...teams]);
        scoresVersion += 1;
    }

    function addPlayer(sessionId) {
        const players = getPlayers(sessionId);
        const nextIndex = players.length + 1;
        players.push({ id: `player_${sessionId}_${nextIndex}`, name: `Player ${nextIndex}`, points: 0 });
        sessionPlayers.set(sessionId, [...players]);
        scoresVersion += 1;
    }

    function updatePoints(list, itemId, delta, map, sessionId) {
        const updated = list.map(item =>
            item.id === itemId ? { ...item, points: Math.max(0, item.points + delta) } : item
        );
        map.set(sessionId, updated);
        scoresVersion += 1;
    }

    onMount(() => {
        if ($isAuthenticated) {
            fetchGameTemplates();
            fetchGameSessions();
        }
    });

    function selectTemplate(template) {
        selectedTemplate = template;
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

    function getRulesList(template) {
        const rules = template?.rules || {};
        return Array.isArray(rules.list) ? rules.list : [];
    }

    function getScoring(template) {
        return template?.config?.scoring || {};
    }

    function getSessions(template) {
        return template?.config?.sessions || {};
    }

    function getStages(template) {
        return template?.config?.stages || [];
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

    function getSessionMode(session) {
        return session?.settings?.scoring_mode || scoringMode;
    }

    function setSessionMode(sessionId, mode) {
        const sessions = ($gameSessions || []).map(session =>
            session.id === sessionId
                ? { ...session, settings: { ...session.settings, scoring_mode: mode } }
                : session
        );
        gameSessions.set(sessions);
    }
</script>

{#if $isAuthenticated}
    <div class="games-screen">
        <div class="screen-header">
            <button class="back-btn" on:click={() => push('/')}>← Back</button>
            <h2 class="card-title">Game Play Templates</h2>
        </div>

        <div class="screen-subtitle">
            Use these templates to run community game nights: teams, points, scoreboards, and championships.
        </div>

        <div class="sessions-card">
            <div class="sessions-header">
                <h3>Scheduled Sessions</h3>
                <span class="sessions-count">{($gameSessions || []).length} scheduled</span>
            </div>
            {#if $gameSessionsLoading}
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading sessions...</p>
                </div>
            {:else if $gameSessionsError}
                <div class="empty-state">
                    <p>{$gameSessionsError}</p>
                </div>
            {:else if !$gameSessions?.length}
                <div class="empty-state">
                    <p>No sessions scheduled yet. Pick a template to schedule one.</p>
                </div>
            {:else}
                <div class="sessions-list">
                    {#each $gameSessions as session (session.id)}
                        <div class="session-item">
                            <div>
                                <h4>{session.name}</h4>
                                <p>
                                    {formatSessionDate(session.scheduledStart)}
                                    {#if formatSessionTime(session.scheduledStart)}
                                        · {formatSessionTime(session.scheduledStart)}
                                    {/if}
                                </p>
                            </div>
                            <div class="session-meta">
                                <span class="badge">{session.settings?.game_type || 'Session'}</span>
                                <span class="badge">{session.settings?.duration_minutes || 60} min</span>
                                <span class="status-pill {session.status}">{session.status}</span>
                            </div>
                        </div>
                        <div class="session-card">
                            <div class="session-card-header">
                                <h5>Live Scoreboard</h5>
                                <div class="session-modes">
                                    <button
                                        class="mode-btn {getSessionMode(session) === 'team' ? 'active' : ''}"
                                        on:click={() => setSessionMode(session.id, 'team')}
                                    >
                                        Team
                                    </button>
                                    <button
                                        class="mode-btn {getSessionMode(session) === 'individual' ? 'active' : ''}"
                                        on:click={() => setSessionMode(session.id, 'individual')}
                                    >
                                        Individual
                                    </button>
                                </div>
                            </div>

                            {#if getSessionMode(session) === 'team'}
                                <div class="score-grid">
                                    {#each getTeams(session.id) as team (team.id)}
                                        <div class="score-card">
                                            <div>
                                                <input class="score-name" bind:value={team.name} />
                                                <p class="score-points">{team.points} pts</p>
                                            </div>
                                            <div class="score-actions">
                                                <button on:click={() => updatePoints(getTeams(session.id), team.id, 1, sessionTeams, session.id)}>+1</button>
                                                <button on:click={() => updatePoints(getTeams(session.id), team.id, 5, sessionTeams, session.id)}>+5</button>
                                                <button on:click={() => updatePoints(getTeams(session.id), team.id, -1, sessionTeams, session.id)}>-1</button>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                                <button class="btn btn-secondary btn-small" on:click={() => addTeam(session.id)}>Add team</button>
                            {:else}
                                <div class="score-grid">
                                    {#each getPlayers(session.id) as player (player.id)}
                                        <div class="score-card">
                                            <div>
                                                <input class="score-name" bind:value={player.name} />
                                                <p class="score-points">{player.points} pts</p>
                                            </div>
                                            <div class="score-actions">
                                                <button on:click={() => updatePoints(getPlayers(session.id), player.id, 1, sessionPlayers, session.id)}>+1</button>
                                                <button on:click={() => updatePoints(getPlayers(session.id), player.id, 5, sessionPlayers, session.id)}>+5</button>
                                                <button on:click={() => updatePoints(getPlayers(session.id), player.id, -1, sessionPlayers, session.id)}>-1</button>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                                <button class="btn btn-secondary btn-small" on:click={() => addPlayer(session.id)}>Add player</button>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        {#if $gameTemplatesLoading}
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading game templates...</p>
            </div>
        {:else if $gameTemplatesError}
            <div class="empty-state">
                <p>{$gameTemplatesError}</p>
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
                    </button>
                {/each}
            </div>
        {/if}

        {#if selectedTemplate}
            <div class="detail-card">
                <div class="detail-header">
                    <div>
                        <h3>{selectedTemplate.name}</h3>
                        <p>{selectedTemplate.description}</p>
                    </div>
                    <div class="detail-badges">
                        <span class="badge">{selectedTemplate.gameType}</span>
                        <span class="badge">{selectedTemplate.estimatedDuration} min</span>
                    </div>
                </div>
                <div class="detail-actions">
                    <button class="btn btn-primary btn-small" on:click={openSessionModal}>
                        Schedule Session
                    </button>
                </div>

                <div class="detail-grid">
                    <div class="detail-section">
                        <h4>Teams & Players</h4>
                        <p>Min players: {selectedTemplate.minPlayers}</p>
                        <p>Max players: {selectedTemplate.maxPlayers || 'Flexible'}</p>
                        <p>Team style: {selectedTemplate.config?.teams?.mode || 'Any'}</p>
                    </div>
                    <div class="detail-section">
                        <h4>Point System</h4>
                        {#if Object.keys(getScoring(selectedTemplate)).length}
                            <ul>
                                {#each Object.entries(getScoring(selectedTemplate)) as [key, value]}
                                    <li>{key}: {value}</li>
                                {/each}
                            </ul>
                        {:else}
                            <p>No scoring rules defined.</p>
                        {/if}
                    </div>
                    <div class="detail-section">
                        <h4>Stages</h4>
                        {#if getStages(selectedTemplate).length}
                            <ul>
                                {#each getStages(selectedTemplate) as stage}
                                    <li>{stage}</li>
                                {/each}
                            </ul>
                        {:else}
                            <p>Single session.</p>
                        {/if}
                    </div>
                    <div class="detail-section">
                        <h4>Session Setup</h4>
                        <p>Session length: {getSessions(selectedTemplate).duration_minutes || selectedTemplate.estimatedDuration} min</p>
                        <p>Rounds: {getSessions(selectedTemplate).rounds || 'Flexible'}</p>
                        <p>Heat format: {getSessions(selectedTemplate).heat_format || 'Any'}</p>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Rules</h4>
                    {#if getRulesList(selectedTemplate).length}
                        <ul>
                            {#each getRulesList(selectedTemplate) as rule}
                                <li>{rule}</li>
                            {/each}
                        </ul>
                    {:else}
                        <p>No rules listed.</p>
                    {/if}
                </div>

                <div class="detail-section">
                    <h4>Sponsors, Prizes & Winners</h4>
                    <p>Sponsors: {selectedTemplate.config?.sponsors || 'Invite community sponsors'}</p>
                    <p>Prize model: {selectedTemplate.config?.prizes || 'Points + rewards'}</p>
                    <p>Winner rules: {selectedTemplate.config?.winner_rules || 'Highest points wins'}</p>
                </div>
            </div>
        {/if}

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
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .screen-subtitle {
        color: var(--text-muted);
        font-size: 14px;
        margin-bottom: 20px;
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

    .templates-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }

    .sessions-card {
        background: white;
        border-radius: var(--radius-md);
        padding: 18px;
        margin-bottom: 20px;
        box-shadow: var(--shadow-sm);
    }

    .sessions-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
    }

    .sessions-header h3 {
        margin: 0;
    }

    .sessions-count {
        font-size: 12px;
        color: var(--text-muted);
        background: #f5f5f5;
        padding: 4px 10px;
        border-radius: 999px;
    }

    .sessions-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .session-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 14px;
        border-radius: 16px;
        border: 1px solid #eee;
        background: #fffaf1;
    }

    .session-item h4 {
        margin: 0 0 6px;
    }

    .session-item p {
        margin: 0;
        color: var(--text-muted);
        font-size: 13px;
    }

    .session-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
    }

    .status-pill {
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
        background: #e0e0e0;
        color: #424242;
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

    .session-card {
        margin-top: 10px;
        padding: 16px;
        border-radius: 18px;
        background: #f7f4ff;
        border: 1px solid #e6defa;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .session-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .session-card-header h5 {
        margin: 0;
    }

    .session-modes {
        display: flex;
        gap: 8px;
    }

    .mode-btn {
        border: 1px solid #d6c9f7;
        background: white;
        color: #51318c;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 600;
    }

    .mode-btn.active {
        background: #5c34a5;
        color: white;
        border-color: #5c34a5;
    }

    .score-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
    }

    .score-card {
        background: white;
        border-radius: 14px;
        padding: 12px;
        border: 1px solid #ece6ff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .score-name {
        border: none;
        font-weight: 600;
        font-size: 14px;
        background: transparent;
        width: 120px;
    }

    .score-name:focus {
        outline: none;
    }

    .score-points {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--text-muted);
    }

    .score-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .score-actions button {
        border: none;
        background: #f0eaff;
        color: #5c34a5;
        padding: 4px 8px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
    }

    .score-actions button:hover {
        background: #e0d5ff;
    }

    .template-card {
        background: white;
        border-radius: var(--radius-md);
        padding: 16px;
        display: flex;
        gap: 12px;
        border: 1px solid #eee;
        text-align: left;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .template-card:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
    }

    .template-card.selected {
        border-color: var(--primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 25%, white);
    }

    .template-icon {
        font-size: 28px;
    }

    .template-content h3 {
        margin: 0 0 6px;
    }

    .template-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 12px;
        color: var(--text-muted);
    }

    .detail-card {
        background: white;
        border-radius: var(--radius-md);
        padding: 20px;
        box-shadow: var(--shadow-sm);
    }

    .detail-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
    }

    .detail-actions {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
    }

    .detail-badges {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .badge {
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--cream);
        font-size: 12px;
        font-weight: 600;
    }

    .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 16px;
    }

    .detail-section {
        margin-top: 16px;
    }

    .detail-section ul {
        padding-left: 18px;
        margin: 8px 0 0;
    }

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
        border-radius: 20px;
        padding: 20px;
        box-shadow: var(--shadow-lg);
    }

    .session-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
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

    .session-form input[type=\"text\"],
    .session-form input[type=\"date\"],
    .session-form input[type=\"time\"],
    .session-form input[type=\"number\"] {
        padding: 10px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        font-size: 14px;
    }

    .session-form select {
        padding: 10px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        font-size: 14px;
        background: white;
    }

    .session-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
    }

    .session-toggle {
        flex-direction: row;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        color: var(--text);
    }

    .session-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    @media (max-width: 640px) {
        .detail-header {
            flex-direction: column;
        }
    }
</style>
