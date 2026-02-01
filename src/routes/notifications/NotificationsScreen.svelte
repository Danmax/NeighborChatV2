<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
    import {
        recentNotifications,
        unreadCount,
        notificationsLoading,
        markAsRead,
        markAllAsRead,
        NOTIFICATION_TYPES
    } from '../../stores/notifications.js';
    import {
        fetchNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        subscribeToNotifications
    } from '../../services/notifications.service.js';
    import NotificationItem from '../../components/notifications/NotificationItem.svelte';

    let subscription = null;

    onMount(async () => {
        if ($isAuthenticated) {
            fetchNotifications();
            subscription = await subscribeToNotifications((notification) => {
                // Could show toast notification here
                console.log('New notification:', notification);
            });
        }
    });

    onDestroy(() => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
        }
    });

    async function handleNotificationClick(event) {
        const notification = event.detail;

        // Mark as read
        if (!notification.read) {
            markAsRead(notification.id);
            markNotificationRead(notification.id);
        }

        // Navigate based on type
        switch (notification.type) {
            case NOTIFICATION_TYPES.CHAT_INVITE:
                if (notification.data?.from_user_id) {
                    push(`/chat/${notification.data.from_user_id}`);
                }
                break;
            case NOTIFICATION_TYPES.CHAT_MESSAGE:
                if (notification.data?.from_user_id) {
                    push(`/messages/${notification.data.from_user_id}`);
                } else {
                    push('/messages');
                }
                break;
            case NOTIFICATION_TYPES.EVENT_INVITE:
            case NOTIFICATION_TYPES.EVENT_REMINDER:
                if (notification.data?.event_id) {
                    push(`/events/${notification.data.event_id}`);
                } else {
                    push('/events');
                }
                break;
            case NOTIFICATION_TYPES.EVENT_UPDATE:
                if (notification.data?.event_id) {
                    push(`/events/${notification.data.event_id}`);
                } else {
                    push('/events');
                }
                break;
            case NOTIFICATION_TYPES.CELEBRATION_REACTION:
            case NOTIFICATION_TYPES.CELEBRATION_COMMENT:
            case NOTIFICATION_TYPES.CELEBRATION_MENTION:
                push('/celebrations');
                break;
        }
    }

    function handleNotificationAction(event) {
        const notification = event.detail;

        if (notification.type === NOTIFICATION_TYPES.CHAT_INVITE) {
            // Accept chat invite
            if (notification.data?.from_user_id) {
                push(`/chat/${notification.data.from_user_id}`);
            }
        }
    }

    async function handleDismiss(event) {
        const notification = event.detail;
        await deleteNotification(notification.id);
    }

    async function handleMarkAllRead() {
        markAllAsRead();
        await markAllNotificationsRead();
    }
</script>

{#if $isAuthenticated}
    <div class="notifications-screen">
        <div class="screen-header">
            <button class="back-btn" on:click={() => push('/')}>← Back</button>
            <h2 class="card-title">
                <span class="icon">🔔</span>
                Notifications
                {#if $unreadCount > 0}
                    <span class="unread-badge">{$unreadCount}</span>
                {/if}
            </h2>
        </div>

        {#if $unreadCount > 0}
            <div class="actions-bar">
                <button class="mark-all-btn" on:click={handleMarkAllRead}>
                    ✓ Mark all as read
                </button>
            </div>
        {/if}

        <div class="card">
            {#if $notificationsLoading}
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading notifications...</p>
                </div>
            {:else if $recentNotifications.length === 0}
                <div class="empty-state">
                    <div class="empty-icon">🔔</div>
                    <p>No notifications yet</p>
                    <p class="empty-hint">You'll see updates from chats, events, and celebrations here</p>
                </div>
            {:else}
                <div class="notifications-list">
                    {#each $recentNotifications as notification (notification.id)}
                        <NotificationItem
                            {notification}
                            on:click={handleNotificationClick}
                            on:action={handleNotificationAction}
                            on:dismiss={handleDismiss}
                            on:profile={(event) => push(`/profile/view/${event.detail}`)}
                        />
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .notifications-screen {
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
        display: flex;
        align-items: center;
        gap: 10px;
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

    .card-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--text);
    }

    .icon {
        font-size: 24px;
    }

    .unread-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        background: var(--primary);
        color: white;
        font-size: 11px;
        font-weight: 700;
        border-radius: 10px;
    }

    .actions-bar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 12px;
    }

    .mark-all-btn {
        padding: 8px 16px;
        border: none;
        background: var(--cream);
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        color: var(--primary);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .mark-all-btn:hover {
        background: var(--cream-dark);
    }

    .card {
        background: white;
        border-radius: var(--radius-md);
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .loading-state, .empty-state {
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

    .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
    }

    .empty-hint {
        font-size: 13px;
        opacity: 0.7;
        margin-top: 4px;
    }

    .notifications-list {
        display: flex;
        flex-direction: column;
    }

    .notifications-list > :global(.notification-item) {
        border-bottom: 1px solid var(--cream-dark);
    }

    .notifications-list > :global(.notification-item:last-child) {
        border-bottom: none;
    }
</style>
