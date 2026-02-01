<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { events } from '../../stores/events.js';
    import { savedContacts } from '../../stores/contacts.js';
    import {
        fetchEventById,
        updateEventInDb,
        uploadEventImage,
        rsvpToEvent,
        addEventItem,
        removeEventItem,
        claimEventItem,
        assignEventItem,
        sendEventNotification,
        fetchEventParticipants,
        subscribeToEvent
    } from '../../services/events.service.js';
    import { fetchContacts } from '../../services/contacts.service.js';
    import EventForm from '../../components/events/EventForm.svelte';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import { showToast } from '../../stores/toasts.js';

    export let params = {};

    let eventData = null;
    let loading = true;
    let isEditing = false;
    let isOwner = false;
    let participants = [];
    let loadingParticipants = false;
    let subscription = null;

    let newItemName = '';
    let notifyMessage = '';
    let notifyTarget = 'attendees';
    let sendingNotify = false;
    let joining = false;

    $: eventId = params?.id;
    $: {
        const fromStore = $events.find(item => item.id === eventId);
        if (fromStore) {
            eventData = fromStore;
        }
    }
    $: isOwner = eventData?.created_by === $currentUser?.user_id;
    $: isAttending = eventData?.attendees?.includes($currentUser?.user_id);
    $: items = eventData?.items || [];

    onMount(async () => {
        if (!$isAuthenticated || !eventId) return;

        const existing = $events.find(item => item.id === eventId);
        if (existing) {
            eventData = existing;
            loading = false;
        }

        try {
            const fetched = await fetchEventById(eventId);
            eventData = fetched;
        } catch (err) {
            if (!existing) {
                showToast('Unable to load event.', 'error');
            }
        } finally {
            loading = false;
        }

        fetchContacts();
        loadParticipants();

        subscription = subscribeToEvent(eventId, (updated) => {
            if (updated) {
                eventData = updated;
            }
        });
    });

    onDestroy(() => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
        }
    });

    async function loadParticipants() {
        if (!eventId) return;
        loadingParticipants = true;
        try {
            participants = await fetchEventParticipants(eventId);
        } catch (err) {
            participants = [];
        } finally {
            loadingParticipants = false;
        }
    }


    async function handleUpdateEvent(event) {
        try {
            const payload = { ...event.detail };
            if (payload.cover_image_file) {
                payload.cover_image_url = await uploadEventImage(payload.cover_image_file);
            }
            delete payload.cover_image_file;

            const updated = await updateEventInDb(eventData.id, payload);
            eventData = updated;
            isEditing = false;
            showToast('Event updated!', 'success');
        } catch (err) {
            showToast(`Failed to update event: ${err.message}`, 'error');
        }
    }

    async function handleRsvp() {
        if (!eventData) return;
        try {
            joining = true;
            const updated = await rsvpToEvent(eventData.id, !isAttending);
            if (updated) {
                eventData = updated;
            }
        } catch (err) {
            showToast('Unable to join event. Please try again.', 'error');
        } finally {
            joining = false;
        }
    }

    async function handleAddItem() {
        if (!newItemName.trim()) return;
        const itemsToAdd = newItemName
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);

        if (itemsToAdd.length === 0) return;

        try {
            let updatedItems = eventData.items || [];
            for (const item of itemsToAdd) {
                updatedItems = await addEventItem(eventData.id, item);
            }
            eventData = { ...eventData, items: updatedItems || [] };
            newItemName = '';
            showToast(itemsToAdd.length > 1 ? 'Items added!' : 'Item added!', 'success');
        } catch (err) {
            showToast(`Failed to add item: ${err.message}`, 'error');
        }
    }

    async function handleRemoveItem(itemId) {
        try {
            const updatedItems = await removeEventItem(eventData.id, itemId);
            eventData = { ...eventData, items: updatedItems || [] };
            showToast('Item removed.', 'success');
        } catch (err) {
            showToast(`Failed to remove: ${err.message}`, 'error');
        }
    }

    async function handleClaimItem(itemId) {
        try {
            const updatedItems = await claimEventItem(eventData.id, itemId);
            eventData = { ...eventData, items: updatedItems || [] };
        } catch (err) {
            showToast(err.message || 'Unable to claim item', 'error');
        }
    }

    async function handleAssignItem(itemId, userId) {
        if (!userId) return;
        try {
            await assignEventItem(eventData.id, itemId, userId);
            showToast('Item assigned.', 'success');
        } catch (err) {
            showToast(`Failed to assign: ${err.message}`, 'error');
        }
    }

    async function handleSendNotification() {
        if (!notifyMessage.trim()) {
            showToast('Enter a message to send.', 'error');
            return;
        }
        sendingNotify = true;
        try {
            let targets = null;
            if (notifyTarget === 'contacts') {
                targets = ($savedContacts || []).map(c => c.user_id).filter(Boolean);
            }
            await sendEventNotification(eventData.id, notifyMessage.trim(), targets);
            notifyMessage = '';
            showToast('Notification sent.', 'success');
        } catch (err) {
            showToast(`Failed to send: ${err.message}`, 'error');
        } finally {
            sendingNotify = false;
        }
    }

    function formatEventDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function formatEventTime(timeStr) {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(hours, 10), parseInt(minutes || '0', 10));
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        }).toLowerCase();
    }
