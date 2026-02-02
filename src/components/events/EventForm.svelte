<script>
    import { createEventDispatcher } from 'svelte';
    import { EVENT_TYPES, EVENT_STATUSES, getEventSettings } from '../../stores/events.js';
    import { currentUser } from '../../stores/auth.js';
    import { generateEventDraft } from '../../services/ai.service.js';
    import { savedContacts } from '../../stores/contacts.js';

    export let event = null; // For editing existing events
    export let loading = false;

    const dispatch = createEventDispatcher();

    let title = event?.title || '';
    let type = event?.type || 'meetup';
    let date = event?.date || '';
    let time = event?.time || '';
    let location = event?.location || '';
    let description = event?.description || '';
    let maxAttendees = event?.max_attendees || '';
    let invitedUserIds = event?.invited_user_ids || [];
    let coverImageUrl = event?.cover_image_url || '';
    let attachments = (event?.attachments || []).join('\n');
    let coverImageFile = null;
    let coverImagePreview = event?.cover_image_url || '';

    // New fields
    let status = event?.status || 'published';
    let capacity = event?.capacity || '';
    let joinPolicy = event?.join_policy || 'open';
    let meetingLink = event?.meeting_link || '';

    // Settings (type-specific)
    const existingSettings = getEventSettings(event);
    let potluckAllowNewItems = existingSettings.potluck_allow_new_items;
    let potluckAllowRecipes = existingSettings.potluck_allow_recipes;
    let meetupShowZoomOnlyToRsvp = existingSettings.meetup_show_zoom_only_to_rsvp;
    let meetupAllowSpeakerSubmissions = existingSettings.meetup_allow_speaker_submissions;

    let showAiDraft = false;
    let aiPrompt = '';
    let aiContext = '';
    let aiLoading = false;
    let aiError = '';
    let aiWarnings = [];

    // Get tomorrow's date as minimum
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    $: isValid = title.trim() && date;
    $: canUseAi = ['admin', 'event_manager'].includes($currentUser?.role);

    function handleSubmit() {
        if (!isValid || loading) return;

        // Build settings based on event type
        const settings = {};
        if (type === 'potluck') {
            settings.potluck_allow_new_items = potluckAllowNewItems;
            settings.potluck_allow_recipes = potluckAllowRecipes;
        }
        if (type === 'dev-meetup') {
            settings.meetup_show_zoom_only_to_rsvp = meetupShowZoomOnlyToRsvp;
            settings.meetup_allow_speaker_submissions = meetupAllowSpeakerSubmissions;
        }

        const eventData = {
            title: title.trim(),
            type,
            date,
            time: time || null,
            location: location.trim() || null,
            description: description.trim() || null,
            max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
            invited_user_ids: invitedUserIds,
            cover_image_url: coverImageUrl.trim() || null,
            attachments: attachments
                .split('\n')
                .map(item => item.trim())
                .filter(Boolean),
            cover_image_file: coverImageFile || null,
            // New fields
            status,
            capacity: capacity ? parseInt(capacity) : null,
            join_policy: joinPolicy,
            meeting_link: meetingLink.trim() || null,
            settings
        };

        dispatch('submit', eventData);
    }

    function handleCancel() {
        dispatch('cancel');
    }

    function toggleInvite(userId) {
        if (invitedUserIds.includes(userId)) {
            invitedUserIds = invitedUserIds.filter(id => id !== userId);
        } else {
            invitedUserIds = [...invitedUserIds, userId];
        }
    }

    function applyDraft(draft) {
        if (!draft) return;
        title = draft.title || title;
        type = draft.type || type;
        date = draft.date || date;
        time = draft.time || time;
        location = draft.location || location;
        description = draft.description || description;
        maxAttendees = draft.max_attendees ?? maxAttendees;
        capacity = draft.capacity ?? capacity;
        joinPolicy = draft.join_policy || joinPolicy;
        meetingLink = draft.meeting_link || meetingLink;
        coverImageUrl = draft.cover_image_url || coverImageUrl;
        attachments = Array.isArray(draft.attachments) ? draft.attachments.join('\n') : attachments;
        status = 'draft';
    }

    async function handleGenerateDraft() {
        if (!aiPrompt.trim() || aiLoading) return;
        aiLoading = true;
        aiError = '';
        aiWarnings = [];
        try {
            const response = await generateEventDraft({
                prompt: aiPrompt.trim(),
                context: {
                    notes: aiContext.trim() || null,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    location_hint: location || null
                }
            });
            applyDraft(response.draft);
            aiWarnings = response.warnings || [];
            showAiDraft = false;
        } catch (err) {
            aiError = err.message || 'Failed to generate draft.';
        } finally {
            aiLoading = false;
        }
    }
