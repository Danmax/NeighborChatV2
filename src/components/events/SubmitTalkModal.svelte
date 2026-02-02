<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { fetchSpeakers } from '../../services/speakers.service.js';
    import { showToast } from '../../stores/toasts.js';

    export let show = false;
    export let event = null;
    export let currentUserId = null;
    export let loading = false;

    const dispatch = createEventDispatcher();

    let existingSpeaker = null;
    let useExisting = false;
    let loadingSpeakers = false;

    // Speaker profile fields
    let speakerName = '';
    let speakerTitle = '';
    let speakerCompany = '';
    let speakerBio = '';

    // Talk fields
    let talkTitle = '';
    let talkAbstract = '';
    let duration = 30;

    $: isValid =
        talkTitle.trim() &&
        talkAbstract.trim() &&
        (useExisting || speakerName.trim());

    // Load speaker profile when modal opens
    $: if (show && !existingSpeaker) {
        loadExistingSpeaker();
    }

    // Reset form when modal opens
    $: if (show) {
        talkTitle = '';
        talkAbstract = '';
        duration = 30;
        if (!existingSpeaker) {
            speakerName = '';
            speakerTitle = '';
            speakerCompany = '';
            speakerBio = '';
            useExisting = false;
        } else {
            useExisting = true;
        }
    }

    async function loadExistingSpeaker() {
        if (!currentUserId) return;

        try {
            loadingSpeakers = true;
            const speakers = await fetchSpeakers();
            existingSpeaker = speakers.find(s => s.created_by_id === currentUserId);
            if (existingSpeaker) {
                useExisting = true;
            }
        } catch (err) {
            console.error('Failed to load speaker profile:', err);
            existingSpeaker = null;
            useExisting = false;
        } finally {
            loadingSpeakers = false;
        }
    }

    function handleClose() {
        dispatch('close');
    }

    function handleSubmit() {
        if (!isValid || loading) return;

        const speakerProfile = useExisting
            ? { id: existingSpeaker.id }
            : {
                  name: speakerName.trim(),
                  title: speakerTitle.trim() || null,
                  company: speakerCompany.trim() || null,
                  bio: speakerBio.trim() || null,
                  created_by_id: currentUserId
              };

        dispatch('submit', {
            speakerProfile,
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
        aria-label="Close submit talk dialog"
    >
        <div class="modal-content">
            <div class="modal-header">
                <h2>Submit a Talk Proposal</h2>
                <button class="modal-close" on:click={handleClose}>✕</button>
            </div>

            <div class="modal-body">
                {#if loadingSpeakers}
                    <div class="loading-state">
                        <span class="spinner"></span>
                        <p>Loading your profile...</p>
                    </div>
                {:else}
                    <!-- Speaker Profile Section -->
                    {#if existingSpeaker}
                        <div class="form-group">
                            <label>Speaker Profile</label>
                            <div class="profile-options">
                                <label class="profile-option">
                                    <input type="radio" bind:group={useExisting} value={true} />
                                    <span>Use my speaker profile</span>
                                    <span class="profile-name">{existingSpeaker.name}</span>
                                </label>
                                <label class="profile-option">
                                    <input type="radio" bind:group={useExisting} value={false} />
                                    <span>Create new speaker profile</span>
                                </label>
                            </div>
                        </div>
                    {/if}

                    <!-- New Speaker Profile Fields -->
                    {#if !useExisting}
                        <div class="speaker-section">
                            {#if existingSpeaker}
                                <p class="section-subtitle">Create a new speaker profile</p>
                            {/if}

                            <div class="form-group">
                                <label for="speaker-name">Your Name *</label>
                                <input
                                    id="speaker-name"
                                    type="text"
                                    bind:value={speakerName}
                                    placeholder="e.g., Jane Smith"
                                    maxlength="100"
                                />
                            </div>

                            <div class="form-group">
                                <label for="speaker-title">Your Title</label>
                                <input
                                    id="speaker-title"
                                    type="text"
                                    bind:value={speakerTitle}
                                    placeholder="e.g., Senior Developer"
                                    maxlength="100"
                                />
                            </div>

                            <div class="form-group">
                                <label for="speaker-company">Company</label>
                                <input
                                    id="speaker-company"
                                    type="text"
                                    bind:value={speakerCompany}
                                    placeholder="e.g., Tech Co."
                                    maxlength="100"
                                />
                            </div>

                            <div class="form-group">
                                <label for="speaker-bio">Short Bio</label>
                                <textarea
                                    id="speaker-bio"
                                    bind:value={speakerBio}
                                    placeholder="Tell us about yourself..."
                                    rows="2"
                                    maxlength="500"
                                ></textarea>
                                <span class="char-count">{speakerBio.length}/500</span>
                            </div>
                        </div>
                    {/if}

                    <!-- Talk Details Section -->
                    <div class="talk-section">
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

                        <div class="form-group">
                            <label for="talk-abstract">Talk Abstract *</label>
                            <textarea
                                id="talk-abstract"
                                bind:value={talkAbstract}
                                placeholder="Brief description of your talk..."
                                rows="3"
                                maxlength="1000"
                            ></textarea>
                            <span class="char-count">{talkAbstract.length}/1000</span>
                        </div>

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
                    </div>

                    <div class="notice">
                        💡 Your talk proposal will be reviewed by the event organizer.
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
                    disabled={!isValid || loading || loadingSpeakers}
                >
                    {loading ? 'Submitting...' : 'Submit Proposal'}
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
        max-width: 500px;
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

    .profile-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .profile-option {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm, 8px);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .profile-option:hover {
        background: var(--cream);
    }

    .profile-option input {
        width: 16px;
        height: 16px;
        cursor: pointer;
    }

    .profile-option span {
        font-size: 14px;
        color: var(--text);
    }

    .profile-name {
        font-size: 13px;
        color: var(--text-muted);
        margin-left: auto;
    }

    .speaker-section,
    .talk-section {
        margin-bottom: 16px;
    }

    .section-subtitle {
        font-size: 12px;
        color: var(--text-muted);
        margin: 0 0 12px 0;
        font-style: italic;
    }

    .notice {
        background: var(--cream);
        padding: 12px;
        border-radius: var(--radius-sm, 8px);
        font-size: 12px;
        color: var(--text);
        line-height: 1.4;
    }

    .loading-state {
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
