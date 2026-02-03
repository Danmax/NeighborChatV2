<script>
    import { createEventDispatcher } from 'svelte';
    import EventCard from './EventCard.svelte';

    export let events = [];
    export let emptyMessage = 'No events yet';
    export let emptyIcon = '📅';
    export let compact = false;
    export let loading = false;
    export let joinState = new Set();
    export let activeMembershipId = null;
    export let layout = 'grid';

    const dispatch = createEventDispatcher();

    function handleEventClick(event) {
        dispatch('eventClick', event.detail);
    }

    function handleRsvp(event) {
        dispatch('rsvp', event.detail);
    }
</script>

<div class="event-list" class:compact class:upcoming={layout === 'upcoming'}>
    {#if loading}
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading events...</p>
        </div>
    {:else if events.length === 0}
        <div class="empty-state">
            <div class="empty-icon">{emptyIcon}</div>
            <p class="empty-message">{emptyMessage}</p>
        </div>
    {:else}
        {#each events as event, index (event.id)}
            <EventCard
                {event}
                {compact}
                featured={layout === 'upcoming' && index === 0 && !compact}
                variant={layout === 'upcoming' ? 'modern' : 'default'}
                joining={joinState?.has?.(event.id)}
                {activeMembershipId}
                on:click={handleEventClick}
                on:rsvp={handleRsvp}
            />
        {/each}
    {/if}
</div>

<style>
    .event-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
    }

    .event-list.upcoming {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .event-list.compact {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    @media (max-width: 900px) {
        :global(.event-list.upcoming .event-card.featured) {
            grid-column: span 1;
        }
    }

    .loading-state,
    .empty-state {
        grid-column: 1 / -1;
    }

    .loading-state, .empty-state {
        text-align: center;
        padding: 40px 20px;
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
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
    }

    .empty-message {
        font-size: 14px;
    }
</style>
