<script>
    import { createEventDispatcher } from 'svelte';
    import ContactCard from './ContactCard.svelte';

    export let contacts = [];
    export let emptyMessage = 'No saved contacts';
    export let emptyIcon = '👥';
    export let showInterests = true;
    export let compact = false;
    export let maxHeight = null;
    export let menuMode = 'default'; // default | recent

    const dispatch = createEventDispatcher();

    function handleClick(event) {
        dispatch('click', event.detail);
    }

    function handleChat(event) {
        dispatch('chat', event.detail);
    }

    function handleEdit(event) {
        dispatch('edit', event.detail);
    }

    function handleToggleFavorite(event) {
        dispatch('toggleFavorite', event.detail);
    }

    function handleRemove(event) {
        dispatch('remove', event.detail);
    }
</script>

<div
    class="contacts-list"
    class:compact
    style={maxHeight ? `max-height: ${maxHeight}; overflow-y: auto;` : ''}
>
    {#if contacts.length === 0}
        <div class="empty-state">
            <div class="empty-state-icon">{emptyIcon}</div>
            <p class="empty-state-text">{emptyMessage}</p>
        </div>
    {:else}
        {#each contacts as contact (contact.user_id)}
            <ContactCard
                {contact}
                {showInterests}
                {compact}
                {menuMode}
                on:click={handleClick}
                on:chat={handleChat}
                on:edit={handleEdit}
                on:toggleFavorite={handleToggleFavorite}
                on:remove={handleRemove}
            />
        {/each}
    {/if}
</div>

<style>
    .contacts-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .contacts-list.compact {
        gap: 6px;
    }

    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
    }

    .empty-state-icon {
        font-size: 48px;
        margin-bottom: 12px;
    }

    .empty-state-text {
        font-size: 14px;
        margin: 0;
    }
</style>
