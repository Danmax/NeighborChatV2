// Speakers store - State management for dev meetup speakers
import { writable, derived } from 'svelte/store';
import { currentUser } from './auth.js';

// Speakers state
export const speakers = writable([]);
export const speakersLoading = writable(false);
export const speakersError = writable(null);

// Speaker invite statuses
export const INVITE_STATUSES = [
    { id: 'pending', label: 'Pending', color: '#FF9800' },
    { id: 'accepted', label: 'Accepted', color: '#4CAF50' },
    { id: 'declined', label: 'Declined', color: '#F44336' }
];

// Derived: my speakers (created by me)
export const mySpeakers = derived([speakers, currentUser], ([$speakers, $currentUser]) => {
    if (!$currentUser) return [];
    return $speakers.filter(s => s.createdById === $currentUser.user_id);
});

// Derived: public speakers (not mine)
export const publicSpeakers = derived([speakers, currentUser], ([$speakers, $currentUser]) => {
    return $speakers.filter(s => s.isPublic && (!$currentUser || s.createdById !== $currentUser.user_id));
});

// Set speakers
export function setSpeakers(speakersList) {
    speakers.set(speakersList);
}

// Add a new speaker
export function addSpeaker(speaker) {
    speakers.update(list => [...list, speaker].sort((a, b) => a.name.localeCompare(b.name)));
}

// Update a speaker
export function updateSpeaker(speakerId, updates) {
    speakers.update(list =>
        list.map(s => s.id === speakerId ? { ...s, ...updates } : s)
    );
}

// Remove a speaker
export function removeSpeaker(speakerId) {
    speakers.update(list => list.filter(s => s.id !== speakerId));
}

// Get speaker by ID
export function getSpeakerById(speakerId) {
    let found = null;
    speakers.subscribe(list => {
        found = list.find(s => s.id === speakerId);
    })();
    return found;
}

// Get invite status info
export function getInviteStatus(statusId) {
    return INVITE_STATUSES.find(s => s.id === statusId) || INVITE_STATUSES[0];
}

// Search speakers by name or company
export function searchSpeakers(speakersList, searchTerm) {
    if (!searchTerm) return speakersList;
    const term = searchTerm.toLowerCase();
    return speakersList.filter(speaker =>
        speaker.name?.toLowerCase().includes(term) ||
        speaker.company?.toLowerCase().includes(term) ||
        speaker.title?.toLowerCase().includes(term)
    );
}

// Format social links for display
export function getSocialLinks(speaker) {
    const links = speaker?.socialLinks || {};
    const formatted = [];

    if (links.twitter) {
        formatted.push({ type: 'twitter', url: links.twitter, label: 'Twitter' });
    }
    if (links.linkedin) {
        formatted.push({ type: 'linkedin', url: links.linkedin, label: 'LinkedIn' });
    }
    if (links.github) {
        formatted.push({ type: 'github', url: links.github, label: 'GitHub' });
    }
    if (links.website) {
        formatted.push({ type: 'website', url: links.website, label: 'Website' });
    }

    return formatted;
}

// Calculate agenda duration from speaker invites
export function calculateAgendaDuration(speakerInvites) {
    if (!speakerInvites || speakerInvites.length === 0) return 0;
    return speakerInvites
        .filter(invite => invite.invite_status === 'accepted')
        .reduce((sum, invite) => sum + (invite.duration_minutes || 30), 0);
}

// Get accepted speakers for an event
export function getAcceptedSpeakers(speakerInvites, speakersMap) {
    if (!speakerInvites) return [];
    return speakerInvites
        .filter(invite => invite.invite_status === 'accepted')
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(invite => ({
            ...invite,
            speaker: speakersMap?.[invite.speaker_id] || { name: invite.speaker_name }
        }));
}
