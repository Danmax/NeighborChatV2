<script>
    import { createEventDispatcher } from 'svelte';
    import Avatar from '../avatar/Avatar.svelte';
    import { getRsvpStatus } from '../../stores/events.js';
    import { currentUser } from '../../stores/auth.js';

    export let show = false;
    export let event = null;
    export let participants = [];
    export let loading = false;
    export let canManage = false;

    const dispatch = createEventDispatcher();

    $: currentId = $currentUser?.user_uuid || $currentUser?.user_id;
    $: isOrganizer = canManage || event?.created_by === currentId;

    // Group participants by status
    $: goingParticipants = participants.filter(p => p.rsvp_status === 'going' && p.approval_status === 'approved');
    $: maybeParticipants = participants.filter(p => p.rsvp_status === 'maybe' && p.approval_status === 'approved');
    $: pendingParticipants = participants.filter(p => p.approval_status === 'pending');
    $: notGoingParticipants = participants.filter(p => p.rsvp_status === 'not_going');

    function handleClose() {
        dispatch('close');
    }

    function handleApprove(participantId) {
        dispatch('approve', { participantId });
    }

    function handleReject(participantId) {
        dispatch('reject', { participantId });
    }

    function handleCheckIn(participantId) {
        dispatch('checkin', { participantId });
    }

    function getRsvpLabel(status) {
        const info = getRsvpStatus(status);
        return info?.label || status;
    }

    function getRsvpColor(status) {
        const info = getRsvpStatus(status);
        return info?.color || '#9E9E9E';
    }
</script>

{#if show}
    <div
        class="modal-overlay"
        on:click|self={handleClose}
        on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && handleClose()}
        role="button"
        tabindex="0"
        aria-label="Close participants dialog"
    >
        <div class="modal-content">
            <div class="modal-header">
                <h2>Participants{event?.title ? ` · ${event.title}` : ''}</h2>
                <button class="modal-close" on:click={handleClose}>✕</button>
            </div>
            <div class="modal-body">
                {#if loading}
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading participants...</p>
                    </div>
                {:else if participants.length === 0}
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <p>No RSVPs yet</p>
                    </div>
                {:else}
                    <!-- Pending Approvals (organizer only) -->
                    {#if isOrganizer && pendingParticipants.length > 0}
                        <div class="participant-section">
                            <h3 class="section-title pending">Pending Approval ({pendingParticipants.length})</h3>
                            <ul class="participants-list">
                                {#each pendingParticipants as participant (participant.user_id)}
                                    <li class="pending-item">
                                        <Avatar avatar={participant.profile?.avatar} size="sm" />
                                        <div class="participant-info">
                                            <span class="participant-name">
                                                {participant.profile?.display_name || 'Neighbor'}
                                            </span>
                                            {#if participant.notes}
                                                <span class="participant-notes">{participant.notes}</span>
                                            {/if}
                                        </div>
                                        <div class="approval-actions">
                                            <button class="approve-btn" on:click={() => handleApprove(participant.user_id)}>Approve</button>
                                            <button class="reject-btn" on:click={() => handleReject(participant.user_id)}>Reject</button>
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}

                    <!-- Going -->
                    {#if goingParticipants.length > 0}
                        <div class="participant-section">
                            <h3 class="section-title going">Going ({goingParticipants.length})</h3>
                            <ul class="participants-list">
                                {#each goingParticipants as participant (participant.user_id)}
                                    <li>
                                        <Avatar avatar={participant.profile?.avatar} size="sm" />
                                        <div class="participant-info">
                                            <span class="participant-name">
                                                {participant.profile?.display_name || 'Neighbor'}
                                                {#if participant.checked_in}
                                                    <span class="checked-in-badge">Checked In</span>
                                                {/if}
                                            </span>
                                            <span class="participant-meta">
                                                {#if participant.guest_count > 0}
                                                    +{participant.guest_count} guest{participant.guest_count > 1 ? 's' : ''}
                                                {/if}
                                            </span>
                                        </div>
                                        {#if isOrganizer && !participant.checked_in}
                                            <button class="checkin-btn" on:click={() => handleCheckIn(participant.user_id)}>
                                                Check In
                                            </button>
                                        {/if}
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}

                    <!-- Maybe -->
                    {#if maybeParticipants.length > 0}
                        <div class="participant-section">
                            <h3 class="section-title maybe">Maybe ({maybeParticipants.length})</h3>
                            <ul class="participants-list">
                                {#each maybeParticipants as participant (participant.user_id)}
                                    <li>
                                        <Avatar avatar={participant.profile?.avatar} size="sm" />
                                        <div class="participant-info">
                                            <span class="participant-name">
                                                {participant.profile?.display_name || 'Neighbor'}
                                            </span>
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}

                    <!-- Not Going -->
                    {#if notGoingParticipants.length > 0}
                        <div class="participant-section">
                            <h3 class="section-title not-going">Not Going ({notGoingParticipants.length})</h3>
                            <ul class="participants-list">
                                {#each notGoingParticipants as participant (participant.user_id)}
                                    <li class="not-going-item">
                                        <Avatar avatar={participant.profile?.avatar} size="sm" />
                                        <div class="participant-info">
                                            <span class="participant-name">
                                                {participant.profile?.display_name || 'Neighbor'}
                                            </span>
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}
                {/if}
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
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--cream-dark, #E0E0E0);
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
        background: var(--cream, #F5F5DC);
        border-radius: 50%;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
    }

    .modal-close:hover {
        background: var(--cream-dark, #E0E0E0);
    }

    .modal-body {
        padding: 20px;
    }

    .participants-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .participants-list li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        background: var(--cream);
    }

    .participant-info {
        display: flex;
        flex-direction: column;
    }

    .participant-name {
        font-weight: 600;
        color: var(--text);
        font-size: 14px;
    }

    .participant-meta {
        font-size: 12px;
        color: var(--text-muted);
    }

    .loading-state,
    .empty-state {
        text-align: center;
        padding: 30px 20px;
        color: var(--text-muted);
    }

    .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--cream-dark);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .empty-icon {
        font-size: 40px;
        margin-bottom: 12px;
        opacity: 0.5;
    }

    .participant-section {
        margin-bottom: 20px;
    }

    .participant-section:last-child {
        margin-bottom: 0;
    }

    .section-title {
        font-size: 13px;
        font-weight: 600;
        margin: 0 0 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--cream-dark);
    }

    .section-title.going {
        color: #4CAF50;
    }

    .section-title.maybe {
        color: #FF9800;
    }

    .section-title.pending {
        color: #2196F3;
    }

    .section-title.not-going {
        color: #9E9E9E;
    }

    .pending-item {
        flex-wrap: wrap;
    }

    .not-going-item {
        opacity: 0.6;
    }

    .participant-notes {
        font-size: 12px;
        color: var(--text-light);
        font-style: italic;
    }

    .approval-actions {
        display: flex;
        gap: 8px;
        width: 100%;
        margin-top: 8px;
    }

    .approve-btn,
    .reject-btn,
    .checkin-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .approve-btn {
        background: #4CAF50;
        color: white;
    }

    .approve-btn:hover {
        background: #388E3C;
    }

    .reject-btn {
        background: #F44336;
        color: white;
    }

    .reject-btn:hover {
        background: #D32F2F;
    }

    .checkin-btn {
        background: var(--primary);
        color: white;
        margin-left: auto;
    }

    .checkin-btn:hover {
        background: var(--primary-dark);
    }

    .checked-in-badge {
        display: inline-block;
        background: #4CAF50;
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 6px;
        vertical-align: middle;
    }
</style>
