<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { availableUsers, userStatus, isAvailable } from '../../stores/presence.js';
    import {
        setupPresenceChannel,
        updatePresenceStatus,
        sendChatInvite,
        cleanupChannels
    } from '../../services/realtime.service.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import UserCard from '../../components/users/UserCard.svelte';
    import { INTERESTS } from '../../services/profile.service.js';

    // Redirect to auth if not authenticated
    $: if (!$isAuthenticated) {
        push('/auth');
    }

    let searching = false;
    let filterInterest = 'all';
    let inviteSent = null;

    // Get unique interests from available users
    $: userInterests = [...new Set(
        $availableUsers.flatMap(u => u.interests || [])
    )];

    // Filter users by interest
    $: filteredUsers = filterInterest === 'all'
        ? $availableUsers
        : $availableUsers.filter(u => u.interests?.includes(filterInterest));

    onMount(() => {
        if ($isAuthenticated) {
            setupPresenceChannel();
            // Auto-set as available when entering this screen
            updatePresenceStatus('available');
        }
    });

    onDestroy(() => {
        // Don't cleanup channels - they're shared
    });

    function toggleAvailability() {
        const newStatus = $isAvailable ? 'away' : 'available';
        updatePresenceStatus(newStatus);
    }

    async function inviteUser(user) {
        try {
            await sendChatInvite(user.user_id);
            inviteSent = user.user_id;

            // Navigate to chat with this user after a brief delay to show "Invite Sent"
            setTimeout(() => {
                push(`/chat/${user.user_id}`);
            }, 500);
        } catch (err) {
            console.error('Failed to send invite:', err);
        }
    }

    function getInterestLabel(id) {
        const interest = INTERESTS.find(i => i.id === id);
        return interest ? `${interest.emoji} ${interest.label}` : id;
    }
</script>

