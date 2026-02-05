import { writable } from 'svelte/store';

export const gameTemplates = writable([]);
export const gameTemplatesLoading = writable(false);
export const gameTemplatesError = writable(null);

export function setGameTemplates(list) {
    gameTemplates.set(list);
}

export function updateGameTemplate(templateId, updates) {
    gameTemplates.update(list =>
        list.map(t => (t.id === templateId ? { ...t, ...updates } : t))
    );
}

export function addGameTemplate(template) {
    gameTemplates.update(list => [template, ...list]);
}

export function removeGameTemplate(templateId) {
    gameTemplates.update(list => list.filter(t => t.id !== templateId));
}