</script>

<form class="event-form" on:submit|preventDefault={handleSubmit}>
    {#if canUseAi}
        <div class="ai-banner">
            <div>
                <h4>AI Draft (Event Managers)</h4>
                <p>Generate a draft event from a prompt. It will be saved as Draft.</p>
            </div>
            <button type="button" class="btn btn-secondary" on:click={() => showAiDraft = true}>
                ✨ Generate Draft
            </button>
        </div>
        {#if aiWarnings.length > 0}
            <div class="ai-warnings">
                {#each aiWarnings as warning}
                    <span>⚠️ {warning}</span>
                {/each}
            </div>
        {/if}
    {/if}

    {#if showAiDraft}
        <div class="ai-modal">
            <div class="ai-modal-card">
                <h3>Generate Event Draft</h3>
                <label>Prompt *</label>
                <textarea rows="4" bind:value={aiPrompt} placeholder="e.g., Potluck for neighbors in early March, family friendly, evening"></textarea>
                <label>Context (optional)</label>
                <textarea rows="3" bind:value={aiContext} placeholder="Add constraints: location, vibe, audience, budget..."></textarea>
                {#if aiError}
                    <div class="ai-error">{aiError}</div>
                {/if}
                <div class="ai-actions">
                    <button type="button" class="btn btn-secondary" on:click={() => showAiDraft = false} disabled={aiLoading}>Cancel</button>
                    <button type="button" class="btn btn-primary" on:click={handleGenerateDraft} disabled={aiLoading || !aiPrompt.trim()}>
                        {aiLoading ? 'Generating...' : 'Generate Draft'}
                    </button>
                </div>
            </div>
        </div>
    {/if}
    <div class="form-group">
        <label for="event-title">Event Title *</label>
        <input
            id="event-title"
            type="text"
            bind:value={title}
            placeholder="What's happening?"
            maxlength="100"
            required
        />
    </div>

    <div class="form-group">
        <label for="event-type">Event Type</label>
        <div class="type-selector">
            {#each EVENT_TYPES as eventType}
                <button
                    type="button"
                    class="type-option"
                    class:selected={type === eventType.id}
                    on:click={() => type = eventType.id}
                    style="--type-color: {eventType.color}"
                >
                    <span class="type-emoji">{eventType.emoji}</span>
                    <span class="type-label">{eventType.label}</span>
                </button>
            {/each}
        </div>
    </div>

    <div class="form-row">
        <div class="form-group">
            <label for="event-date">Date *</label>
            <input
                id="event-date"
                type="date"
                bind:value={date}
                min={minDate}
                required
            />
        </div>

        <div class="form-group">
            <label for="event-time">Time</label>
            <input
                id="event-time"
                type="time"
                bind:value={time}
            />
        </div>
    </div>

    <div class="form-group">
        <label for="event-location">Location</label>
        <input
            id="event-location"
            type="text"
            bind:value={location}
            placeholder="Where's it happening?"
            maxlength="200"
        />
    </div>

    <div class="form-group">
        <label for="event-description">Description</label>
        <textarea
            id="event-description"
            bind:value={description}
            placeholder="Tell people what to expect..."
            rows="3"
            maxlength="500"
        ></textarea>
    </div>

    <div class="form-group">
        <label for="event-cover">Cover Image URL (optional)</label>
        <input
            id="event-cover"
            type="url"
            bind:value={coverImageUrl}
            placeholder="https://example.com/cover.jpg"
        />
    </div>

    <div class="form-group">
        <label for="event-cover-file">Or Upload Cover Image</label>
        <input
            id="event-cover-file"
            type="file"
            accept="image/*"
            on:change={(e) => {
                const file = e.currentTarget.files?.[0];
                coverImageFile = file || null;
                if (file) {
                    coverImagePreview = URL.createObjectURL(file);
                }
            }}
        />
        {#if coverImagePreview}
            <img class="cover-preview" src={coverImagePreview} alt="Cover preview" />
        {/if}
    </div>

    <div class="form-group">
        <label for="event-attachments">Attachments (one URL per line)</label>
        <textarea
            id="event-attachments"
            bind:value={attachments}
            placeholder="https://example.com/agenda.pdf"
            rows="3"
        ></textarea>
    </div>

    {#if $savedContacts.length > 0}
        <fieldset class="form-group">
            <legend>Invite Contacts (optional)</legend>
            <div class="invite-list" role="group" aria-label="Invite Contacts">
                {#each $savedContacts as contact}
                    <label class="invite-item">
                        <input
                            type="checkbox"
                            checked={invitedUserIds.includes(contact.user_id)}
                            on:change={() => toggleInvite(contact.user_id)}
                        />
                        <span>{contact.name}</span>
                    </label>
                {/each}
            </div>
        </fieldset>
    {/if}

    <div class="form-group">
        <label for="event-max">Max Attendees (optional)</label>
        <input
            id="event-max"
            type="number"
            bind:value={maxAttendees}
            min="2"
            max="100"
            placeholder="Leave blank for unlimited"
        />
    </div>

    <!-- Enhanced Event Options -->
    <div class="form-section">
        <h4 class="section-title">Event Options</h4>

        <div class="form-row">
            <div class="form-group">
                <label for="event-status">Status</label>
                <select id="event-status" bind:value={status}>
                    {#each EVENT_STATUSES as statusOption}
                        <option value={statusOption.id}>{statusOption.label}</option>
                    {/each}
                </select>
            </div>

            <div class="form-group">
                <label for="event-capacity">Capacity</label>
                <input
                    id="event-capacity"
                    type="number"
                    bind:value={capacity}
                    min="1"
                    max="1000"
                    placeholder="Unlimited"
                />
            </div>
        </div>

        <div class="form-group">
            <label for="event-join-policy">Join Policy</label>
            <div class="radio-group">
                <label class="radio-option">
                    <input type="radio" bind:group={joinPolicy} value="open" />
                    <span>Open - Anyone can join</span>
                </label>
                <label class="radio-option">
                    <input type="radio" bind:group={joinPolicy} value="approval" />
                    <span>Approval Required - You approve each RSVP</span>
                </label>
            </div>
        </div>
    </div>

    <!-- Dev Meetup Options -->
    {#if type === 'dev-meetup'}
        <div class="form-section">
            <h4 class="section-title">Dev Meetup Options</h4>

            <div class="form-group">
                <label for="event-meeting-link">Meeting Link (Zoom, Meet, etc.)</label>
                <input
                    id="event-meeting-link"
                    type="url"
                    bind:value={meetingLink}
                    placeholder="https://zoom.us/j/..."
                />
            </div>

            <div class="toggle-group">
                <label class="toggle-option">
                    <input type="checkbox" bind:checked={meetupShowZoomOnlyToRsvp} />
                    <span>Only show meeting link to confirmed attendees</span>
                </label>
                <label class="toggle-option">
                    <input type="checkbox" bind:checked={meetupAllowSpeakerSubmissions} />
                    <span>Allow attendees to submit talk proposals</span>
                </label>
            </div>
        </div>
    {/if}

    <!-- Potluck Options -->
    {#if type === 'potluck'}
        <div class="form-section">
            <h4 class="section-title">Potluck Options</h4>

            <div class="toggle-group">
                <label class="toggle-option">
                    <input type="checkbox" bind:checked={potluckAllowNewItems} />
                    <span>Allow attendees to add new items</span>
                </label>
                <label class="toggle-option">
                    <input type="checkbox" bind:checked={potluckAllowRecipes} />
                    <span>Allow attaching recipes to items</span>
                </label>
            </div>
        </div>
    {/if}

    <div class="form-actions">
        <button
            type="button"
            class="btn btn-secondary"
            on:click={handleCancel}
            disabled={loading}
        >
            Cancel
        </button>
        <button
            type="submit"
            class="btn btn-primary"
            disabled={!isValid || loading}
        >
            {loading ? 'Creating...' : event ? 'Update Event' : 'Create Event'}
        </button>
    </div>
</form>

<style>
    .event-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .ai-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: #fff9e6;
        border: 1px solid #ffe2a8;
        border-radius: var(--radius-sm);
    }

    .ai-banner h4 {
        margin: 0 0 4px;
        font-size: 14px;
    }

    .ai-banner p {
        margin: 0;
        font-size: 12px;
        color: var(--text-muted);
    }

    .ai-warnings {
        display: grid;
        gap: 6px;
        padding: 10px 12px;
        background: #fff4d6;
        border-radius: var(--radius-sm);
        font-size: 12px;
    }

    .ai-modal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1200;
        padding: 20px;
    }

    .ai-modal-card {
        background: white;
        padding: 20px;
        border-radius: 16px;
        width: min(520px, 100%);
        display: flex;
        flex-direction: column;
        gap: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }

    .ai-modal textarea {
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-family: inherit;
    }

    .ai-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    .ai-error {
        color: #c0392b;
        font-size: 12px;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    fieldset.form-group {
        border: 0;
        padding: 0;
        margin: 0;
    }

    fieldset.form-group legend {
        font-weight: 600;
        font-size: 14px;
        color: var(--text);
        margin-bottom: 4px;
    }

    .form-group label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
    }

    .form-group input,
    .form-group textarea {
        padding: 12px 16px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-family: inherit;
        transition: border-color 0.2s;
    }

    .form-group input:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: var(--primary);
    }

    .form-group textarea {
        resize: vertical;
        min-height: 80px;
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }

    .type-selector {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }

    .type-option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border: 2px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .type-option:hover {
        border-color: var(--type-color);
    }

    .type-option.selected {
        border-color: var(--type-color);
        background: color-mix(in srgb, var(--type-color) 10%, white);
    }

    .type-emoji {
        font-size: 18px;
    }

    .type-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--text);
    }

    .cover-preview {
        width: 100%;
        margin-top: 8px;
        border-radius: var(--radius-sm);
        display: block;
        object-fit: cover;
    }

    .form-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 8px;
    }

    .invite-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 8px;
        background: var(--cream);
        padding: 12px;
        border-radius: var(--radius-sm);
    }

    .invite-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text);
    }

    .btn {
        padding: 12px 24px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background: var(--primary-dark);
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-secondary:hover:not(:disabled) {
        background: var(--cream-dark);
    }

    .form-section {
        background: var(--cream);
        padding: 16px;
        border-radius: var(--radius-sm);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .section-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        margin: 0;
    }

    .form-group select {
        padding: 12px 16px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-family: inherit;
        background: white;
        cursor: pointer;
    }

    .form-group select:focus {
        outline: none;
        border-color: var(--primary);
    }

    .radio-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .radio-option {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text);
        cursor: pointer;
    }

    .radio-option input[type="radio"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
    }

    .toggle-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .toggle-option {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text);
        cursor: pointer;
    }

    .toggle-option input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
    }
</style>
