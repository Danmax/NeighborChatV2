<script>
    import { createEventDispatcher } from 'svelte';
    import { GAME_TYPES, PARTICIPATION_MODES } from '../../stores/games.js';

    export let show = false;
    export let loading = false;
    export let editTemplate = null;

    const dispatch = createEventDispatcher();

    // Form state
    let name = '';
    let description = '';
    let icon = '🎮';
    let gameType = 'custom';
    let category = 'general';
    let minPlayers = 2;
    let maxPlayers = 20;
    let estimatedDuration = 60;
    let teamMode = 'individual';

    // Rules
    let rules = [];
    let newRule = '';

    // Scoring config
    let scoringItems = [{ action: 'win', points: 10 }];

    // Equipment
    let equipment = [];
    let newEquipment = '';

    const iconOptions = ['🎮', '🎯', '🧠', '🧩', '⏱️', '🏓', '🏆', '⚡', '🔥', '🌟', '💪', '🚀', '🎪', '🎭', '🎨', '🎲'];
    const categoryOptions = [
        { id: 'general', label: 'General' },
        { id: 'skills', label: 'Skills' },
        { id: 'knowledge', label: 'Knowledge' },
        { id: 'strategy', label: 'Strategy' },
        { id: 'sports', label: 'Sports' },
        { id: 'party', label: 'Party' }
    ];

    $: isEditing = !!editTemplate;
    $: modalTitle = isEditing ? 'Edit Game Template' : 'Create Game Template';
    $: submitLabel = isEditing ? 'Save Changes' : 'Create Template';

    // Reset form when modal opens
    $: if (show) {
        if (editTemplate) {
            name = editTemplate.name || '';
            description = editTemplate.description || '';
            icon = editTemplate.icon || '🎮';
            gameType = editTemplate.gameType || 'custom';
            category = editTemplate.category || 'general';
            minPlayers = editTemplate.minPlayers || 2;
            maxPlayers = editTemplate.maxPlayers || 20;
            estimatedDuration = editTemplate.estimatedDuration || 60;
            teamMode = editTemplate.config?.teams?.mode || 'individual';
            rules = editTemplate.rules?.list || [];
            scoringItems = Object.entries(editTemplate.config?.scoring || {}).map(([action, points]) => ({ action, points }));
            if (scoringItems.length === 0) scoringItems = [{ action: 'win', points: 10 }];
            equipment = editTemplate.config?.equipment || [];
        } else {
            resetForm();
        }
    }

    function resetForm() {
        name = '';
        description = '';
        icon = '🎮';
        gameType = 'custom';
        category = 'general';
        minPlayers = 2;
        maxPlayers = 20;
        estimatedDuration = 60;
        teamMode = 'individual';
        rules = [];
        newRule = '';
        scoringItems = [{ action: 'win', points: 10 }];
        equipment = [];
        newEquipment = '';
    }

    $: isValid = name.trim().length >= 2 && minPlayers > 0;

    function handleClose() {
        dispatch('close');
    }

    function addRule() {
        if (newRule.trim()) {
            rules = [...rules, newRule.trim()];
            newRule = '';
        }
    }

    function removeRule(idx) {
        rules = rules.filter((_, i) => i !== idx);
    }

    function addScoringItem() {
        scoringItems = [...scoringItems, { action: '', points: 0 }];
    }

    function removeScoringItem(idx) {
        scoringItems = scoringItems.filter((_, i) => i !== idx);
    }

    function addEquipment() {
        if (newEquipment.trim()) {
            equipment = [...equipment, newEquipment.trim()];
            newEquipment = '';
        }
    }

    function removeEquipment(idx) {
        equipment = equipment.filter((_, i) => i !== idx);
    }

    function handleSubmit() {
        if (!isValid) return;

        // Build scoring config
        const scoring = {};
        scoringItems.forEach(item => {
            if (item.action.trim()) {
                scoring[item.action.trim()] = Number(item.points) || 0;
            }
        });

        const templateData = {
            name: name.trim(),
            description: description.trim() || null,
            icon,
            gameType,
            category,
            minPlayers: Number(minPlayers) || 2,
            maxPlayers: Number(maxPlayers) || null,
            estimatedDuration: Number(estimatedDuration) || 60,
            rules: { list: rules },
            config: {
                teams: { mode: teamMode },
                scoring,
                equipment
            }
        };

        if (isEditing) {
            templateData.templateId = editTemplate.id;
        }

        dispatch('submit', templateData);
    }
</script>

