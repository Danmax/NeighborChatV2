<script>
    import { createEventDispatcher } from 'svelte';
    import { push } from 'svelte-spa-router';
    import Avatar from '../avatar/Avatar.svelte';
    import { getEventType } from '../../stores/events.js';
    import { currentUser } from '../../stores/auth.js';

    export let event;
    export let compact = false;

    const dispatch = createEventDispatcher();

    $: eventType = getEventType(event.type);
    $: isCreator = event.created_by === $currentUser?.user_id;
    $: isAttending = event.isAttending ?? event.attendees?.includes($currentUser?.user_id);
    $: attendeeCount = (event.attendeeCount ?? event.attendees?.length) || 0;
    $: formattedDate = formatDate(event.date);
    $: formattedTime = formatTime(event.time);
    $: isPast = new Date(event.date) < new Date();
    $: coverImage = event.cover_image_url || event.image_url || event.image;

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

    function handleRsvp(e) {
        e.stopPropagation();
        dispatch('rsvp', { event, attending: !isAttending });
    }

    function handleHostClick(e) {
        e.stopPropagation();
        if (isCreator || !event.created_by) return;
        push(`/profile/view/${event.created_by}`);
    }
</script>

<div
    class="event-card"
    class:compact
    class:past={isPast}
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

    {#if coverImage && !compact}
        <div class="event-cover">
            <img src={coverImage} alt="Event cover" loading="lazy" />
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
            </div>
        </div>
    </div>

    {#if !isPast}
        <button
            class="rsvp-btn"
            class:attending={isAttending}
            on:click={handleRsvp}
        >
            {isAttending ? '✓ Going' : 'RSVP'}
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

    .event-card:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        transform: translateY(-2px);
    }

    .event-card.compact {
        flex-direction: row;
        align-items: center;
        padding: 12px;
        gap: 12px;
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

    .event-cover img {
        width: 100%;
        height: auto;
        display: block;
        object-fit: cover;
    }

    .event-content {
        padding: 16px;
        flex: 1;
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
        color: var(--text-muted);
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-align: left;
    }

    .event-attendees {
        font-size: 12px;
        color: var(--text-muted);
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

    .rsvp-btn:hover {
        background: var(--primary-dark);
    }

    .rsvp-btn.attending {
        background: #4CAF50;
    }

    .compact .rsvp-btn {
        position: static;
        flex-shrink: 0;
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
</style>
