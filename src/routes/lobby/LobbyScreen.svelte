<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { onlineUsersList, onlineContactsList, userStatus, isAvailable } from '../../stores/presence.js';
    import { upcomingEvents } from '../../stores/events.js';
    import {
        trackSentInvite,
        updateInviteStatus,
        hasInvitePending
    } from '../../stores/invites.js';
    import {
        setupPresenceChannel,
        trackPresence,
        updatePresenceStatus,
        cleanupChannels,
        sendChatInviteWithResponse
    } from '../../services/realtime.service.js';
    import { saveContact } from '../../services/contacts.service.js';
    import { fetchEvents, createEvent } from '../../services/events.service.js';
    import { showToast } from '../../stores/toasts.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import OnlineCount from '../../components/users/OnlineCount.svelte';
    import UserList from '../../components/users/UserList.svelte';
    import EventCard from '../../components/events/EventCard.svelte';
    import EventForm from '../../components/events/EventForm.svelte';

    // Redirect to auth if not authenticated
    $: if (!$isAuthenticated) {
        push('/auth');
    }

    let showAllUsers = false;
    let showAllOnline = false; // Toggle between contacts only and all online users
    let actionMessage = '';
    let actionError = '';
    let showCreateEventModal = false;
    let creatingEvent = false;

    // Determine which list to show based on toggle
    $: displayedUsers = showAllOnline ? $onlineUsersList : $onlineContactsList;

    // Show only public events, limited to 3
    $: publicUpcomingEvents = $upcomingEvents
        .filter(e => e.visibility === 'public' || e.visibility === undefined)
        .slice(0, 3);
    $: visibleUsers = showAllUsers ? displayedUsers : displayedUsers.slice(0, 3);

    onMount(() => {
        if ($isAuthenticated) {
            setupPresenceChannel();
            fetchEvents(); // Load events for dashboard
        }
    });

    onDestroy(() => {
        cleanupChannels();
    });

    function toggleAvailability() {
        const newStatus = $isAvailable ? 'away' : 'available';
        updatePresenceStatus(newStatus);
    }

    function handleUserAction(event) {
        // Always use invite flow instead of direct navigation
        handleInvite(event);
    }

    async function handleInvite(event) {
        const user = event.detail;
        actionMessage = '';
        actionError = '';

        // Check if invite is already pending
        if (hasInvitePending(user.user_id)) {
            actionError = `Invite already sent to ${user.name}. Waiting for response...`;
            setTimeout(() => actionError = '', 3000);
            return;
        }

        try {
            // Set up invite expiration timeout (60 seconds)
            const timeoutId = setTimeout(() => {
                updateInviteStatus(user.user_id, 'expired');
                actionError = `Invite to ${user.name} expired (no response)`;
                setTimeout(() => actionError = '', 3000);
            }, 60000);

            // Track the sent invite
            trackSentInvite(user.user_id, timeoutId);

            // Send invite with response handling
            const cleanup = await sendChatInviteWithResponse(user.user_id, (accepted, fromUser) => {
                if (accepted) {
                    // Invite accepted - update status and navigate to chat
                    updateInviteStatus(user.user_id, 'accepted');
                    actionMessage = `${user.name} accepted your invite!`;
                    setTimeout(() => actionMessage = '', 3000);
                    push(`/chat/${user.user_id}`);
                } else {
                    // Invite declined - update status and show message
                    updateInviteStatus(user.user_id, 'declined');
                    actionError = `${user.name} declined your invite`;
                    setTimeout(() => actionError = '', 3000);
                }

                // Cleanup response channel
                cleanup?.();
            });

            actionMessage = `Invite sent to ${user.name}. Waiting for response... (60s)`;
            setTimeout(() => {
                if (actionMessage.includes('Waiting for response')) {
                    actionMessage = '';
                }
            }, 3000);

        } catch (err) {
            console.error('Failed to send invite:', err);
            actionError = 'Failed to send invite: ' + err.message;
            setTimeout(() => actionError = '', 3000);
        }
    }

    async function handleSaveContact(event) {
        const user = event.detail;
        actionMessage = '';
        actionError = '';
        try {
            await saveContact({
                user_id: user.user_id,
                name: user.name,
                avatar: user.avatar,
                interests: user.interests || []
            });
            actionMessage = `${user.name} saved to contacts!`;
            setTimeout(() => actionMessage = '', 3000);
        } catch (err) {
            actionError = 'Failed to save contact: ' + err.message;
            setTimeout(() => actionError = '', 3000);
        }
    }

    function handleViewProfile(event) {
        const user = event.detail;
        // For now, show user info in an alert - could open a modal later
        const interests = user.interests?.join(', ') || 'None listed';
        alert(`👤 ${user.name}\n\n📋 Status: ${user.status || 'Unknown'}\n🏷️ Interests: ${interests}`);
    }

    function goToFindMatch() {
        push('/find-match');
    }

    async function handleCreateEvent(event) {
        const eventData = event.detail;
        creatingEvent = true;
        try {
            await createEvent(eventData);
            showToast('Event created successfully!', 'success');
            showCreateEventModal = false;
            await fetchEvents(); // Refresh events list
        } catch (err) {
            console.error('Failed to create event:', err);
            showToast('Failed to create event: ' + err.message, 'error');
        } finally {
            creatingEvent = false;
        }
    }
