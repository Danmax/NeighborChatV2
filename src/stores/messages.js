import { writable } from 'svelte/store';

export const inboxThreads = writable([]);
export const threadMessages = writable([]);
export const messagesLoading = writable(false);
export const messagesError = writable(null);

export function setInboxThreads(threads) {
    inboxThreads.set(threads);
}

export function setThreadMessages(messages) {
    threadMessages.set(messages);
}

export function addThreadMessage(message) {
    threadMessages.update(list => {
        if (list.some(item => item.id === message.id)) return list;
        return [...list, message];
    });
}

export function updateThreadPreview(threadUserId, updates) {
    inboxThreads.update(list =>
        list.map(thread =>
            thread.user_id === threadUserId ? { ...thread, ...updates } : thread
        )
    );
}

export function upsertThread(thread) {
    inboxThreads.update(list => {
        const existingIndex = list.findIndex(item => item.user_id === thread.user_id);
        if (existingIndex === -1) {
            return [thread, ...list];
        }
        const updated = [...list];
        updated[existingIndex] = { ...updated[existingIndex], ...thread };
        return updated;
    });
}

export function updateMessageRead(messageId, read) {
    threadMessages.update(list =>
        list.map(message =>
            message.id === messageId ? { ...message, read } : message
        )
    );
}

export function setMessagesError(error) {
    messagesError.set(error);
}
