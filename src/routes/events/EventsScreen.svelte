<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { location } from 'svelte-spa-router';
    import {
        upcomingEvents,
        myEvents,
        pastEvents,
        draftEvents,
        publishedEvents,
        eventsLoading
    } from '../../stores/events.js';
    import { EVENT_TYPES } from '../../stores/events.js';
    import { fetchEvents, createEvent, uploadEventImage, subscribeToEvents, rsvpToEvent, getActiveMembershipId } from '../../services/events.service.js';
    import { fetchContacts } from '../../services/contacts.service.js';
    import EventList from '../../components/events/EventList.svelte';
    import EventForm from '../../components/events/EventForm.svelte';

    let activeTab = 'upcoming';
    let showCreateForm = false;
    let selectedType = 'all';
    let creating = false;
    let errorMessage = '';
    let joiningIds = new Set();
    let activeMembershipId = null;

    // Dynamic tabs based on whether user has drafts
    $: hasDrafts = $draftEvents.length > 0;

    $: tabs = [
        { id: 'upcoming', label: 'Upcoming', icon: '📅' },
        { id: 'mine', label: 'My Events', icon: '⭐' },
        ...(hasDrafts ? [{ id: 'drafts', label: 'Drafts', icon: '📝' }] : []),
        { id: 'past', label: 'Past', icon: '📜' }
    ];

    $: currentEvents = getEventsForTab(activeTab);
    $: filteredEvents = selectedType === 'all'
        ? currentEvents
        : currentEvents.filter(eventItem => eventItem.type === selectedType);

    function getEventsForTab(tab) {
        switch (tab) {
            case 'upcoming':
                // Filter out drafts from upcoming - only show published events
                return $upcomingEvents.filter(e => e.status !== 'draft');
            case 'mine':
                // Filter out drafts from my events - drafts have their own tab
                return $myEvents.filter(e => e.status !== 'draft');
            case 'drafts':
                return $draftEvents;
            case 'past':
                return $pastEvents;
            default:
                return [];
        }
    }

    let subscription = null;

    onMount(() => {
        if ($isAuthenticated) {
            fetchEvents();
            fetchContacts();
            subscription = subscribeToEvents();
            getActiveMembershipId().then(id => activeMembershipId = id);
        }

        if ($location?.includes('create=1')) {
            showCreateForm = true;
        }
    });

    onDestroy(() => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
        }
    });

    function handleTabChange(tabId) {
        errorMessage = '';
        activeTab = tabId;
        showCreateForm = false;
    }

    function openCreateForm() {
        showCreateForm = true;
        activeTab = 'upcoming';
    }

    async function handleCreateEvent(event) {
        creating = true;
        errorMessage = '';
        try {
            const payload = { ...event.detail };
            if (payload.cover_image_file) {
                payload.cover_image_url = await uploadEventImage(payload.cover_image_file);
            }
            delete payload.cover_image_file;

            await createEvent(payload);
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
            joiningIds = new Set(joiningIds);
            joiningIds.add(eventData.id);
            await rsvpToEvent(eventData.id, attending);
        } catch (err) {
            console.error('Failed to join event:', err);
            errorMessage = 'Unable to join event. Please try again.';
        } finally {
            joiningIds = new Set(joiningIds);
            joiningIds.delete(eventData.id);
        }
    }

    function handleEventClick(event) {
        const eventData = event.detail;
        push(`/events/${eventData.id}`);
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
                    class:active={activeTab === tab.id}
                    on:click={() => handleTabChange(tab.id)}
                >
                    <span class="tab-icon">{tab.icon}</span>
                    <span class="tab-label">{tab.label}</span>
                </button>
            {/each}
            <div class="type-filter">
                <label for="type-filter">Type</label>
                <select id="type-filter" bind:value={selectedType}>
                    <option value="all">All Types</option>
                    {#each EVENT_TYPES as typeOption}
                        <option value={typeOption.id}>{typeOption.label}</option>
                    {/each}
                </select>
            </div>
            <button class="btn btn-primary create-btn" on:click={openCreateForm}>
                ➕ Create Event
            </button>
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
                {#if !['admin', 'event_manager'].includes($currentUser?.role)}
                    <div class="access-banner">
                        <div>
                            <h4>Event Manager Access</h4>
                            <p>Request access to create and manage community events.</p>
                        </div>
                        <button class="btn btn-secondary" on:click={() => push('/profile')}>
                            Request Access
                        </button>
                    </div>
                {/if}
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
                    {:else if activeTab === 'drafts'}
                        <span class="icon">📝</span> Draft Events
                    {:else if activeTab === 'past'}
                        <span class="icon">📜</span> Past Events
                    {/if}
                </h3>

                <EventList
                    events={filteredEvents}
                    loading={$eventsLoading}
                    emptyMessage={
                        activeTab === 'upcoming' ? "No upcoming events. Why not create one?" :
                        activeTab === 'mine' ? "You haven't joined or created any events yet" :
                        activeTab === 'drafts' ? "No draft events. Create one and save as draft!" :
                        "No past events"
                    }
                    emptyIcon={
                        activeTab === 'upcoming' ? "📭" :
                        activeTab === 'mine' ? "⭐" :
                        activeTab === 'drafts' ? "📝" :
                        "📜"
                    }
                    layout={activeTab === 'upcoming' ? 'upcoming' : 'grid'}
                    on:eventClick={handleEventClick}
                    on:rsvp={handleRsvp}
                    joinState={joiningIds}
                    activeMembershipId={activeMembershipId}
                />

                {#if activeTab === 'upcoming' && filteredEvents.length === 0 && !$eventsLoading}
                    <button
                        class="btn btn-primary btn-full"
                        style="margin-top: 16px;"
                        on:click={openCreateForm}
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
        align-items: center;
    }

    .type-filter {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
    }

    .type-filter label {
        font-size: 12px;
        color: var(--text-muted);
    }

    .type-filter select {
        padding: 8px 10px;
        border: 1px solid var(--cream-dark);
        border-radius: 10px;
        font-size: 12px;
        background: white;
    }

    .create-btn {
        white-space: nowrap;
    }

    .access-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: #f3f6ff;
        border: 1px solid #d7e0ff;
        border-radius: var(--radius-sm);
        margin-bottom: 16px;
    }

    .access-banner h4 {
        margin: 0 0 4px;
        font-size: 14px;
    }

    .access-banner p {
        margin: 0;
        font-size: 12px;
        color: var(--text-muted);
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

</style>
