<script>
    import { createEventDispatcher } from 'svelte';
    import Avatar from '../avatar/Avatar.svelte';
    import { INTERESTS } from '../../services/profile.service.js';

    export let contact;
    export let showInterests = true;
    export let compact = false;

    const dispatch = createEventDispatcher();

    let menuOpen = false;

    function getInterestEmojis(interestIds = []) {
        return interestIds
            .slice(0, 4)
            .map(id => {
                const interest = INTERESTS.find(i => i.id === id);
                return interest?.emoji || '';
            })
            .join(' ');
    }

    function handleClick() {
        dispatch('click', contact);
    }

    function toggleMenu(e) {
        e.stopPropagation();
        menuOpen = !menuOpen;
    }

    function handleChat(e) {
        e.stopPropagation();
        menuOpen = false;
        dispatch('chat', contact);
    }

    function handleEdit(e) {
        e.stopPropagation();
        menuOpen = false;
        dispatch('edit', contact);
    }

    function handleToggleFavorite(e) {
        e.stopPropagation();
        menuOpen = false;
        dispatch('toggleFavorite', contact);
    }

    function handleRemove(e) {
        e.stopPropagation();
        menuOpen = false;
        dispatch('remove', contact);
    }

    function closeMenu() {
        menuOpen = false;
    }
</script>

<svelte:window on:click={closeMenu} />

<div
    class="contact-card"
    class:compact
    on:click={handleClick}
    on:keypress={(e) => e.key === 'Enter' && handleClick()}
    role="button"
    tabindex="0"
>
    <div class="contact-avatar">
        <Avatar avatar={contact.avatar} size="sm" />
        {#if contact.favorite}
            <div class="favorite-badge">⭐</div>
        {/if}
    </div>

    <div class="contact-info">
        <div class="contact-name">{contact.name}</div>
        {#if contact.notes}
            <div class="contact-notes">{contact.notes}</div>
        {/if}
        {#if showInterests && contact.interests?.length > 0}
            <div class="contact-interests">
                {getInterestEmojis(contact.interests)}
            </div>
        {/if}
    </div>

    <div class="contact-actions">
        <button class="action-btn chat-btn" on:click={handleChat} title="Chat">
            💬
        </button>
    </div>

    <div class="contact-menu-wrapper">
        <button class="menu-toggle" on:click={toggleMenu} title="More options">
            ⋮
        </button>
        {#if menuOpen}
            <div class="contact-menu">
                <button class="menu-item" on:click={handleChat}>
                    <span class="menu-icon">💬</span>
                    Chat
                </button>
                <button class="menu-item" on:click={handleEdit}>
                    <span class="menu-icon">✏️</span>
                    Edit Notes
                </button>
                <button class="menu-item" on:click={handleToggleFavorite}>
                    <span class="menu-icon">{contact.favorite ? '☆' : '⭐'}</span>
                    {contact.favorite ? 'Remove Favorite' : 'Add Favorite'}
                </button>
                <div class="menu-divider"></div>
                <button class="menu-item danger" on:click={handleRemove}>
                    <span class="menu-icon">🗑️</span>
                    Remove Contact
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
    .contact-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px;
        background: white;
        border-radius: 12px;
        border: 1px solid var(--cream-dark, #E0E0E0);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .contact-card:hover {
        background: var(--cream, #F5F5DC);
        border-color: var(--primary, #4CAF50);
    }

    .contact-card:active {
        transform: scale(0.98);
    }

    .contact-card.compact {
        padding: 12px;
        gap: 10px;
    }

    .contact-avatar {
        position: relative;
        flex-shrink: 0;
    }

    .favorite-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        font-size: 16px;
    }

    .contact-info {
        flex: 1;
        min-width: 0;
    }

    .contact-name {
        font-weight: 600;
        color: var(--text);
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .compact .contact-name {
        font-size: 13px;
    }

    .contact-notes {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .contact-interests {
        font-size: 12px;
        margin-top: 4px;
        letter-spacing: 2px;
    }

    .contact-actions {
        flex-shrink: 0;
    }

    .action-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .action-btn:hover {
        background: var(--primary);
        color: white;
        transform: scale(1.1);
    }

    .compact .action-btn {
        width: 32px;
        height: 32px;
        font-size: 12px;
    }

    /* Menu Styles */
    .contact-menu-wrapper {
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

    .contact-menu {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        z-index: 100;
        min-width: 170px;
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

    .menu-item.danger {
        color: #D32F2F;
    }

    .menu-item.danger:hover {
        background: #FFEBEE;
    }

    .menu-icon {
        font-size: 16px;
        min-width: 16px;
    }

    .menu-divider {
        height: 1px;
        background: var(--cream-dark);
        margin: 4px 0;
    }
</style>
