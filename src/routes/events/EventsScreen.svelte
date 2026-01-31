<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import {
        upcomingEvents,
        myEvents,
        pastEvents,
        eventsLoading
    } from '../../stores/events.js';
    import { fetchEvents, createEvent, rsvpToEvent } from '../../services/events.service.js';
    import EventList from '../../components/events/EventList.svelte';
    import EventForm from '../../components/events/EventForm.svelte';

    // Redirect if not authenticated
    $: if (!$isAuthenticated) {
        push('/auth');
    }

    let activeTab = 'upcoming';
    let showCreateForm = false;
    let creating = false;
    let errorMessage = '';

    const tabs = [
        { id: 'upcoming', label: 'Upcoming', icon: '📅' },
        { id: 'mine', label: 'My Events', icon: '⭐' },
        { id: 'past', label: 'Past', icon: '📜' },
        { id: 'create', label: 'Create', icon: '➕' }
    ];

    $: currentEvents = getEventsForTab(activeTab);

    function getEventsForTab(tab) {
        switch (tab) {
            case 'upcoming': return $upcomingEvents;
            case 'mine': return $myEvents;
            case 'past': return $pastEvents;
            default: return [];
        }
    }

    onMount(() => {
        if ($isAuthenticated) {
            fetchEvents();
        }
    });

    function handleTabChange(tabId) {
        errorMessage = '';
        if (tabId === 'create') {
            showCreateForm = true;
            activeTab = 'upcoming';
        } else {
            activeTab = tabId;
            showCreateForm = false;
        }
    }

    async function handleCreateEvent(event) {
        creating = true;
        errorMessage = '';
        try {
            await createEvent(event.detail);
            showCreateForm = false;
            activeTab = 'mine';
        } catch (err) {
            console.error('Failed to create event:', err);
            errorMessage = 'Failed to create event: ' + (err.message || 'Unknown error');
        } finally {
            creating = false;
        }
    }

    function dismissError() {
        errorMessage = '';
    }

    function goToSignIn() {
        push('/auth');
    }

    async function handleRsvp(event) {
        const { event: eventData, attending } = event.detail;
        try {
            await rsvpToEvent(eventData.id, attending);
        } catch (err) {
            console.error('Failed to RSVP:', err);
        }
    }

    function handleEventClick(event) {
        // Could navigate to event detail page
        console.log('Event clicked:', event.detail);
    }
</script>

{#if $isAuthenticated}
    <div class="events-screen">
        <div class="screen-header">
            <button class="back-btn" on:click={() => push('/')}>← Back</button>
            <h2 class="card-title">
                <span class="icon">📅</span>
                Community Events
            </h2>
        </div>

        <!-- Tabs -->
        <div class="tabs">
            {#each tabs as tab}
                <button
                    class="tab"
                    class:active={activeTab === tab.id || (tab.id === 'create' && showCreateForm)}
                    on:click={() => handleTabChange(tab.id)}
                >
                    <span class="tab-icon">{tab.icon}</span>
                    <span class="tab-label">{tab.label}</span>
                </button>
            {/each}
        </div>

        <!-- Error Banner -->
        {#if errorMessage}
            <div class="error-banner">
                <div class="error-content">
                    <span class="error-text">{errorMessage}</span>
                </div>
                <button class="error-dismiss" on:click={dismissError}>✕</button>
            </div>
        {/if}

        <!-- Create Event Form -->
        {#if showCreateForm}
            <div class="card">
                <h3 class="card-title">
                    <span class="icon">✨</span>
                    Create New Event
                </h3>
                <EventForm
                    loading={creating}
                    on:submit={handleCreateEvent}
                    on:cancel={() => showCreateForm = false}
                />
            </div>
        {:else}
            <!-- Events List -->
            <div class="card">
                <h3 class="card-title">
                    {#if activeTab === 'upcoming'}
                        <span class="icon">📅</span> Upcoming Events
                    {:else if activeTab === 'mine'}
                        <span class="icon">⭐</span> My Events
                    {:else if activeTab === 'past'}
                        <span class="icon">📜</span> Past Events
                    {/if}
                </h3>

                <EventList
                    events={currentEvents}
                    loading={$eventsLoading}
                    emptyMessage={
                        activeTab === 'upcoming' ? "No upcoming events. Why not create one?" :
                        activeTab === 'mine' ? "You haven't joined or created any events yet" :
                        "No past events"
                    }
                    emptyIcon={
                        activeTab === 'upcoming' ? "📭" :
                        activeTab === 'mine' ? "⭐" :
                        "📜"
                    }
                    on:eventClick={handleEventClick}
                    on:rsvp={handleRsvp}
                />

                {#if activeTab === 'upcoming' && currentEvents.length === 0 && !$eventsLoading}
                    <button
                        class="btn btn-primary btn-full"
                        style="margin-top: 16px;"
                        on:click={() => handleTabChange('create')}
                    >
                        ➕ Create the First Event
                    </button>
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    .events-screen {
        padding-bottom: 20px;
    }

    .screen-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
    }

    .screen-header .card-title {
        margin: 0;
    }

    .back-btn {
        background: none;
        border: none;
        color: var(--primary);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        padding: 8px 0;
    }

    .tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
        overflow-x: auto;
        padding-bottom: 4px;
    }

    .tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        border: none;
        border-radius: 100px;
        background: var(--cream);
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .tab:hover {
        background: var(--cream-dark);
    }

    .tab.active {
        background: var(--primary);
        color: white;
    }

    .tab-icon {
        font-size: 16px;
    }

    .card {
        background: white;
        border-radius: var(--radius-md);
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .card-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 18px;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 16px;
    }

    .icon {
        font-size: 24px;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-primary:hover {
        background: var(--primary-dark);
    }

    .btn-full {
        width: 100%;
    }

    /* Error Banner Styles */
    .error-banner {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        background: #FFF3E0;
        border: 1px solid #FFB74D;
        border-radius: var(--radius-sm);
        padding: 14px 16px;
        margin-bottom: 16px;
        animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .error-content {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
    }

    .error-text {
        color: #E65100;
        font-size: 14px;
        line-height: 1.4;
    }

    .error-dismiss {
        background: none;
        border: none;
        color: #E65100;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        opacity: 0.7;
        transition: opacity 0.2s ease;
    }

    .error-dismiss:hover {
        opacity: 1;
    }

    .btn-small {
        padding: 8px 16px;
        font-size: 13px;
        width: fit-content;
    }
</style>
