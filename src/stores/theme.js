// Theme store - App theming and settings
import { writable } from 'svelte/store';
import { getCachedData, cacheData } from '../lib/utils/cache.js';

/**
 * Available themes
 */
export const THEMES = [
    { id: 'forest', name: 'Forest', color: '#2D5A47' },
    { id: 'ocean', name: 'Ocean', color: '#1565C0' },
    { id: 'sunset', name: 'Sunset', color: '#E65100' },
    { id: 'berry', name: 'Berry', color: '#7B1FA2' },
    { id: 'midnight', name: 'Midnight', color: '#37474F' },
    { id: 'rose', name: 'Rose', color: '#C2185B' }
];

/**
 * Current theme
 * @type {import('svelte/store').Writable<string>}
 */
export const currentTheme = writable(getCachedData('theme', 'forest'));

// Apply theme to body and persist
currentTheme.subscribe(theme => {
    if (typeof document !== 'undefined') {
        // Remove all theme classes
        document.body.classList.remove(
            'theme-ocean',
            'theme-sunset',
            'theme-berry',
            'theme-midnight',
            'theme-rose'
        );

        // Add theme class if not default
        if (theme && theme !== 'forest') {
            document.body.classList.add(`theme-${theme}`);
        }

        cacheData('theme', theme);
    }
});

/**
 * Set the current theme
 */
export function setTheme(themeId) {
    currentTheme.set(themeId);
}

/**
 * App settings
 * @type {import('svelte/store').Writable<Object>}
 */
export const appSettings = writable(getCachedData('appSettings', {
    soundEnabled: true,
    notificationsEnabled: true,
    showRealNames: false
}));

// Persist settings
appSettings.subscribe(settings => {
    cacheData('appSettings', settings);
});

/**
 * Update app settings
 */
export function updateSettings(updates) {
    appSettings.update(settings => ({ ...settings, ...updates }));
}
