<script>
    import { createEventDispatcher } from 'svelte';
    import { push } from 'svelte-spa-router';
    import Avatar from '../avatar/Avatar.svelte';
    import { getEventType, getCapacityInfo, getRsvpStatus } from '../../stores/events.js';
    import { currentUser } from '../../stores/auth.js';

    export let event;
    export let compact = false;
    export let joining = false;
    export let activeMembershipId = null;
    export let featured = false;
    export let variant = 'default';

    const dispatch = createEventDispatcher();

    $: eventType = getEventType(event.type);
    $: currentId = $currentUser?.user_uuid || $currentUser?.user_id;
    $: isCreator = event.created_by === currentId;
    $: isAttending = event.isAttending ?? (activeMembershipId ? event.attendees?.includes(activeMembershipId) : event.attendees?.includes($currentUser?.user_id));
    $: attendeeCount = (event.attendeeCount ?? event.attendees?.length) || 0;
    $: formattedDate = formatDate(event.date);
    $: formattedTime = formatTime(event.time);
    $: isPast = new Date(event.date) < new Date();
    $: coverImage = event.cover_image_url || event.image_url || event.image;

    // New status and capacity
    $: eventStatus = event.status || 'published';
    $: isDraft = eventStatus === 'draft';
    $: isClosed = eventStatus === 'closed';
    $: capacityInfo = getCapacityInfo(event);
    $: myRsvpStatus = event.myRsvpStatus || (isAttending ? 'going' : null);
    $: rsvpStatusInfo = myRsvpStatus ? getRsvpStatus(myRsvpStatus) : null;

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        }

        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function handleClick() {
        dispatch('click', event);
    }


    function handleHostClick(e) {
        e.stopPropagation();
        if (isCreator || !event.created_by) return;
        push(`/profile/view/${event.created_by}`);
    }

    function handleRsvp(e) {
        e.stopPropagation();
        dispatch('rsvp', { event, attending: !isAttending });
    }
</script>

<div
    class="event-card"
    class:featured
    class:compact
    class:modern={variant === 'modern'}
    class:past={isPast}
    class:draft={isDraft}
    class:closed={isClosed}
    on:click={handleClick}
    on:keypress={(e) => e.key === 'Enter' && handleClick()}
    role="button"
    tabindex="0"
