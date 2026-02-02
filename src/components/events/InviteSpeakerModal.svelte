<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { fetchSpeakers } from '../../services/speakers.service.js';
    import { showToast } from '../../stores/toasts.js';

    export let show = false;
    export let event = null;
    export let loading = false;

    const dispatch = createEventDispatcher();

    let speakers = [];
    let loadingSpeakers = false;
    let selectedSpeakerId = '';
    let inviteMode = 'existing';
    let speakerName = '';
    let speakerEmail = '';
    let talkTitle = '';
    let talkAbstract = '';
    let duration = 30;

    $: emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(speakerEmail.trim());
    $: isValid = (
        inviteMode === 'existing'
            ? selectedSpeakerId
            : speakerName.trim() && emailValid
    ) && talkTitle.trim() && talkAbstract.trim();

    // Load speakers when modal opens
    $: if (show && speakers.length === 0) {
        loadSpeakers();
    }

    // Reset form when modal opens
    $: if (show) {
        selectedSpeakerId = '';
        inviteMode = 'existing';
        speakerName = '';
        speakerEmail = '';
        talkTitle = '';
        talkAbstract = '';
        duration = 30;
    }

    async function loadSpeakers() {
        try {
            loadingSpeakers = true;
            speakers = await fetchSpeakers();
        } catch (err) {
            console.error('Failed to load speakers:', err);
            showToast('Failed to load speakers', 'error');
        } finally {
            loadingSpeakers = false;
        }
    }

    function handleClose() {
        dispatch('close');
    }

    function handleSubmit() {
        if (!isValid || loading) return;

        dispatch('submit', {
            mode: inviteMode,
            speakerId: inviteMode === 'existing' ? selectedSpeakerId : null,
            speakerName: inviteMode === 'email' ? speakerName.trim() : null,
            speakerEmail: inviteMode === 'email' ? speakerEmail.trim().toLowerCase() : null,
            talkTitle: talkTitle.trim(),
            talkAbstract: talkAbstract.trim(),
            duration: parseInt(duration)
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
        aria-label="Close invite speaker dialog"
    >
        <div class="modal-content">
            <div class="modal-header">
                <h2>Invite Speaker</h2>
                <button class="modal-close" on:click={handleClose}>✕</button>
            </div>

            <div class="modal-body">
                {#if loadingSpeakers}
                    <div class="loading-state">
                        <span class="spinner"></span>
                        <p>Loading speakers...</p>
                    </div>
                {:else}
                    <div class="invite-mode">
                        <button
                            class:active={inviteMode === 'existing'}
                            type="button"
                            on:click={() => inviteMode = 'existing'}
                        >
                            Select Speaker
                        </button>
                        <button
                            class:active={inviteMode === 'email'}
                            type="button"
                            on:click={() => inviteMode = 'email'}
                        >
                            Invite by Email
                        </button>
                    </div>

                    <!-- Speaker Selection -->
                    {#if inviteMode === 'existing'}
                        {#if speakers.length === 0}
                            <div class="empty-state">
                                <p>No speakers found yet. Invite by email or create a speaker profile.</p>
                            </div>
                        {/if}
                        <div class="form-group">
                            <label for="speaker-select">Select Speaker *</label>
                            <select id="speaker-select" bind:value={selectedSpeakerId}>
                                <option value="">-- Choose a speaker --</option>
                                {#each speakers as speaker (speaker.id)}
                                    <option value={speaker.id}>
                                        {speaker.name}
                                        {speaker.title ? `- ${speaker.title}` : ''}
                                        {speaker.company ? `(${speaker.company})` : ''}
                                    </option>
                                {/each}
                            </select>
                        </div>
                    {:else}
                        <div class="form-group">
                            <label for="speaker-name">Speaker Name *</label>
                            <input
                                id="speaker-name"
                                type="text"
                                bind:value={speakerName}
                                placeholder="e.g., Jordan Lee"
                                maxlength="120"
                            />
                        </div>
                        <div class="form-group">
                            <label for="speaker-email">Speaker Email *</label>
                            <input
                                id="speaker-email"
                                type="email"
                                bind:value={speakerEmail}
                                placeholder="e.g., jordan@example.com"
                                maxlength="160"
                            />
                            {#if speakerEmail && !emailValid}
                                <span class="help-text error">Enter a valid email address.</span>
                            {/if}
                        </div>
                    {/if}

                    <!-- Talk Title -->
                    <div class="form-group">
                        <label for="talk-title">Talk Title *</label>
                        <input
                            id="talk-title"
                            type="text"
                            bind:value={talkTitle}
                            placeholder="e.g., Building Svelte Apps in 2026"
                            maxlength="200"
                        />
                        <span class="char-count">{talkTitle.length}/200</span>
                    </div>

                    <!-- Talk Abstract -->
                    <div class="form-group">
                        <label for="talk-abstract">Talk Abstract *</label>
                        <textarea
                            id="talk-abstract"
                            bind:value={talkAbstract}
                            placeholder="Brief description of the talk..."
                            rows="3"
                            maxlength="1000"
                        ></textarea>
                        <span class="char-count">{talkAbstract.length}/1000</span>
                    </div>

                    <!-- Duration -->
                    <div class="form-group">
                        <label for="duration">Duration *</label>
                        <select id="duration" bind:value={duration}>
                            <option value="15">15 minutes</option>
                            <option value="30">30 minutes</option>
                            <option value="45">45 minutes</option>
                            <option value="60">60 minutes</option>
                            <option value="90">90 minutes</option>
                        </select>
                    </div>
                {/if}
            </div>

            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={handleClose} disabled={loading || loadingSpeakers}>
                    Cancel
                </button>
                <button
                    class="btn btn-primary"
                    on:click={handleSubmit}
                    disabled={!isValid || loading || loadingSpeakers || (inviteMode === 'existing' && speakers.length === 0)}
                >
                    {loading ? 'Sending...' : 'Send Invitation'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }

    .modal-content {
        background: white;
        border-radius: var(--radius-lg, 16px);
        max-width: 480px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        max-height: 90vh;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--cream-dark);
        flex-shrink: 0;
    }

    .modal-header h2 {
        font-size: 18px;
        font-weight: 600;
        color: var(--text);
        margin: 0;
    }

    .modal-close {
        width: 32px;
        height: 32px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
    }

    .modal-close:hover {
        background: var(--cream-dark);
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    }

    .invite-mode {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 16px;
    }

    .invite-mode button {
        border: 1px solid var(--cream-dark);
        background: var(--cream);
        color: var(--text);
        padding: 10px 12px;
        border-radius: 999px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .invite-mode button.active {
        background: var(--brand, #4CAF50);
        border-color: var(--brand, #4CAF50);
        color: white;
    }

    .help-text.error {
        color: #c0392b;
        font-size: 12px;
        margin-top: 6px;
        display: block;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
    }

    .form-group label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm, 8px);
        font-size: 14px;
        font-family: inherit;
        transition: border-color 0.2s ease;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: var(--primary);
    }

    .form-group textarea {
        resize: vertical;
        min-height: 80px;
    }

    .char-count {
        font-size: 11px;
        color: var(--text-muted);
        align-self: flex-end;
    }

    .loading-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        gap: 12px;
    }

    .spinner {
        display: inline-block;
        width: 24px;
        height: 24px;
        border: 3px solid var(--cream-dark);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .empty-state p {
        color: var(--text-muted);
        font-size: 14px;
        text-align: center;
    }

    .modal-footer {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        padding: 16px 20px;
        border-top: 1px solid var(--cream-dark);
        flex-shrink: 0;
    }

    .btn {
        padding: 10px 20px;
        border: none;
        border-radius: var(--radius-sm, 8px);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background: var(--primary-dark, #1565C0);
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-secondary:hover:not(:disabled) {
        background: var(--cream-dark);
    }
</style>
