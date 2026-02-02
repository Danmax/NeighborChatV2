<script>
    import { createEventDispatcher } from 'svelte';
    import { getEventSettings, canShowMeetingLink } from '../../stores/events.js';
    import { getInviteStatus, calculateAgendaDuration } from '../../stores/speakers.js';
    import { currentUser } from '../../stores/auth.js';

    export let event;
    export let isOwner = false;
    export let isAttending = false;
    export let meetingLink = null;

    const dispatch = createEventDispatcher();

    $: settings = getEventSettings(event);
    $: speakerInvites = event?.speaker_invites || [];
    $: acceptedTalks = speakerInvites.filter(i => i.invite_status === 'accepted').sort((a, b) => (a.order || 0) - (b.order || 0));
    $: pendingInvites = speakerInvites.filter(i => i.invite_status === 'pending');
    $: totalDuration = calculateAgendaDuration(speakerInvites);
    $: showMeetingLink = canShowMeetingLink(event, isAttending ? 'going' : null) && meetingLink;

    function handleInviteSpeaker() {
        dispatch('inviteSpeaker');
    }

    function handleUpdateInvite(inviteId, status) {
        dispatch('updateInvite', { inviteId, status });
    }

    function formatDuration(minutes) {
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
</script>

<div class="meetup-agenda">
    <div class="section-header">
        <h3>Agenda</h3>
        {#if totalDuration > 0}
            <span class="duration-badge">{formatDuration(totalDuration)}</span>
        {/if}
        {#if isOwner}
            <button class="invite-btn" on:click={handleInviteSpeaker}>
                + Invite Speaker
            </button>
        {/if}
    </div>

    <!-- Meeting Link -->
    {#if showMeetingLink}
        <div class="meeting-link-card">
            <div class="link-icon">🔗</div>
            <div class="link-content">
                <span class="link-label">Join Meeting</span>
                <a href={meetingLink} target="_blank" rel="noopener noreferrer" class="link-url">
                    {meetingLink}
                </a>
            </div>
        </div>
    {:else if event?.meeting_link && !showMeetingLink}
        <div class="meeting-link-locked">
            <span class="lock-icon">🔒</span>
            <span>RSVP "Going" to see the meeting link</span>
        </div>
    {/if}

    <!-- Accepted Talks -->
    {#if acceptedTalks.length > 0}
        <div class="talks-list">
            {#each acceptedTalks as invite, index (invite.id)}
                <div class="talk-card">
                    <div class="talk-order">{index + 1}</div>
                    <div class="talk-content">
                        <h4 class="talk-title">{invite.talk_title}</h4>
                        <div class="speaker-info">
                            <span class="speaker-name">{invite.speaker_name}</span>
                            <span class="talk-duration">{invite.duration_minutes || 30} min</span>
                        </div>
                        {#if invite.talk_abstract}
                            <p class="talk-abstract">{invite.talk_abstract}</p>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="empty-state">
            <p>No speakers confirmed yet.</p>
        </div>
    {/if}

    <!-- Pending Invites (organizer only) -->
    {#if isOwner && pendingInvites.length > 0}
        <div class="pending-section">
            <h4>Pending Invites</h4>
            <div class="pending-list">
                {#each pendingInvites as invite (invite.id)}
                    <div class="pending-card">
                        <div class="pending-info">
                            <span class="pending-speaker">{invite.speaker_name}</span>
                            <span class="pending-title">{invite.talk_title}</span>
                        </div>
                        <div class="pending-actions">
                            <button
                                class="status-btn accepted"
                                on:click={() => handleUpdateInvite(invite.id, 'accepted')}
                            >
                                Accept
                            </button>
                            <button
                                class="status-btn declined"
                                on:click={() => handleUpdateInvite(invite.id, 'declined')}
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Submit Talk (if enabled) -->
    {#if settings.meetup_allow_speaker_submissions && !isOwner}
        <button class="submit-talk-btn" on:click={() => dispatch('submitTalk')}>
            Submit a Talk Proposal
        </button>
    {/if}
</div>

<style>
    .meetup-agenda {
        background: var(--cream);
        border-radius: var(--radius-md);
        padding: 20px;
    }

    .section-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .section-header h3 {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
    }

    .duration-badge {
        background: var(--primary);
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
    }

    .invite-btn {
        margin-left: auto;
        padding: 8px 16px;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }

    .invite-btn:hover {
        background: var(--primary-dark);
    }

    .meeting-link-card {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #E3F2FD;
        border: 1px solid #2196F3;
        border-radius: var(--radius-sm);
        padding: 16px;
        margin-bottom: 16px;
    }

    .link-icon {
        font-size: 24px;
    }

    .link-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .link-label {
        font-size: 12px;
        font-weight: 600;
        color: #1565C0;
    }

    .link-url {
        color: #2196F3;
        text-decoration: none;
        font-size: 14px;
        word-break: break-all;
    }

    .link-url:hover {
        text-decoration: underline;
    }

    .meeting-link-locked {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--cream-dark);
        padding: 12px 16px;
        border-radius: var(--radius-sm);
        margin-bottom: 16px;
        color: var(--text-muted);
        font-size: 13px;
    }

    .lock-icon {
        font-size: 16px;
    }

    .talks-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .talk-card {
        display: flex;
        gap: 12px;
        background: white;
        border-radius: var(--radius-sm);
        padding: 16px;
        border: 1px solid var(--cream-dark);
    }

    .talk-order {
        width: 28px;
        height: 28px;
        background: var(--primary);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 600;
        flex-shrink: 0;
    }

    .talk-content {
        flex: 1;
    }

    .talk-title {
        font-size: 15px;
        font-weight: 600;
        margin: 0 0 6px;
    }

    .speaker-info {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
    }

    .speaker-name {
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }

    .talk-duration {
        font-size: 12px;
        color: var(--text-muted);
        background: var(--cream);
        padding: 2px 8px;
        border-radius: 10px;
    }

    .talk-abstract {
        font-size: 13px;
        color: var(--text-light);
        line-height: 1.5;
        margin: 0;
    }

    .empty-state {
        text-align: center;
        padding: 30px;
        color: var(--text-muted);
    }

    .pending-section {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--cream-dark);
    }

    .pending-section h4 {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 12px;
        color: #FF9800;
    }

    .pending-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .pending-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: white;
        padding: 12px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--cream-dark);
    }

    .pending-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .pending-speaker {
        font-weight: 600;
        font-size: 14px;
    }

    .pending-title {
        font-size: 12px;
        color: var(--text-muted);
    }

    .pending-actions {
        display: flex;
        gap: 8px;
    }

    .status-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }

    .status-btn.accepted {
        background: #4CAF50;
        color: white;
    }

    .status-btn.declined {
        background: #F44336;
        color: white;
    }

    .submit-talk-btn {
        width: 100%;
        margin-top: 16px;
        padding: 12px;
        background: white;
        border: 2px dashed var(--primary);
        border-radius: var(--radius-sm);
        color: var(--primary);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .submit-talk-btn:hover {
        background: var(--primary);
        color: white;
        border-style: solid;
    }
</style>