>
    <div class="event-type-badge" style="background: {eventType.color}">
        <span class="type-emoji">{eventType.emoji}</span>
        {#if !compact}
            <span class="type-label">{eventType.label}</span>
        {/if}
    </div>

    <!-- Status Badge -->
    {#if isDraft}
        <span class="status-badge status-draft">Draft</span>
    {:else if isClosed}
        <span class="status-badge status-closed">Closed</span>
    {/if}

    {#if coverImage && !compact}
        <div class="event-cover">
            <img src={coverImage} alt="Event cover" loading="lazy" />
            {#if variant === 'modern'}
                <div class="cover-overlay"></div>
            {/if}
        </div>
    {/if}

    <div class="event-content">
        <h4 class="event-title">{event.title}</h4>

        <div class="event-datetime">
            <span class="event-date">📅 {formattedDate}</span>
            {#if event.time}
                <span class="event-time">🕐 {formattedTime}</span>
            {/if}
        </div>

        {#if event.location && !compact}
            <div class="event-location">📍 {event.location}</div>
        {/if}

        {#if !compact && event.description}
            <p class="event-description">{event.description}</p>
        {/if}

        {#if !compact && isCreator && event.invited_user_ids?.length}
            <div class="event-invites">Invited {event.invited_user_ids.length} contacts</div>
        {/if}

        <div class="event-footer">
            <button class="event-host" type="button" on:click={handleHostClick}>
                <Avatar avatar={event.creator_avatar} size="sm" />
                <span>{isCreator ? 'You' : event.creator_name}</span>
            </button>

            <div class="event-attendees">
                <span class="attendee-count">👥 {attendeeCount}</span>
                {#if capacityInfo.hasCapacity}
                    <span class="capacity-indicator" class:full={capacityInfo.isFull}>
                        / {capacityInfo.spotsTotal}
                    </span>
                {/if}
            </div>
        </div>

        {#if myRsvpStatus && !compact}
            <div class="my-rsvp-status" style="color: {rsvpStatusInfo?.color}">
                {rsvpStatusInfo?.emoji} {rsvpStatusInfo?.label}
            </div>
        {/if}
    </div>

    {#if !isPast}
        <button
            class="rsvp-btn"
            class:attending={isAttending}
            on:click={handleRsvp}
            disabled={joining}
        >
            {joining ? 'Joining…' : isAttending ? '✓ Joined' : 'Join Event'}
        </button>
    {:else}
        <span class="past-badge">Past</span>
    {/if}
</div>

<style>
    .event-card {
        display: flex;
        flex-direction: column;
        background: white;
        border-radius: var(--radius-md);
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
    }

    .event-card.modern {
        background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
        border: 1px solid #e8eef9;
        border-radius: 18px;
        box-shadow: 0 12px 28px rgba(20, 40, 80, 0.12);
    }

    .event-card:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        transform: translateY(-2px);
    }

    .event-card.modern:hover {
        box-shadow: 0 18px 36px rgba(20, 40, 80, 0.18);
        transform: translateY(-4px);
    }

    .event-card.compact {
        flex-direction: row;
        align-items: center;
        padding: 12px;
        gap: 12px;
    }

    .event-card.featured {
        border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .event-card.past {
        opacity: 0.7;
    }

    .event-type-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        color: white;
        font-size: 12px;
        font-weight: 600;
    }

    .event-card.modern .event-type-badge {
        position: absolute;
        top: 12px;
        left: 12px;
        border-radius: 999px;
        z-index: 2;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
    }

    .compact .event-type-badge {
        padding: 6px 10px;
        border-radius: 20px;
        flex-shrink: 0;
    }

    .type-emoji {
        font-size: 16px;
    }

    .event-cover {
        width: 100%;
        background: #f5f5f5;
        max-height: 220px;
        overflow: hidden;
    }

    .event-card.modern .event-cover {
        position: relative;
        aspect-ratio: 16 / 9;
        max-height: none;
        border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    }

    .event-card.featured .event-cover {
        max-height: 320px;
    }

    .event-cover img {
        width: 100%;
        height: auto;
        display: block;
        object-fit: cover;
    }

    .cover-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.25) 100%);
    }

    .event-content {
        padding: 16px;
        flex: 1;
    }

    .event-card.modern .event-content {
        padding: 18px;
    }

    .event-card.featured .event-content {
        padding: 20px;
    }

    .compact .event-content {
        padding: 0;
    }

    .event-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 8px;
    }

    .event-card.modern .event-title {
        font-size: 18px;
        letter-spacing: -0.2px;
    }
    .event-card.featured .event-title {
        font-size: 20px;
        margin-bottom: 10px;
    }

    .compact .event-title {
        font-size: 14px;
        margin-bottom: 4px;
    }

    .event-datetime {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 8px;
    }

    .event-card.featured .event-datetime {
        font-size: 14px;
    }

    .event-location {
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 8px;
    }

    .event-description {
        font-size: 13px;
        color: var(--text-light);
        line-height: 1.4;
        margin-bottom: 12px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .event-invites {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 10px;
    }

    .event-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .event-host {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #1b2b22;
        background: rgba(45, 90, 71, 0.12);
        border: 1px solid rgba(45, 90, 71, 0.2);
        padding: 6px 10px;
        border-radius: 999px;
        cursor: pointer;
        text-align: left;
    }

    .event-attendees {
        font-size: 12px;
        color: var(--text-muted);
    }

    .past-badge {
        position: absolute;
        top: 12px;
        right: 12px;
        padding: 6px 12px;
        border-radius: 20px;
        background: var(--cream-dark);
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 600;
    }

    .compact .past-badge {
        position: static;
    }

    .rsvp-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        padding: 8px 16px;
        border: none;
        border-radius: 20px;
        background: var(--primary);
        color: white;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .event-card.featured .rsvp-btn {
        padding: 10px 18px;
        font-size: 13px;
    }

    .rsvp-btn:hover {
        background: var(--primary-dark);
    }

    .rsvp-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .rsvp-btn.attending {
        background: #4CAF50;
    }

    .compact .rsvp-btn {
        position: static;
        flex-shrink: 0;
    }

    /* Status badges */
    .status-badge {
        position: absolute;
        top: 44px;
        right: 12px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .status-draft {
        background: #9E9E9E;
        color: white;
    }

    .status-closed {
        background: #F44336;
        color: white;
    }

    .event-card.draft {
        border: 2px dashed #9E9E9E;
    }

    .event-card.closed {
        opacity: 0.8;
    }

    /* Capacity indicator */
    .capacity-indicator {
        font-size: 11px;
        color: var(--text-muted);
    }

    .capacity-indicator.full {
        color: #F44336;
        font-weight: 600;
    }

    /* RSVP status display */
    .my-rsvp-status {
        font-size: 12px;
        font-weight: 600;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--cream-dark);
    }
</style>
