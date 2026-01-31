// Notifications service - Supabase for authenticated users, localStorage for guests
import { getSupabase, getAuthUserId } from '../lib/supabase.js';
import { currentUser } from '../stores/auth.js';
import {
    setNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
    notificationsLoading,
    NOTIFICATION_TYPES
} from '../stores/notifications.js';
import { get } from 'svelte/store';

const STORAGE_KEY = 'neighborChat_notifications';

// =====================================================
// localStorage helpers (for guests)
// =====================================================

function getStoredNotifications() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveNotifications(notifications) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (e) {
        console.error('Failed to save notifications:', e);
    }
}

// =====================================================
// Transform functions
// =====================================================

function transformNotificationFromDb(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        type: row.type,
        title: row.title,
        message: row.message,
        read: row.read,
        link: row.link,
        data: row.metadata || {},
        created_at: row.created_at
    };
}

function transformNotificationToDb(notificationData, authUserId) {
    return {
        user_id: authUserId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        read: false,
        link: notificationData.link || null,
        metadata: notificationData.data || {}
    };
}

// =====================================================
// Main API functions
// =====================================================

/**
 * Fetch user's notifications
 * Uses Supabase for authenticated users, localStorage for guests
 */
export async function fetchNotifications(limit = 50) {
    const user = get(currentUser);
    if (!user) return [];

    notificationsLoading.set(true);

    try {
        const authUserId = await getAuthUserId();

        if (authUserId) {
            // Authenticated user - fetch from Supabase
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', authUserId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            const notifications = (data || []).map(transformNotificationFromDb);
            setNotifications(notifications);
            return notifications;
        } else {
            // Guest user - use localStorage
            const allNotifications = getStoredNotifications();
            const userNotifications = allNotifications
                .filter(n => n.user_id === user.user_id)
                .slice(0, limit);

            setNotifications(userNotifications);
            return userNotifications;
        }
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return [];
    } finally {
        notificationsLoading.set(false);
    }
}

/**
 * Create a notification
 */
