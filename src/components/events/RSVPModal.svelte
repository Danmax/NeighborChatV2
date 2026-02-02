<script>
    import { createEventDispatcher } from 'svelte';
    import { RSVP_STATUSES, getCapacityInfo } from '../../stores/events.js';

    export let show = false;
    export let event = null;
    export let currentStatus = null;
    export let loading = false;

    const dispatch = createEventDispatcher();

    let rsvpStatus = currentStatus || 'going';
    let guestCount = 0;
    let notes = '';

    $: capacityInfo = getCapacityInfo(event);
    $: maxGuests = capacityInfo.hasCapacity
        ? Math.max(0, capacityInfo.spotsRemaining - 1)
        : 10;

    // Reset when modal opens
    $: if (show) {
        rsvpStatus = currentStatus || 'going';
        guestCount = 0;
        notes = '';
    }

    function handleClose() {
        dispatch('close');
    }

    function handleSubmit() {
        dispatch('submit', {
            rsvpStatus,
            guestCount: rsvpStatus === 'going' ? guestCount : 0,
            notes: notes.trim() || null
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
        aria-label="Close RSVP dialog"
    >
        <div class="modal-content">
            <div class="modal-header">
                <h2>RSVP to {event?.title || 'Event'}</h2>
                <button class="modal-close" on:click={handleClose}>✕</button>
            </div>

            <div class="modal-body">
                <!-- Capacity Warning -->
                {#if capacityInfo.hasCapacity && capacityInfo.isFull && !currentStatus}
                    <div class="capacity-warning">
                        This event is at full capacity. You can still RSVP as "Maybe" or join the waitlist.
                    </div>
                {/if}

                <!-- RSVP Status Selection -->
                <div class="status-section">
                    <label class="section-label">Are you going?</label>
                    <div class="status-options">
                        {#each RSVP_STATUSES as status}
                            <button
                                type="button"
                                class="status-option"
                                class:selected={rsvpStatus === status.id}
                                class:disabled={capacityInfo.isFull && status.id === 'going' && !currentStatus}
                                style="--status-color: {status.color}"
                                on:click={() => rsvpStatus = status.id}
                                disabled={capacityInfo.isFull && status.id === 'going' && !currentStatus}
                            >
                                <span class="status-emoji">{status.emoji}</span>
                                <span class="status-label">{status.label}</span>
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Guest Count (only for "Going") -->
                {#if rsvpStatus === 'going'}
                    <div class="guest-section">
                        <label class="section-label">Bringing guests?</label>
                        <div class="guest-counter">
                            <button
                                type="button"
                                class="counter-btn"
                                on:click={() => guestCount = Math.max(0, guestCount - 1)}
                                disabled={guestCount === 0}
                            >
                                -
                            </button>
                            <span class="guest-count">{guestCount}</span>
                            <button
                                type="button"
                                class="counter-btn"
                                on:click={() => guestCount = Math.min(maxGuests, guestCount + 1)}
                                disabled={guestCount >= maxGuests}
                            >
                                +
                            </button>
                        </div>
                        {#if guestCount > 0}
                            <span class="guest-text">{guestCount} guest{guestCount > 1 ? 's' : ''}</span>
                        {/if}
                        {#if capacityInfo.hasCapacity}
                            <span class="spots-left">
                                {capacityInfo.spotsRemaining} spot{capacityInfo.spotsRemaining !== 1 ? 's' : ''} remaining
                            </span>
                        {/if}
                    </div>
                {/if}

                <!-- Notes -->
                <div class="notes-section">
                    <label class="section-label" for="rsvp-notes">
                        Notes (optional)
                    </label>
                    <textarea
                        id="rsvp-notes"
                        bind:value={notes}
                        placeholder="Dietary restrictions, arrival time, etc."
                        rows="2"
                        maxlength="200"
                    ></textarea>
                </div>

                {#if event?.join_policy === 'approval' && !currentStatus}
                    <div class="approval-notice">
                        Note: This event requires organizer approval. Your RSVP will be pending until approved.
                    </div>
                {/if}
            </div>

            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={handleClose} disabled={loading}>
                    Cancel
                </button>
                <button class="btn btn-primary" on:click={handleSubmit} disabled={loading}>
                    {loading ? 'Saving...' : currentStatus ? 'Update RSVP' : 'Confirm RSVP'}
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
        max-width: 420px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--cream-dark);
    }

    .modal-header h2 {
        font-size: 16px;
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
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal-close:hover {
        background: var(--cream-dark);
    }

    .modal-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .section-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 8px;
    }

    .capacity-warning {
        background: #FFF3E0;
        border: 1px solid #FF9800;
        color: #E65100;
        padding: 12px;
        border-radius: var(--radius-sm);
        font-size: 13px;
    }

    .status-options {
        display: flex;
        gap: 8px;
    }

    .status-option {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 16px 12px;
        border: 2px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .status-option:hover:not(:disabled) {
        border-color: var(--status-color);
    }

    .status-option.selected {
        border-color: var(--status-color);
        background: color-mix(in srgb, var(--status-color) 10%, white);
    }

    .status-option.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .status-emoji {
        font-size: 24px;
    }

    .status-label {
        font-size: 13px;
        font-weight: 600;
    }

    .guest-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    .guest-counter {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .counter-btn {
        width: 40px;
        height: 40px;
        border: 2px solid var(--cream-dark);
        border-radius: 50%;
        background: white;
        font-size: 20px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .counter-btn:hover:not(:disabled) {
        border-color: var(--primary);
        color: var(--primary);
    }

    .counter-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .guest-count {
        font-size: 24px;
        font-weight: 600;
        min-width: 40px;
        text-align: center;
    }

    .guest-text {
        font-size: 13px;
        color: var(--text);
    }

    .spots-left {
        font-size: 12px;
        color: var(--text-muted);
    }

    .notes-section textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
    }

    .notes-section textarea:focus {
        outline: none;
        border-color: var(--primary);
    }

    .approval-notice {
        background: #E3F2FD;
        border: 1px solid #2196F3;
        color: #1565C0;
        padding: 12px;
        border-radius: var(--radius-sm);
        font-size: 13px;
    }

    .modal-footer {
        display: flex;
        gap: 12px;
        padding: 20px;
        border-top: 1px solid var(--cream-dark);
    }

    .btn {
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: var(--radius-sm);
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
        background: var(--primary-dark);
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-secondary:hover:not(:disabled) {
        background: var(--cream-dark);
    }
</style>
