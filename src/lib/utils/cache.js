// LocalStorage cache utilities

const STORAGE_PREFIX = 'neighborChat_';

/**
 * Save data to localStorage with prefix
 */
export function cacheData(key, data) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
            return true;
        }
    } catch (error) {
        console.warn('Failed to cache data:', error);
    }
    return false;
}

/**
 * Get data from localStorage
 */
export function getCachedData(key, defaultValue = null) {
    try {
        if (typeof localStorage !== 'undefined') {
            const data = localStorage.getItem(STORAGE_PREFIX + key);
            return data ? JSON.parse(data) : defaultValue;
        }
    } catch (error) {
        console.warn('Failed to get cached data:', error);
    }
    return defaultValue;
}

/**
 * Remove data from localStorage
 */
export function removeCachedData(key) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(STORAGE_PREFIX + key);
            return true;
        }
    } catch (error) {
        console.warn('Failed to remove cached data:', error);
    }
    return false;
}

/**
 * Clear all app data from localStorage
 */
export function clearAllCachedData() {
    try {
        if (typeof localStorage !== 'undefined') {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(STORAGE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            return true;
        }
    } catch (error) {
        console.warn('Failed to clear cached data:', error);
    }
    return false;
}

/**
 * Create a persisted store that syncs with localStorage
 */
export function createPersistedValue(key, initialValue) {
    const cached = getCachedData(key);
    return cached !== null ? cached : initialValue;
}

/**
 * Save a persisted store value
 */
export function persistValue(key, value) {
    cacheData(key, value);
}