export async function createNotification(notificationData) {
    const user = get(currentUser);
    if (!user) return null;

    try {
        const authUserId = await getAuthUserId();

        if (authUserId && notificationData.user_id === authUserId) {
            // Create in Supabase for authenticated user
            const supabase = getSupabase();
            const dbNotification = transformNotificationToDb(notificationData, authUserId);

            const { data, error } = await supabase
                .from('notifications')
                .insert([dbNotification])
                .select()
                .single();

            if (error) throw error;

            const notification = transformNotificationFromDb(data);
            addNotification(notification);
            return notification;
        } else {
            // Use localStorage for guests or cross-user notifications
            const notification = {
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...notificationData,
                read: false,
                created_at: new Date().toISOString()
            };

            const notifications = getStoredNotifications();
            notifications.unshift(notification);
            saveNotifications(notifications);

            if (notification.user_id === user.user_id) {
                addNotification(notification);
            }

            return notification;
        }
    } catch (error) {
        console.error('Failed to create notification:', error);
        throw error;
    }
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId) {
    const user = get(currentUser);
    if (!user) return;

    // Update local store immediately (optimistic)
    markAsRead(notificationId);

    try {
        const authUserId = await getAuthUserId();

        if (authUserId) {
            // Update in Supabase
            const supabase = getSupabase();
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', notificationId)
                .eq('user_id', authUserId);

            if (error) {
                console.error('Failed to mark as read in Supabase:', error);
            }
        } else {
            // Update in localStorage
            const notifications = getStoredNotifications();
            const updated = notifications.map(n =>
                n.id === notificationId ? { ...n, read: true } : n
            );
            saveNotifications(updated);
        }
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
    const user = get(currentUser);
    if (!user) return;

    // Update local store immediately
    markAllAsRead();

    try {
        const authUserId = await getAuthUserId();

        if (authUserId) {
            // Update in Supabase
            const supabase = getSupabase();
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', authUserId)
                .eq('read', false);

            if (error) {
                console.error('Failed to mark all as read in Supabase:', error);
            }
        } else {
            // Update in localStorage
            const notifications = getStoredNotifications();
            const updated = notifications.map(n =>
                n.user_id === user.user_id ? { ...n, read: true } : n
            );
            saveNotifications(updated);
        }
    } catch (error) {
        console.error('Failed to mark all as read:', error);
    }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId) {
    const user = get(currentUser);
    if (!user) return;

    // Remove from local store immediately
    removeNotification(notificationId);

    try {
        const authUserId = await getAuthUserId();

        if (authUserId) {
            // Delete from Supabase
            const supabase = getSupabase();
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('user_id', authUserId);

            if (error) {
                console.error('Failed to delete from Supabase:', error);
            }
        } else {
            // Delete from localStorage
            const notifications = getStoredNotifications();
            const updated = notifications.filter(n => n.id !== notificationId);
            saveNotifications(updated);
        }
    } catch (error) {
        console.error('Failed to delete notification:', error);
    }
}

/**
 * Clear all notifications for current user
 */
export async function clearAllNotifications() {
    const user = get(currentUser);
    if (!user) return;

    // Clear local store
    clearNotifications();

    try {
        const authUserId = await getAuthUserId();

        if (authUserId) {
            // Delete from Supabase
            const supabase = getSupabase();
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', authUserId);

            if (error) {
                console.error('Failed to clear from Supabase:', error);
            }
        } else {
            // Clear from localStorage
            const notifications = getStoredNotifications();
            const updated = notifications.filter(n => n.user_id !== user.user_id);
            saveNotifications(updated);
        }
    } catch (error) {
        console.error('Failed to clear notifications:', error);
    }
}

/**
 * Subscribe to notification changes (real-time)
 */
export async function subscribeToNotifications(callback) {
    const authUserId = await getAuthUserId();
    if (!authUserId) {
        // Guests don't get real-time notifications
        return null;
    }

    const supabase = getSupabase();

    const subscription = supabase
        .channel('notifications-changes')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${authUserId}`
            },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    addNotification(transformNotificationFromDb(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    if (payload.new.read) {
                        markAsRead(payload.new.id);
                    }
                } else if (payload.eventType === 'DELETE') {
                    removeNotification(payload.old.id);
                }
                callback?.(payload);
            }
        )
        .subscribe();

    return subscription;
}

/**
 * Add a local notification (for things like chat invites, event reminders)
 * This creates the notification immediately in the store and storage
 */
export function addLocalNotification(type, title, message, data = {}) {
    const user = get(currentUser);
    if (!user) return null;

    const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: user.user_id,
        type,
        title,
        message,
        data,
        read: false,
        created_at: new Date().toISOString()
    };

    // Always save to localStorage for immediate availability
    const notifications = getStoredNotifications();
    notifications.unshift(notification);
    saveNotifications(notifications);

    // Add to store
    addNotification(notification);

    // Also try to save to Supabase asynchronously (if authenticated)
    getAuthUserId().then(authUserId => {
        if (authUserId && user.user_id === authUserId) {
            const supabase = getSupabase();
            supabase
                .from('notifications')
                .insert([transformNotificationToDb(notification, authUserId)])
                .then(({ error }) => {
                    if (error) console.error('Failed to sync notification to Supabase:', error);
                });
        }
    });

    return notification;
}

/**
 * Send a chat invite notification (local storage only - cross-user)
 */
export function sendChatInviteNotification(targetUserId, fromUser) {
    const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: targetUserId,
        type: NOTIFICATION_TYPES.CHAT_INVITE,
        title: 'Chat Invite',
        message: `${fromUser.name} wants to chat with you!`,
        data: {
            from_user_id: fromUser.user_id,
            from_user_name: fromUser.name,
            from_user_avatar: fromUser.avatar
        },
        read: false,
        created_at: new Date().toISOString()
    };

    // Cross-user notifications use localStorage
    const notifications = getStoredNotifications();
    notifications.unshift(notification);
    saveNotifications(notifications);

    return notification;
}

/**
 * Send an event invite notification (local storage only - cross-user)
 */
export function sendEventInviteNotification(targetUserId, event, fromUser) {
    const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: targetUserId,
        type: NOTIFICATION_TYPES.EVENT_INVITE,
        title: 'Event Invite',
        message: `${fromUser.name} invited you to "${event.title}"`,
        data: {
            event_id: event.id,
            event_title: event.title,
            from_user_id: fromUser.user_id,
            from_user_name: fromUser.name
        },
        read: false,
        created_at: new Date().toISOString()
    };

    // Cross-user notifications use localStorage
    const notifications = getStoredNotifications();
    notifications.unshift(notification);
    saveNotifications(notifications);

    return notification;
}

/**
 * Send a mention notification (for @mentions in chat)
 * @param {string} targetUserId - User ID to notify
 * @param {Object} fromUser - User who sent the mention
 * @param {string} channelName - Name of the channel where mention occurred
 * @param {string} messagePreview - Preview of the message
 */
export function sendMentionNotification(targetUserId, fromUser, channelName, messagePreview) {
    const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: targetUserId,
        type: NOTIFICATION_TYPES.CHAT_MENTION,
        title: 'You were mentioned',
        message: `${fromUser.name} mentioned you in #${channelName}: "${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? '...' : ''}"`,
        data: {
            from_user_id: fromUser.user_id,
            from_user_name: fromUser.name,
            from_user_avatar: fromUser.avatar,
            channel: channelName,
            message: messagePreview
        },
        read: false,
        created_at: new Date().toISOString()
    };

    // Cross-user notifications use localStorage
    const notifications = getStoredNotifications();
    notifications.unshift(notification);
    saveNotifications(notifications);

    return notification;
}
