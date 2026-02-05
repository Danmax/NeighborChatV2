<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
    import { gameTemplates, gameTemplatesLoading, gameTemplatesError } from '../../stores/games.js';
    import { fetchGameTemplates } from '../../services/games.service.js';

    let selectedTemplate = null;

    onMount(() => {
        if ($isAuthenticated) {
            fetchGameTemplates();
        }
    });

    function selectTemplate(template) {
        selectedTemplate = template;
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

    @media (max-width: 640px) {
        .detail-header {
            flex-direction: column;
        }
    }
</style>