{#if show}
    <div
        class="modal-overlay"
        on:click|self={handleClose}
        on:keydown={(e) => e.key === 'Escape' && handleClose()}
        role="button"
        tabindex="0"
        aria-label="Close template dialog"
    >
        <div class="modal-content">
            <div class="modal-header">
                <h2>{modalTitle}</h2>
                <button class="modal-close" on:click={handleClose}>✕</button>
            </div>

            <div class="modal-body">
                <!-- Preview Card -->
                <div class="template-preview">
                    <span class="preview-icon">{icon}</span>
                    <div class="preview-info">
                        <span class="preview-name">{name || 'Game Name'}</span>
                        <span class="preview-meta">{category} · {estimatedDuration} min · {minPlayers}-{maxPlayers} players</span>
                    </div>
                </div>

                <!-- Basic Info -->
                <div class="form-section">
                    <h4>Basic Information</h4>

                    <div class="form-row">
                        <div class="form-group flex-2">
                            <label for="tpl-name">Game Name *</label>
                            <input
                                type="text"
                                id="tpl-name"
                                bind:value={name}
                                placeholder="Enter game name"
                                maxlength="100"
                            />
                        </div>
                        <div class="form-group">
                            <label>Icon</label>
                            <div class="icon-picker-inline">
                                {#each iconOptions as opt}
                                    <button
                                        type="button"
                                        class="icon-btn"
                                        class:selected={icon === opt}
                                        on:click={() => icon = opt}
                                    >
                                        {opt}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="tpl-description">Description</label>
                        <textarea
                            id="tpl-description"
                            bind:value={description}
                            placeholder="Describe the game and what makes it fun"
                            rows="2"
                            maxlength="500"
                        ></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="tpl-game-type">Game Type</label>
                            <select id="tpl-game-type" bind:value={gameType}>
                                <option value="custom">Custom</option>
                                {#each GAME_TYPES as gt}
                                    <option value={gt.id}>{gt.label}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="tpl-category">Category</label>
                            <select id="tpl-category" bind:value={category}>
                                {#each categoryOptions as cat}
                                    <option value={cat.id}>{cat.label}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Players & Duration -->
                <div class="form-section">
                    <h4>Players & Duration</h4>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="tpl-min-players">Min Players</label>
                            <input type="number" id="tpl-min-players" bind:value={minPlayers} min="1" max="100" />
                        </div>
                        <div class="form-group">
                            <label for="tpl-max-players">Max Players</label>
                            <input type="number" id="tpl-max-players" bind:value={maxPlayers} min="1" max="500" />
                        </div>
                        <div class="form-group">
                            <label for="tpl-duration">Duration (min)</label>
                            <input type="number" id="tpl-duration" bind:value={estimatedDuration} min="5" max="480" />
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="tpl-team-mode">Participation Mode</label>
                        <select id="tpl-team-mode" bind:value={teamMode}>
                            {#each PARTICIPATION_MODES as mode}
                                <option value={mode.id}>{mode.icon} {mode.label}</option>
                            {/each}
                        </select>
                    </div>
                </div>

                <!-- Rules -->
                <div class="form-section">
                    <h4>Game Rules</h4>
                    <div class="list-editor">
                        {#each rules as rule, idx}
                            <div class="list-item">
                                <span class="item-number">{idx + 1}.</span>
                                <span class="item-text">{rule}</span>
                                <button type="button" class="remove-btn" on:click={() => removeRule(idx)}>✕</button>
                            </div>
                        {/each}
                        <div class="add-item-row">
                            <input
                                type="text"
                                bind:value={newRule}
                                placeholder="Add a rule..."
                                on:keypress={(e) => e.key === 'Enter' && addRule()}
                            />
                            <button type="button" class="add-btn" on:click={addRule}>Add</button>
                        </div>
                    </div>
                </div>

                <!-- Scoring -->
                <div class="form-section">
                    <h4>Scoring System</h4>
                    <div class="scoring-editor">
                        {#each scoringItems as item, idx}
                            <div class="scoring-row">
                                <input
                                    type="text"
                                    bind:value={item.action}
                                    placeholder="Action (e.g., win, bullseye)"
                                    class="scoring-action"
                                />
                                <input
                                    type="number"
                                    bind:value={item.points}
                                    placeholder="Points"
                                    class="scoring-points"
                                />
                                <span class="pts-label">pts</span>
                                {#if scoringItems.length > 1}
                                    <button type="button" class="remove-btn" on:click={() => removeScoringItem(idx)}>✕</button>
                                {/if}
                            </div>
                        {/each}
                        <button type="button" class="add-scoring-btn" on:click={addScoringItem}>
                            + Add Scoring Rule
                        </button>
                    </div>
                </div>

                <!-- Equipment -->
                <div class="form-section">
                    <h4>Equipment Needed</h4>
                    <div class="list-editor">
                        <div class="equipment-tags">
                            {#each equipment as item, idx}
                                <span class="equipment-tag">
                                    {item}
                                    <button type="button" class="tag-remove" on:click={() => removeEquipment(idx)}>✕</button>
                                </span>
                            {/each}
                        </div>
                        <div class="add-item-row">
                            <input
                                type="text"
                                bind:value={newEquipment}
                                placeholder="Add equipment..."
                                on:keypress={(e) => e.key === 'Enter' && addEquipment()}
                            />
                            <button type="button" class="add-btn" on:click={addEquipment}>Add</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={handleClose} disabled={loading}>
                    Cancel
                </button>
                <button
                    class="btn btn-primary"
                    on:click={handleSubmit}
                    disabled={loading || !isValid}
                >
                    {loading ? 'Saving...' : submitLabel}
                </button>
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
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 20px 16px;
        border-bottom: 1px solid #f0f0f0;
    }

    .modal-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
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

    .template-preview {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: linear-gradient(135deg, #f8f8f8 0%, #fff 100%);
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        margin-bottom: 20px;
    }

    .preview-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #4CAF50;
        border-radius: 12px;
        font-size: 24px;
    }

    .preview-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .preview-name {
        font-size: 16px;
        font-weight: 600;
        color: #333;
    }

    .preview-meta {
        font-size: 12px;
        color: #666;
    }

    .form-section {
        margin-bottom: 24px;
    }

    .form-section h4 {
        margin: 0 0 12px;
        font-size: 14px;
        font-weight: 600;
        color: #333;
    }

    .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
    }

    .form-group {
        margin-bottom: 12px;
    }

    .form-group.flex-2 {
        flex: 2;
    }

    .form-group label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: #555;
        margin-bottom: 6px;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        transition: border-color 0.2s;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: #4CAF50;
    }

    .icon-picker-inline {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .icon-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        border: 2px solid transparent;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .icon-btn:hover {
        background: #e8e8e8;
    }

    .icon-btn.selected {
        border-color: #4CAF50;
        background: #e8f5e9;
    }

    .list-editor {
        background: #fafafa;
        border-radius: 8px;
        padding: 12px;
    }

    .list-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: white;
        border-radius: 6px;
        margin-bottom: 6px;
    }

    .item-number {
        font-size: 12px;
        font-weight: 600;
        color: #999;
        min-width: 20px;
    }

    .item-text {
        flex: 1;
        font-size: 13px;
    }

    .remove-btn {
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        font-size: 14px;
        padding: 2px 6px;
        border-radius: 4px;
    }

    .remove-btn:hover {
        background: #ffebee;
        color: #F44336;
    }

    .add-item-row {
        display: flex;
        gap: 8px;
        margin-top: 8px;
    }

    .add-item-row input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 13px;
    }

    .add-btn {
        padding: 8px 16px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }

    .add-btn:hover {
        background: #43A047;
    }

    .scoring-editor {
        background: #fafafa;
        border-radius: 8px;
        padding: 12px;
    }

    .scoring-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .scoring-action {
        flex: 2;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 13px;
    }

    .scoring-points {
        width: 70px;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 13px;
        text-align: center;
    }

    .pts-label {
        font-size: 12px;
        color: #666;
    }

    .add-scoring-btn {
        width: 100%;
        padding: 8px;
        background: transparent;
        border: 1px dashed #ccc;
        border-radius: 6px;
        color: #666;
        font-size: 13px;
        cursor: pointer;
        margin-top: 4px;
    }

    .add-scoring-btn:hover {
        background: #f0f0f0;
        border-color: #999;
    }

    .equipment-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
    }

    .equipment-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: white;
        border-radius: 999px;
        font-size: 13px;
        border: 1px solid #e0e0e0;
    }

    .tag-remove {
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        font-size: 12px;
        padding: 0;
    }

    .tag-remove:hover {
        color: #F44336;
    }

    .modal-footer {
        padding: 16px 20px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }

    .btn {
        padding: 10px 20px;
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

    @media (max-width: 600px) {
        .form-row {
            grid-template-columns: 1fr;
        }

        .scoring-row {
            flex-wrap: wrap;
        }

        .scoring-action {
            flex: 1 1 100%;
        }
    }
</style>