</script>

{#if $isAuthenticated}
    <div class="lobby-screen">
        <!-- Welcome Card -->
        <div class="card">
            <h2 class="card-title">
                <span class="icon">👋</span>
                Welcome, {$currentUser?.name || 'Neighbor'}!
            </h2>

            <OnlineCount />

            <!-- Availability Toggle -->
            <div class="availability-section">
                <button
                    class="availability-btn"
                    class:available={$isAvailable}
                    on:click={toggleAvailability}
                >
                    <span class="status-dot" class:online={$isAvailable}></span>
                    {$isAvailable ? 'Available to Chat' : 'Set as Available'}
                </button>
            </div>

            <div class="lobby-actions">
                <button class="btn btn-primary btn-full" on:click={goToFindMatch}>
                    🔍 Find Someone to Chat
                </button>

                <div style="display: flex; gap: 10px; margin-top: 16px;">
                    <a href="#/lobby-chat" class="btn btn-secondary" style="flex: 1; text-decoration: none;">
                        💬 Lobby Chat
                    </a>
                    <a href="#/events" class="btn btn-secondary" style="flex: 1; text-decoration: none;">
                        📅 Events
                    </a>
                </div>
            </div>
        </div>

        <!-- Action Messages -->
        {#if actionMessage}
            <div class="action-banner success">{actionMessage}</div>
        {/if}
        {#if actionError}
            <div class="action-banner error">{actionError}</div>
        {/if}

        <!-- Online Users -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">
                    <span class="icon">🟢</span>
                    {showAllOnline ? 'All Online Users' : 'Online Contacts'}
                </h3>
                <div class="header-actions">
                    <button
                        class="toggle-filter-btn"
                        on:click={() => showAllOnline = !showAllOnline}
                        title={showAllOnline ? 'Show contacts only' : 'Show all users'}
                    >
                        {showAllOnline ? '👥 Contacts Only' : '🌐 All Users'}
                    </button>
                    {#if displayedUsers.length > 3}
                        <button
                            class="see-all-btn"
                            on:click={() => showAllUsers = !showAllUsers}
                        >
                            {showAllUsers ? 'Show Less' : `See All (${displayedUsers.length})`}
                        </button>
                    {/if}
                </div>
            </div>

            <UserList
                users={visibleUsers}
                emptyMessage={showAllOnline ? 'No other neighbors online right now' : 'No contacts online right now'}
                emptyIcon="🏠"
                on:userAction={handleUserAction}
                on:invite={handleInvite}
                on:saveContact={handleSaveContact}
                on:viewProfile={handleViewProfile}
                maxHeight={showAllUsers ? '400px' : null}
            />

            {#if !showAllOnline && $onlineContactsList.length === 0}
                <div class="empty-prompt">
                    <p>Add neighbors as contacts to see when they're online!</p>
                    <button class="btn btn-secondary btn-small" on:click={() => showAllOnline = true}>
                        Browse All Users
                    </button>
                </div>
            {/if}
        </div>

        <!-- Quick Profile -->
        <div class="card">
            <h3 class="card-title">
                <span class="icon">👤</span>
                Your Profile
            </h3>

            <div class="profile-preview">
                <Avatar avatar={$currentUser?.avatar} size="lg" />
                <div class="profile-info">
                    <h4>{$currentUser?.name || 'User'}</h4>
                    <p>{$currentUser?.email || ''}</p>
                </div>
            </div>

            <a href="#/profile" class="btn btn-secondary btn-full" style="margin-top: 16px; text-decoration: none;">
                ✏️ Edit Profile
            </a>
        </div>

        <!-- My Events Preview -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">
                    <span class="icon">📅</span>
                    Upcoming Events
                </h3>
                <a href="#/events" class="see-all-btn">See All</a>
            </div>

            {#if publicUpcomingEvents.length > 0}
                <div class="events-preview-list">
                    {#each publicUpcomingEvents as event (event.id)}
                        <EventCard {event} compact={true} />
                    {/each}
                </div>
            {:else}
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p class="empty-state-text">No upcoming events</p>
                </div>
            {/if}

            <button
                class="btn btn-secondary btn-full"
                style="margin-top: 16px;"
                on:click={() => showCreateEventModal = true}
            >
                ➕ Create Event
            </button>
        </div>

        <!-- Event Creation Modal -->
        {#if showCreateEventModal}
            <div class="modal-overlay" on:click|self={() => showCreateEventModal = false}>
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Create New Event</h2>
                        <button class="modal-close" on:click={() => showCreateEventModal = false}>✕</button>
                    </div>
                    <div class="modal-body">
                        <EventForm
                            on:submit={handleCreateEvent}
                            on:cancel={() => showCreateEventModal = false}
                            loading={creatingEvent}
                        />
                    </div>
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .lobby-screen {
        padding-bottom: 20px;
    }

    .availability-section {
        display: flex;
        justify-content: center;
        margin: 16px 0;
    }

    .availability-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 24px;
        border: 2px solid var(--cream-dark);
        border-radius: 100px;
        background: white;
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .availability-btn:hover {
        border-color: var(--primary-light);
    }

    .availability-btn.available {
        background: #E8F5E9;
        border-color: #4CAF50;
        color: #2E7D32;
    }

    .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #9E9E9E;
        transition: background 0.2s ease;
    }

    .status-dot.online {
        background: #4CAF50;
    }

    .lobby-actions {
        margin-top: 20px;
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .card-header .card-title {
        margin-bottom: 0;
    }

    .header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .toggle-filter-btn {
        padding: 6px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: 16px;
        background: white;
        font-size: 12px;
        font-weight: 600;
        color: var(--primary);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .toggle-filter-btn:hover {
        border-color: var(--primary);
        background: rgba(45, 90, 71, 0.05);
    }

    .see-all-btn {
        background: none;
        border: none;
        color: var(--primary);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
    }

    .see-all-btn:hover {
        color: var(--primary-dark);
    }

    .empty-prompt {
        text-align: center;
        padding: 20px;
        background: var(--cream);
        border-radius: var(--radius-sm);
        margin-top: 16px;
    }

    .empty-prompt p {
        color: var(--text-muted);
        font-size: 14px;
        margin-bottom: 12px;
    }

    .profile-preview {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .profile-info h4 {
        color: var(--text);
        margin-bottom: 4px;
    }

    .profile-info p {
        color: var(--text-muted);
        font-size: 13px;
    }

    .empty-state {
        text-align: center;
        padding: 30px 20px;
        color: var(--text-muted);
    }

    .empty-state-icon {
        font-size: 40px;
        margin-bottom: 12px;
    }

    .empty-state-text {
        font-size: 14px;
    }

    /* Action Banners */
    .action-banner {
        padding: 12px 16px;
        border-radius: var(--radius-sm);
        margin-bottom: 16px;
        font-size: 14px;
        text-align: center;
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

    .action-banner.success {
        background: #E8F5E9;
        color: #2E7D32;
        border: 1px solid #A5D6A7;
    }

    .action-banner.error {
        background: #FFEBEE;
        color: #C62828;
        border: 1px solid #EF9A9A;
    }

    /* Events Preview List */
    .events-preview-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    /* Modal Styles */
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
        max-height: 90vh;
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
        font-size: 18px;
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
</style>
