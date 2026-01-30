<script>
    import { createEventDispatcher } from 'svelte';
    import UserCard from './UserCard.svelte';

    export let users = [];
    export let emptyMessage = 'No users online';
    export let emptyIcon = '👥';
    export let showInterests = true;
    export let showAction = true;
    export let actionLabel = 'Chat';
    export let compact = false;
    export let maxHeight = null;

    const dispatch = createEventDispatcher();

    function handleUserClick(event) {
        dispatch('userClick', event.detail);
    }

    function handleUserAction(event) {
        dispatch('userAction', event.detail);
    }

    function handleInvite(event) {
        dispatch('invite', event.detail);
    }

    function handleSaveContact(event) {
        dispatch('saveContact', event.detail);
    }

    function handleViewProfile(event) {
        dispatch('viewProfile', event.detail);
    }
</script>

<div
    class="users-list"
    class:compact
    style={maxHeight ? `max-height: ${maxHeight}; overflow-y: auto;` : ''}
>
    {#if users.length === 0}
        <div class="empty-state">
            <div class="empty-state-icon">{emptyIcon}</div>
            <p class="empty-state-text">{emptyMessage}</p>
        </div>
    {:else}
        {#each users as user (user.user_id)}
            <UserCard
                {user}
                {showInterests}
                {showAction}
                {actionLabel}
                {compact}
                on:click={handleUserClick}
                on:action={handleUserAction}
                on:invite={handleInvite}
                on:saveContact={handleSaveContact}
                on:viewProfile={handleViewProfile}
            />
        {/each}
    {/if}
</div>

<style>
    .users-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .users-list.compact {
        gap: 6px;
    }

    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
    }

    .empty-state-icon {
        font-size: 48px;
        margin-bottom: 12px;
    }

    .empty-state-text {
        font-size: 14px;
    }
</style>