</script>

{#if $isAuthenticated}
    <div class="event-detail">
        <div class="detail-header">
            <button class="back-btn" on:click={() => push('/events')}>← Back</button>
            <h2 class="card-title">Event Details</h2>
            {#if isOwner}
                <button class="btn btn-secondary btn-small" on:click={() => isEditing = !isEditing}>
                    {isEditing ? 'Close Edit' : 'Edit'}
                </button>
            {/if}
        </div>

        {#if loading}
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading event...</p>
            </div>
        {:else if eventData}
            <div class="event-hero">
                {#if eventData.cover_image_url}
                    <img class="event-hero-image" src={eventData.cover_image_url} alt="Event cover" />
                {:else}
                    <div class="event-hero-placeholder"></div>
                {/if}
                <div class="event-hero-overlay">
                    <div class="event-hero-content">
                        <h3 class="event-title">{eventData.title}</h3>
                        <div class="event-meta">
                            <span>📅 {formatEventDate(eventData.date)}</span>
                            {#if eventData.time}
                                <span>🕐 {formatEventTime(eventData.time)}</span>
                            {/if}
                            {#if eventData.location}
                                <span>📍 {eventData.location}</span>
                            {/if}
                        </div>
                <button class="event-host" type="button" on:click={() => !isOwner && eventData.created_by && push(`/profile/view/${eventData.created_by}`)}>
                    <Avatar avatar={eventData.creator_avatar} size="sm" />
                    <span>Organizer: {isOwner ? 'You' : eventData.creator_name}</span>
                </button>
                    </div>
                    <div class="event-actions">
                        <button class="btn btn-primary" on:click={handleRsvp} disabled={joining}>
                            {joining ? 'Updating…' : isAttending ? 'Leave Event' : 'Join Event'}
                        </button>
                        <button class="btn btn-secondary" on:click={() => push('/contacts')}>
                            Message Organizer
                        </button>
                    </div>
                </div>
            </div>

            {#if eventData.description}
                <div class="card">
                    <h3 class="card-title">About this event</h3>
                    <p class="event-description">{eventData.description}</p>
                </div>
            {/if}

            {#if isEditing}
                <div class="card">
                    <h3 class="card-title">Edit Event</h3>
                    <EventForm
                        event={eventData}
                        loading={false}
                        on:submit={handleUpdateEvent}
                        on:cancel={() => isEditing = false}
                    />
                </div>
            {/if}

            <div class="card">
                <h3 class="card-title">Attendees</h3>
                {#if loadingParticipants}
                    <p>Loading attendees...</p>
                {:else if participants.length === 0}
                    <p class="empty-text">No attendees yet.</p>
                {:else}
                    <div class="attendee-list">
                        {#each participants as participant (participant.user_id)}
                            <div class="attendee-item">
                                <Avatar avatar={participant.profile?.avatar} size="sm" />
                                <span class="attendee-name">{participant.profile?.display_name || 'Neighbor'}</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if eventData.type === 'potluck'}
                <div class="card">
                    <h3 class="card-title">Potluck Items</h3>

                    {#if isOwner}
                        <div class="item-form">
                            <input
                                type="text"
                                placeholder="Add an item (e.g., salad, plates)"
                                bind:value={newItemName}
                            />
                            <button class="btn btn-secondary btn-small" on:click={handleAddItem}>
                                Add
                            </button>
                        </div>
                    {/if}

                    {#if items.length === 0}
                        <p class="empty-text">No items added yet.</p>
                    {:else}
                        <div class="items-list">
                            {#each items as item (item.id)}
                                <div class="item-row">
                                    <div class="item-info">
                                        <span class="item-name">{item.name}</span>
                                        <span class="item-status">{item.status || 'open'}</span>
                                        {#if item.claimed_by_name}
                                            <span class="item-claimer">Claimed by {item.claimed_by_name}</span>
                                        {/if}
                                    </div>
                                    <div class="item-actions">
                                        <button class="btn btn-claim btn-small" on:click={() => handleClaimItem(item.id)}>
                                            {item.claimed_by_id === $currentUser?.user_id ? 'Unclaim' : 'Claim'}
                                        </button>
                                        {#if isOwner}
                                            <select class="assign-select" on:change={(e) => handleAssignItem(item.id, e.target.value)}>
                                                <option value="">Assign to contact</option>
                                                {#each $savedContacts as contact}
                                                    <option value={contact.user_id}>{contact.name}</option>
                                                {/each}
                                            </select>
                                            <button class="btn btn-remove btn-small" on:click={() => handleRemoveItem(item.id)}>
                                                Remove
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}

            {#if eventData.attachments?.length}
                <div class="card">
                    <h3 class="card-title">Attachments</h3>
                    <ul class="attachments-list">
                        {#each eventData.attachments as attachment}
                            <li>
                                <a href={attachment} target="_blank" rel="noreferrer">{attachment}</a>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}

            {#if isOwner}
                <div class="card">
                    <h3 class="card-title">Notify Community</h3>
                    <textarea
                        rows="3"
                        placeholder="Send an update to attendees or contacts..."
                        bind:value={notifyMessage}
                    ></textarea>
                    <div class="notify-actions">
                        <select bind:value={notifyTarget}>
                            <option value="attendees">Attendees</option>
                            <option value="contacts">Contacts</option>
                        </select>
                        <button class="btn btn-primary btn-small" on:click={handleSendNotification} disabled={sendingNotify}>
                            {sendingNotify ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </div>
            {/if}
        {:else}
            <div class="empty-state">Event not found.</div>
        {/if}
    </div>
{/if}

<style>
    .event-detail {
        padding-bottom: 20px;
    }

    .detail-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
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

    .card {
        background: white;
        border-radius: var(--radius-md);
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .event-hero {
        position: relative;
        border-radius: var(--radius-md);
        overflow: hidden;
        margin-bottom: 16px;
        background: #f5f5f5;
        min-height: 220px;
    }

    .event-hero-image {
        width: 100%;
        height: 320px;
        object-fit: cover;
        display: block;
    }

    .event-hero-placeholder {
        width: 100%;
        height: 240px;
        background: linear-gradient(135deg, #f5f5f5, #e9e9e9);
    }

    .event-hero-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.65) 100%);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 20px;
        gap: 12px;
    }

    .event-hero-content {
        color: white;
    }

    .event-title {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 8px;
    }

    .event-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
    }

    .event-description {
        margin-top: 6px;
        font-size: 14px;
        color: var(--text);
    }

    .event-host {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
    }

    .event-actions {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .attendee-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
    }

    .attendee-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        padding: 8px 10px;
        border-radius: var(--radius-sm);
        transition: background 0.2s ease;
    }

    .attendee-item:hover {
        background: var(--cream);
    }

    .attendee-name {
        opacity: 0;
        max-width: 0;
        overflow: hidden;
        white-space: nowrap;
        transition: opacity 0.2s ease, max-width 0.2s ease;
    }

    .attendee-item:hover .attendee-name {
        opacity: 1;
        max-width: 160px;
    }

    .item-form {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    }

    .item-form input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
    }

    .items-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .item-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--cream);
        border-radius: var(--radius-sm);
    }

    .item-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .item-name {
        font-weight: 600;
    }

    .item-status {
        font-size: 12px;
        color: var(--text-muted);
    }

    .item-claimer {
        font-size: 12px;
        color: var(--text);
    }

    .item-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }

    .assign-select {
        padding: 6px 10px;
        border: 1px solid var(--cream-dark);
        border-radius: 999px;
        background: white;
        font-size: 12px;
    }

    .notify-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 12px;
    }

    .attachments-list {
        margin: 0;
        padding-left: 16px;
        display: grid;
        gap: 6px;
        font-size: 13px;
    }

    textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-family: inherit;
    }

    .btn {
        padding: 10px 16px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-claim {
        background: #E8F5E9;
        color: #2E7D32;
    }

    .btn-claim:hover {
        background: #C8E6C9;
    }

    .btn-remove {
        background: #FFEBEE;
        color: #C62828;
    }

    .btn-remove:hover {
        background: #FFCDD2;
    }

    .btn-small {
        padding: 8px 12px;
        font-size: 12px;
    }

    .loading-state {
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

    .empty-text,
    .empty-state {
        color: var(--text-muted);
        font-size: 13px;
    }
</style>
