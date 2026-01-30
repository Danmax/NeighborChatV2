import { writable, derived, get } from 'svelte/store';
import { currentUser } from './auth.js';

// Active chat state
export const chatPartner = writable(null);
export const chatRoomId = writable(null);
export const chatMessages = writable([]);
export const typingUsers = writable({});

// Lobby chat state
export const lobbyMessages = writable([]);
export const lobbyTypingUsers = writable({});

// Chat UI state
export const isChatOpen = writable(false);
export const pendingInvite = writable(null);
export const chatError = writable(null);

// Derived: is someone typing in current chat
export const isPartnerTyping = derived(
    [typingUsers, chatPartner],
    ([$typingUsers, $chatPartner]) => {
        if (!$chatPartner) return false;
        return $typingUsers[$chatPartner.user_id] || false;
    }
);

// Derived: list of users typing in lobby
export const lobbyTypingList = derived(lobbyTypingUsers, ($lobbyTypingUsers) => {
    return Object.entries($lobbyTypingUsers)
        .filter(([_, isTyping]) => isTyping)
        .map(([userId, _]) => userId);
});

// Set chat partner and create room ID
export function startChat(partner) {
    const user = get(currentUser);
    if (!user || !partner) return null;

    // Create consistent room ID (sorted user IDs)
    // Use user_id for consistency across the app
    const ids = [user.user_id, partner.user_id].sort();
    const roomId = `chat_${ids[0]}_${ids[1]}`;

    chatPartner.set(partner);
    chatRoomId.set(roomId);
    chatMessages.set([]);
    chatError.set(null);
    isChatOpen.set(true);

    return roomId;
}

// Add a message to the chat
export function addMessage(message) {
    chatMessages.update(msgs => {
        // Avoid duplicates
        if (msgs.some(m => m.id === message.id)) return msgs;
        return [...msgs, message].sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );
    });
}

// Add a message to lobby chat
export function addLobbyMessage(message) {
    lobbyMessages.update(msgs => {
        if (msgs.some(m => m.id === message.id)) return msgs;
        // Keep last 100 messages
        const updated = [...msgs, message].sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        return updated.slice(-100);
    });
}

// Update typing status for a user
export function setTypingStatus(userId, isTyping, isLobby = false) {
    const store = isLobby ? lobbyTypingUsers : typingUsers;
    store.update(users => ({
        ...users,
        [userId]: isTyping
    }));

    // Auto-clear typing after 3 seconds
    if (isTyping) {
        setTimeout(() => {
            store.update(users => ({
                ...users,
                [userId]: false
            }));
        }, 3000);
    }
}

// End the current chat
export function endChat() {
    chatPartner.set(null);
    chatRoomId.set(null);
    chatMessages.set([]);
    typingUsers.set({});
    isChatOpen.set(false);
    chatError.set(null);
}

// Set a pending invite
export function setPendingInvite(invite) {
    pendingInvite.set(invite);
}

// Clear pending invite
export function clearPendingInvite() {
    pendingInvite.set(null);
}

// Set chat error
export function setChatError(error) {
    chatError.set(error);
}
