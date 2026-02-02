<script>
    import { createEventDispatcher } from 'svelte';
    import Avatar from '../avatar/Avatar.svelte';
    import { interestOptions } from '../../stores/options.js';

    export let user;
    export let showInterests = true;
    export let showAction = true;
    export let actionLabel = 'Chat';
    export let compact = false;
    export let showMenu = true;

    const dispatch = createEventDispatcher();

    let menuOpen = false;

    function getInterestEmojis(interestIds = []) {
        return interestIds
            .slice(0, 4)
            .map(id => {
                const interest = $interestOptions.find(i => i.id === id);
                return interest?.emoji || '';
            })
            .join(' ');
    }

    function handleClick() {
        dispatch('click', user);
    }

    function handleAction(e) {
        e.stopPropagation();
        dispatch('action', user);
    }

    function toggleMenu(e) {
        e.stopPropagation();
        menuOpen = !menuOpen;
    }

    function handleInvite(e) {
        e.stopPropagation();
        menuOpen = false;
        dispatch('invite', user);
    }

    function handleSaveContact(e) {
        e.stopPropagation();
        menuOpen = false;
        dispatch('saveContact', user);
    }

    function handleViewProfile(e) {
        e.stopPropagation();
        menuOpen = false;
        dispatch('viewProfile', user);
    }

    function closeMenu() {
        menuOpen = false;
    }
</script>

<svelte:window on:click={closeMenu} />

<div
    class="user-card"
    class:compact
    on:click={handleClick}
    on:keypress={(e) => e.key === 'Enter' && handleClick()}
    role="button"
    tabindex="0"
>
    <div class="user-avatar-wrapper">
        <Avatar
            avatar={user.avatar}
            size={compact ? 'sm' : 'md'}
            showPresence={true}
            online={user.status === 'available'}
        />
    </div>

    <div class="user-info">
        <div class="user-name">
            {user.name || 'Neighbor'}
            {#if user.status === 'available'}
                <span class="status-indicator available"></span>
            {/if}
        </div>

        {#if showInterests && user.interests?.length > 0}
            <div class="user-interests">
                {getInterestEmojis(user.interests)}
            </div>
        {/if}
    </div>

    {#if showAction}
        <button class="user-action-btn" on:click={handleAction} title="Chat">
            {actionLabel === 'Chat' ? '💬' : actionLabel}
        </button>
    {/if}

    {#if showMenu}
        <div class="user-menu-wrapper">
            <button class="menu-toggle" on:click={toggleMenu} title="More options">
                ⋮
            </button>
            {#if menuOpen}
                <div class="user-menu">
                    <button class="menu-item" on:click={handleInvite}>
                        <span class="menu-icon">💬</span>
                        Invite to Chat
                    </button>
                    <button class="menu-item" on:click={handleSaveContact}>
                        <span class="menu-icon">💾</span>
                        Save Contact
                    </button>
                    <button class="menu-item" on:click={handleViewProfile}>
                        <span class="menu-icon">👤</span>
                        View Profile
                    </button>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .user-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px;
        background: var(--cream);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .user-card:hover {
        background: var(--cream-dark);
        transform: translateX(4px);
    }

    .user-card.compact {
        padding: 10px;
        gap: 10px;
    }

    .user-avatar-wrapper {
        position: relative;
    }

    .user-info {
        flex: 1;
        min-width: 0;
    }

    .user-name {
        font-weight: 600;
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #9E9E9E;
    }

    .status-indicator.available {
        background: #4CAF50;
    }

    .user-interests {
        font-size: 16px;
        margin-top: 4px;
        letter-spacing: 2px;
    }

    .user-action-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: var(--primary);
        color: white;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .user-action-btn:hover {
        background: var(--primary-dark);
        transform: scale(1.1);
    }

    .compact .user-action-btn {
        width: 32px;
        height: 32px;
        font-size: 14px;
    }

    /* User Menu Styles */
    .user-menu-wrapper {
        position: relative;
    }

    .menu-toggle {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--text-muted);
        font-size: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .menu-toggle:hover {
        background: var(--cream-dark);
        color: var(--text);
    }

    .user-menu {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        z-index: 100;
        min-width: 160px;
        animation: menuFadeIn 0.15s ease;
    }

    @keyframes menuFadeIn {
        from {
            opacity: 0;
            transform: translateY(-8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 16px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
        color: var(--text);
        transition: background 0.15s ease;
        text-align: left;
    }

    .menu-item:hover {
        background: var(--cream);
    }

    .menu-icon {
        font-size: 16px;
    }
</style>
