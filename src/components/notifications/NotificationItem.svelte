<script>
    import { createEventDispatcher } from 'svelte';
    import { getNotificationIcon, NOTIFICATION_TYPES } from '../../stores/notifications.js';
    import Avatar from '../avatar/Avatar.svelte';

    export let notification;

    const dispatch = createEventDispatcher();

    $: icon = getNotificationIcon(notification.type);
    $: formattedTime = formatTime(notification.created_at);
    $: hasAvatar = notification.data?.from_user_avatar;

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    function handleClick() {
        dispatch('click', notification);
    }

    function handleAction(e) {
        e.stopPropagation();
        dispatch('action', notification);
    }

    function handleDismiss(e) {
        e.stopPropagation();
        dispatch('dismiss', notification);
    }
</script>

<div
    class="notification-item"
    class:unread={!notification.read}
    on:click={handleClick}
    on:keypress={(e) => e.key === 'Enter' && handleClick()}
    role="button"
    tabindex="0"
>
    <div class="notification-icon">
        {#if hasAvatar}
            <Avatar avatar={notification.data.from_user_avatar} size="sm" />
        {:else}
            <span class="icon-emoji">{icon}</span>
        {/if}
    </div>

    <div class="notification-content">
        <div class="notification-title">{notification.title}</div>
        <div class="notification-message">{notification.message}</div>
        <div class="notification-time">{formattedTime}</div>
    </div>

    <div class="notification-actions">
        {#if notification.type === NOTIFICATION_TYPES.CHAT_INVITE}
            <button class="action-btn accept" on:click={handleAction} title="Accept">
                ✓
            </button>
        {/if}
        <button class="action-btn dismiss" on:click={handleDismiss} title="Dismiss">
            ✕
        </button>
    </div>

    {#if !notification.read}
        <div class="unread-dot"></div>
    {/if}
</div>

<style>
    .notification-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        background: white;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
    }

    .notification-item:hover {
        background: var(--cream);
    }

    .notification-item.unread {
        background: #F3F9F5;
    }

    .notification-item.unread:hover {
        background: #E8F5E9;
    }

    .notification-icon {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--cream);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-emoji {
        font-size: 20px;
    }

    .notification-content {
        flex: 1;
        min-width: 0;
    }

    .notification-title {
        font-weight: 600;
        font-size: 14px;
        color: var(--text);
        margin-bottom: 2px;
    }

    .notification-message {
        font-size: 13px;
        color: var(--text-light);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .notification-time {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
    }

    .notification-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    .notification-item:hover .notification-actions {
        opacity: 1;
    }

    .action-btn {
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 50%;
        background: var(--cream-dark);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .action-btn:hover {
        transform: scale(1.1);
    }

    .action-btn.accept {
        background: #E8F5E9;
        color: #4CAF50;
    }

    .action-btn.accept:hover {
        background: #4CAF50;
        color: white;
    }

    .action-btn.dismiss {
        color: var(--text-muted);
    }

    .action-btn.dismiss:hover {
        background: #FFEBEE;
        color: #F44336;
    }

    .unread-dot {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary);
    }
</style>
