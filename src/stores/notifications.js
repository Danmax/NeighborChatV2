import { writable, derived } from 'svelte/store';

// Notifications state
export const notifications = writable([]);
export const notificationsLoading = writable(false);

// Notification types
export const NOTIFICATION_TYPES = {
    CHAT_INVITE: 'chat_invite',
    CHAT_MESSAGE: 'chat_message',
    CHAT_MENTION: 'chat_mention',
    EVENT_INVITE: 'event_invite',
    EVENT_REMINDER: 'event_reminder',
    CELEBRATION_REACTION: 'celebration_reaction',
    CELEBRATION_COMMENT: 'celebration_comment',
    CELEBRATION_MENTION: 'celebration_mention',
    SYSTEM: 'system'
};

// Derived: unread count
export const unreadCount = derived(notifications, ($notifications) =>
    $notifications.filter(n => !n.read).length
);

// Derived: recent notifications (last 50)
export const recentNotifications = derived(notifications, ($notifications) =>
    [...$notifications]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 50)
);

// Set notifications
export function setNotifications(list) {
    notifications.set(list);
}

// Add a notification
export function addNotification(notification) {
    const newNotification = {
        id: notification.id || `notif-${Date.now()}`,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        read: false,
        created_at: notification.created_at || new Date().toISOString()
    };

    notifications.update(list => [newNotification, ...list]);
    return newNotification;
}

// Mark notification as read
export function markAsRead(notificationId) {
    notifications.update(list =>
        list.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
}

// Mark all as read
export function markAllAsRead() {
    notifications.update(list =>
        list.map(n => ({ ...n, read: true }))
    );
}

// Remove a notification
export function removeNotification(notificationId) {
    notifications.update(list => list.filter(n => n.id !== notificationId));
}

// Clear all notifications
export function clearNotifications() {
    notifications.set([]);
}

// Get notification icon by type
export function getNotificationIcon(type) {
    switch (type) {
        case NOTIFICATION_TYPES.CHAT_INVITE: return '💬';
        case NOTIFICATION_TYPES.CHAT_MESSAGE: return '✉️';
        case NOTIFICATION_TYPES.CHAT_MENTION: return '📣';
        case NOTIFICATION_TYPES.EVENT_INVITE: return '📅';
        case NOTIFICATION_TYPES.EVENT_REMINDER: return '⏰';
        case NOTIFICATION_TYPES.CELEBRATION_REACTION: return '❤️';
        case NOTIFICATION_TYPES.CELEBRATION_COMMENT: return '💬';
        case NOTIFICATION_TYPES.CELEBRATION_MENTION: return '📣';
        case NOTIFICATION_TYPES.SYSTEM: return '🔔';
        default: return '🔔';
    }
}
