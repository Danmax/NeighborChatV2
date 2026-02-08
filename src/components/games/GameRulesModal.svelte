<script>
    import { createEventDispatcher } from 'svelte';

    export let show = false;
    export let template = null;

    const dispatch = createEventDispatcher();

    $: rules = template?.rules?.list || [];
    $: config = template?.config || {};
    $: scoring = config.scoring || {};
    $: stages = config.stages || [];
    $: equipment = config.equipment || [];
    $: sessions = config.sessions || {};

    function handleClose() {
        dispatch('close');
    }
</script>

{#if show && template}
    <div
        class="modal-overlay"
        on:click|self={handleClose}
        on:keydown={(e) => e.key === 'Escape' && handleClose()}
        role="button"
        tabindex="0"
        aria-label="Close rules dialog"
    >
        <div class="modal-content">
            <div class="modal-header">
                <div class="header-icon">{template.icon}</div>
                <div class="header-text">
                    <h2>{template.name}</h2>
                    <span class="game-type">{template.category || template.gameType}</span>
                </div>
                <button class="modal-close" on:click={handleClose}>✕</button>
            </div>

            <div class="modal-body">
                <!-- Description -->
                {#if template.description}
                    <div class="section">
                        <p class="description">{template.description}</p>
                    </div>
                {/if}

                <!-- Quick Info -->
                <div class="quick-info">
                    <div class="info-item">
                        <span class="info-icon">👥</span>
                        <span class="info-text">{template.minPlayers}-{template.maxPlayers} players</span>
                    </div>
                    <div class="info-item">
                        <span class="info-icon">⏱️</span>
                        <span class="info-text">{template.estimatedDuration} min</span>
                    </div>
                    {#if sessions.rounds}
                        <div class="info-item">
                            <span class="info-icon">🔄</span>
                            <span class="info-text">{sessions.rounds} rounds</span>
                        </div>
                    {/if}
                    {#if config.teams?.mode}
                        <div class="info-item">
                            <span class="info-icon">{config.teams.mode === 'individual' ? '👤' : '👥'}</span>
                            <span class="info-text">{config.teams.mode === 'individual' ? 'Individual' : `Teams of ${config.teams.size || '?'}`}</span>
                        </div>
                    {/if}
                </div>

                <!-- Stages -->
                {#if stages.length > 0}
                    <div class="section">
                        <h3>Game Stages</h3>
                        <div class="stages">
                            {#each stages as stage, idx}
                                <div class="stage">
                                    <span class="stage-num">{idx + 1}</span>
                                    <span class="stage-name">{stage}</span>
                                </div>
                                {#if idx < stages.length - 1}
                                    <span class="stage-arrow">→</span>
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Scoring -->
                {#if Object.keys(scoring).length > 0}
                    <div class="section">
                        <h3>Scoring</h3>
                        <div class="scoring-grid">
                            {#each Object.entries(scoring) as [key, value]}
                                <div class="score-item">
                                    <span class="score-label">{key.replace(/_/g, ' ')}</span>
                                    <span class="score-value">{value > 0 ? '+' : ''}{value} pts</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Rules -->
                {#if rules.length > 0}
                    <div class="section">
                        <h3>Rules</h3>
                        <ol class="rules-list">
                            {#each rules as rule}
                                <li>{rule}</li>
                            {/each}
                        </ol>
                    </div>
                {/if}

                <!-- Equipment -->
                {#if equipment.length > 0}
                    <div class="section">
                        <h3>Equipment Needed</h3>
                        <ul class="equipment-list">
                            {#each equipment as item}
                                <li>{item}</li>
                            {/each}
                        </ul>
                    </div>
                {/if}

                <!-- Winner & Prizes -->
                {#if config.winner_rules || config.prizes}
                    <div class="section prizes">
                        {#if config.winner_rules}
                            <div class="prize-item">
                                <span class="prize-icon">🏆</span>
                                <div>
                                    <strong>How to Win</strong>
                                    <p>{config.winner_rules}</p>
                                </div>
                            </div>
                        {/if}
                        {#if config.prizes}
                            <div class="prize-item">
                                <span class="prize-icon">🎁</span>
                                <div>
                                    <strong>Prizes</strong>
                                    <p>{config.prizes}</p>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="modal-footer">
                <button class="btn btn-primary" on:click={handleClose}>Got it!</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }

    .modal-content {
        background: white;
        border-radius: 16px;
        max-width: 520px;
        width: 100%;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px 20px 16px;
        border-bottom: 1px solid #f0f0f0;
    }

    .header-icon {
        font-size: 40px;
        line-height: 1;
    }

    .header-text {
        flex: 1;
    }

    .header-text h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
    }

    .game-type {
        font-size: 12px;
        color: #666;
        text-transform: capitalize;
    }

    .modal-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #999;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .modal-close:hover {
        background: #f5f5f5;
        color: #333;
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    }

    .description {
        margin: 0 0 16px;
        color: #555;
        line-height: 1.5;
    }

    .quick-info {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
        padding: 12px;
        background: #f8f8f8;
        border-radius: 10px;
    }

    .info-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #555;
    }

    .info-icon {
        font-size: 16px;
    }

    .section {
        margin-bottom: 20px;
    }

    .section h3 {
        margin: 0 0 10px;
        font-size: 14px;
        font-weight: 600;
        color: #333;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .stages {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }

    .stage {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: #e8f5e9;
        border-radius: 20px;
        font-size: 13px;
    }

    .stage-num {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #4CAF50;
        color: white;
        border-radius: 50%;
        font-size: 11px;
        font-weight: 600;
    }

    .stage-arrow {
        color: #aaa;
    }

    .scoring-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px;
    }

    .score-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: #fff9e6;
        border-radius: 8px;
        font-size: 13px;
    }

    .score-label {
        color: #666;
        text-transform: capitalize;
    }

    .score-value {
        font-weight: 600;
        color: #4CAF50;
    }

    .rules-list {
        margin: 0;
        padding-left: 20px;
    }

    .rules-list li {
        margin-bottom: 8px;
        color: #444;
        line-height: 1.4;
        font-size: 14px;
    }

    .equipment-list {
        margin: 0;
        padding-left: 20px;
        list-style-type: disc;
    }

    .equipment-list li {
        margin-bottom: 4px;
        color: #555;
        font-size: 14px;
    }

    .prizes {
        background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
        padding: 16px;
        border-radius: 12px;
    }

    .prize-item {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
    }

    .prize-item:last-child {
        margin-bottom: 0;
    }

    .prize-icon {
        font-size: 24px;
    }

    .prize-item strong {
        display: block;
        font-size: 13px;
        color: #333;
        margin-bottom: 2px;
    }

    .prize-item p {
        margin: 0;
        font-size: 13px;
        color: #666;
    }

    .modal-footer {
        padding: 16px 20px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        justify-content: flex-end;
    }

    .btn {
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: #4CAF50;
        color: white;
    }

    .btn-primary:hover {
        background: #43A047;
    }
</style>
