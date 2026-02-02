import { writable } from 'svelte/store';

export const brandingSettings = writable({
    name: 'Neighbor Chat',
    logo: '🏘️',
    tagline: 'Connect with neighbors, one chat at a time'
});