{#if $isAuthenticated}
    <div class="find-match-screen">
        <div class="screen-header">
            <button class="back-btn" on:click={() => push('/')}>← Back</button>
            <h2 class="card-title">
                <span class="icon">🔍</span>
                Find a Chat Partner
            </h2>
        </div>

        <!-- Availability Status -->
        <div class="card">
            <div class="status-section">
                <div class="my-status">
                    <Avatar avatar={$currentUser?.avatar} size="md" />
                    <div class="status-info">
                        <span class="status-name">{$currentUser?.name}</span>
                        <span class="status-label" class:available={$isAvailable}>
                            {$isAvailable ? '🟢 Available' : '⚪ Not Available'}
                        </span>
                    </div>
                </div>

                <button
                    class="toggle-btn"
                    class:active={$isAvailable}
                    on:click={toggleAvailability}
                >
                    {$isAvailable ? 'Go Offline' : 'Go Online'}
                </button>
            </div>

            {#if !$isAvailable}
                <div class="availability-notice">
                    <p>Set yourself as available to be matched with other neighbors!</p>
                </div>
            {/if}
        </div>

        <!-- Filter by Interest -->
        {#if userInterests.length > 0}
            <div class="filter-section">
                <span class="filter-label">Filter by interest:</span>
                <div class="filter-chips">
                    <button
                        class="filter-chip"
                        class:active={filterInterest === 'all'}
                        on:click={() => filterInterest = 'all'}
                    >
                        All
                    </button>
                    {#each userInterests.slice(0, 5) as interest}
                        <button
                            class="filter-chip"
                            class:active={filterInterest === interest}
                            on:click={() => filterInterest = interest}
                        >
                            {getInterestLabel(interest)}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Available Users -->
        <div class="card">
            <h3 class="card-title">
                <span class="icon">👥</span>
                Available to Chat ({filteredUsers.length})
            </h3>

            {#if filteredUsers.length === 0}
                <div class="empty-state">
                    <div class="waiting-animation">
                        <div class="waiting-circles">
                            <div class="waiting-circle">🏠</div>
                            <div class="waiting-circle">💬</div>
                        </div>
                    </div>
                    <p class="waiting-text">Waiting for neighbors...</p>
                    <p class="waiting-subtext">
                        {$isAvailable
                            ? "We'll match you when someone joins!"
                            : "Set yourself as available to be matched"}
                    </p>
                </div>
            {:else}
                <div class="users-grid">
                    {#each filteredUsers as user (user.user_id)}
                        <div class="user-match-card">
                            <Avatar avatar={user.avatar} size="lg" />
                            <h4 class="user-name">{user.name}</h4>

                            {#if user.interests?.length > 0}
                                <div class="user-interests">
                                    {user.interests.slice(0, 4).map(id => {
                                        const i = INTERESTS.find(x => x.id === id);
                                        return i?.emoji || '';
                                    }).join(' ')}
                                </div>
                            {/if}

                            <button
                                class="invite-btn"
                                class:sent={inviteSent === user.user_id}
                                on:click={() => inviteUser(user)}
                                disabled={inviteSent === user.user_id}
                            >
                                {inviteSent === user.user_id ? '✓ Invite Sent' : '💬 Chat'}
                            </button>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .find-match-screen {
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

    .status-section {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }

    .my-status {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .status-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .status-name {
        font-weight: 600;
        color: var(--text);
    }

    .status-label {
        font-size: 13px;
        color: var(--text-muted);
    }

    .status-label.available {
        color: #2E7D32;
    }

    .toggle-btn {
        padding: 10px 20px;
        border: 2px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        background: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .toggle-btn:hover {
        border-color: var(--primary);
    }

    .toggle-btn.active {
        background: #FFEBEE;
        border-color: #EF5350;
        color: #C62828;
    }

    .availability-notice {
        margin-top: 16px;
        padding: 12px 16px;
        background: #FFF3E0;
        border-radius: var(--radius-sm);
        text-align: center;
    }

    .availability-notice p {
        color: #E65100;
        font-size: 13px;
        margin: 0;
    }

    .filter-section {
        margin-bottom: 16px;
    }

    .filter-label {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 8px;
        display: block;
    }

    .filter-chips {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .filter-chip {
        padding: 6px 14px;
        border: 1px solid var(--cream-dark);
        border-radius: 100px;
        background: white;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .filter-chip:hover {
        border-color: var(--primary-light);
    }

    .filter-chip.active {
        background: var(--primary);
        border-color: var(--primary);
        color: white;
    }

    .empty-state {
        text-align: center;
        padding: 30px 20px;
    }

    .waiting-animation {
        margin-bottom: 20px;
    }

    .waiting-circles {
        display: flex;
        justify-content: center;
        gap: 20px;
    }

    .waiting-circle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        animation: bounce 1.5s ease-in-out infinite;
    }

    .waiting-circle:nth-child(2) {
        animation-delay: 0.2s;
        background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
    }

    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }

    .waiting-text {
        font-size: 16px;
        color: var(--text);
        margin-bottom: 4px;
    }

    .waiting-subtext {
        font-size: 13px;
        color: var(--text-muted);
    }

    .users-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .user-match-card {
        padding: 16px;
        background: var(--cream);
        border-radius: var(--radius-sm);
        text-align: center;
        transition: all 0.2s ease;
    }

    .user-match-card:hover {
        background: var(--cream-dark);
    }

    .user-match-card .user-name {
        margin: 10px 0 4px;
        font-size: 14px;
        color: var(--text);
    }

    .user-match-card .user-interests {
        font-size: 16px;
        margin-bottom: 12px;
        letter-spacing: 2px;
    }

    .invite-btn {
        width: 100%;
        padding: 10px;
        border: none;
        border-radius: var(--radius-sm);
        background: var(--primary);
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .invite-btn:hover:not(:disabled) {
        background: var(--primary-dark);
    }

    .invite-btn.sent {
        background: #4CAF50;
    }

    .invite-btn:disabled {
        cursor: default;
    }
</style>
