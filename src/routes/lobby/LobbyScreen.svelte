<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { onlineUsersList, userStatus, isAvailable } from '../../stores/presence.js';
    import {
        setupPresenceChannel,
        trackPresence,
        updatePresenceStatus,
        cleanupChannels,
        sendChatInvite
    } from '../../services/realtime.service.js';
    import { saveContact } from '../../services/contacts.service.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import OnlineCount from '../../components/users/OnlineCount.svelte';
    import UserList from '../../components/users/UserList.svelte';

    // Redirect to auth if not authenticated
    $: if (!$isAuthenticated) {
        push('/auth');
    }

    let showAllUsers = false;
    let actionMessage = '';
    let actionError = '';

    onMount(() => {
        if ($isAuthenticated) {
            setupPresenceChannel();
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
        const user = event.detail;
        // Navigate to chat with this user
        push(`/chat/${user.user_id}`);
    }

    async function handleInvite(event) {
        const user = event.detail;
        actionMessage = '';
        actionError = '';
        try {
            await sendChatInvite(user.user_id);
            actionMessage = `Invite sent to ${user.name}!`;
            setTimeout(() => actionMessage = '', 3000);
            // Also navigate to the chat
            push(`/chat/${user.user_id}`);
        } catch (err) {
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
                    Online Now
                </h3>
                {#if $onlineUsersList.length > 3}
                    <button
                        class="see-all-btn"
                        on:click={() => showAllUsers = !showAllUsers}
                    >
                        {showAllUsers ? 'Show Less' : `See All (${$onlineUsersList.length})`}
                    </button>
                {/if}
            </div>

            <UserList
                users={showAllUsers ? $onlineUsersList : $onlineUsersList.slice(0, 3)}
                emptyMessage="No other neighbors online right now"
                emptyIcon="🏠"
                on:userAction={handleUserAction}
                on:invite={handleInvite}
                on:saveContact={handleSaveContact}
                on:viewProfile={handleViewProfile}
                maxHeight={showAllUsers ? '400px' : null}
            />
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
                    <h4>{$currentUser?.name || 'Guest'}</h4>
                    <p>{$currentUser?.isGuest ? 'Guest User' : $currentUser?.email || ''}</p>
                </div>
            </div>

            <a href="#/profile" class="btn btn-secondary btn-full" style="margin-top: 16px; text-decoration: none;">
                ✏️ Edit Profile
            </a>
        </div>

        <!-- My Events Preview -->
        <div class="card">
            <h3 class="card-title">
                <span class="icon">📅</span>
                Upcoming Events
            </h3>

            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p class="empty-state-text">No upcoming events</p>
            </div>

            <button class="btn btn-secondary btn-full" style="margin-top: 16px;">
                ➕ Create Event
            </button>
        </div>
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
</style>
