<script>
    import { createEventDispatcher } from 'svelte';
    import { EVENT_TYPES } from '../../stores/events.js';

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

    // Get tomorrow's date as minimum
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    $: isValid = title.trim() && date;

    function handleSubmit() {
        if (!isValid || loading) return;

        const eventData = {
            title: title.trim(),
            type,
            date,
            time: time || null,
            location: location.trim() || null,
            description: description.trim() || null,
            max_attendees: maxAttendees ? parseInt(maxAttendees) : null
        };

        dispatch('submit', eventData);
    }

    function handleCancel() {
        dispatch('cancel');
    }
</script>

<form class="event-form" on:submit|preventDefault={handleSubmit}>
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

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
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

    .form-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 8px;
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
</style>
