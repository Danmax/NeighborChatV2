<script>
    import { createEventDispatcher } from 'svelte';

    export let show = false;
    export let loading = false;
    export let editTeam = null; // If provided, we're editing

    const dispatch = createEventDispatcher();

    let name = '';
    let description = '';
    let icon = '🎮';
    let color = '#5c34a5';

    const iconOptions = ['🎮', '🏆', '⚡', '🔥', '🌟', '💪', '🎯', '🚀', '🦁', '🐺', '🦅', '🐉', '💎', '🎪', '🎭', '🎨'];
    const colorOptions = ['#5c34a5', '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722', '#795548'];

    $: isEditing = !!editTeam;
    $: modalTitle = isEditing ? 'Edit Team' : 'Create Team';
    $: submitLabel = isEditing ? 'Save Changes' : 'Create Team';

    // Reset when modal opens
    $: if (show) {
        if (editTeam) {
            name = editTeam.name || '';
            description = editTeam.description || '';
            icon = editTeam.icon || '🎮';
            color = editTeam.color || '#5c34a5';
        } else {
            name = '';
            description = '';
            icon = '🎮';
            color = '#5c34a5';
        }
    }

    $: isValid = name.trim().length >= 2;

    function handleClose() {
        dispatch('close');
    }

    function handleSubmit() {
        if (!isValid) return;
        dispatch('submit', {
            name: name.trim(),
            description: description.trim() || null,
            icon,
            color,
            teamId: editTeam?.id
        });
    }
</script>

{#if show}
    <div
        class="modal-overlay"
        on:click|self={handleClose}
        on:keydown={(e) => e.key === 'Escape' && handleClose()}
        role="button"
        tabindex="0"
        aria-label="Close team dialog"
    >
        <div class="modal-content">
            <div class="modal-header">
                <h2>{modalTitle}</h2>
                <button class="modal-close" on:click={handleClose}>✕</button>
            </div>

            <div class="modal-body">
                <!-- Preview -->
                <div class="team-preview" style="--team-color: {color}">
                    <div class="preview-icon">{icon}</div>
                    <div class="preview-name">{name || 'Team Name'}</div>
                </div>

                <!-- Name -->
                <div class="form-group">
                    <label for="team-name">Team Name *</label>
                    <input
                        type="text"
                        id="team-name"
                        bind:value={name}
                        placeholder="Enter team name"
                        maxlength="50"
                    />
                    <span class="char-count">{name.length}/50</span>
                </div>

                <!-- Description -->
                <div class="form-group">
                    <label for="team-description">Description</label>
                    <textarea
                        id="team-description"
                        bind:value={description}
                        placeholder="What's your team about?"
                        rows="2"
                        maxlength="200"
                    ></textarea>
                    <span class="char-count">{description.length}/200</span>
                </div>

                <!-- Icon Picker -->
                <div class="form-group">
                    <label>Team Icon</label>
                    <div class="icon-picker">
                        {#each iconOptions as opt}
                            <button
                                type="button"
                                class="icon-option"
                                class:selected={icon === opt}
                                on:click={() => icon = opt}
                            >
                                {opt}
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Color Picker -->
                <div class="form-group">
                    <label>Team Color</label>
                    <div class="color-picker">
                        {#each colorOptions as opt}
                            <button
                                type="button"
                                class="color-option"
                                class:selected={color === opt}
                                style="background: {opt}"
                                on:click={() => color = opt}
                            >
                                {#if color === opt}
                                    <span class="check">✓</span>
                                {/if}
                            </button>
                        {/each}
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
                    style="background: {color}"
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
        max-width: 440px;
        width: 100%;
        max-height: 85vh;
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

    .team-preview {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: linear-gradient(135deg, white 0%, color-mix(in srgb, var(--team-color) 10%, white) 100%);
        border: 2px solid var(--team-color);
        border-radius: 12px;
        margin-bottom: 20px;
    }

    .preview-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--team-color);
        border-radius: 12px;
        font-size: 24px;
    }

    .preview-name {
        font-size: 18px;
        font-weight: 600;
        color: #333;
    }

    .form-group {
        margin-bottom: 16px;
        position: relative;
    }

    .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-bottom: 6px;
    }

    .form-group input,
    .form-group textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        transition: border-color 0.2s;
    }

    .form-group input:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: #4CAF50;
    }

    .char-count {
        position: absolute;
        right: 8px;
        bottom: 8px;
        font-size: 11px;
        color: #999;
    }

    .icon-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .icon-option {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        border: 2px solid transparent;
        border-radius: 8px;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .icon-option:hover {
        background: #e8e8e8;
    }

    .icon-option.selected {
        border-color: #4CAF50;
        background: #e8f5e9;
    }

    .color-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .color-option {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 2px solid transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .color-option:hover {
        transform: scale(1.1);
    }

    .color-option.selected {
        border-color: white;
        box-shadow: 0 0 0 2px #333;
    }

    .color-option .check {
        color: white;
        font-size: 14px;
        font-weight: 700;
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
</style>
