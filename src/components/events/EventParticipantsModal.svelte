<script>
    import { createEventDispatcher } from 'svelte';
    import Avatar from '../avatar/Avatar.svelte';

    export let show = false;
    export let event = null;
    export let participants = [];
    export let loading = false;

    const dispatch = createEventDispatcher();

    function handleClose() {
        dispatch('close');
    }
</script>

{#if show}
    <div class="modal-overlay" on:click|self={handleClose}>
        <div class="modal-content">
            <div class="modal-header">
                <h2>Participants{event?.title ? ` · ${event.title}` : ''}</h2>
                <button class="modal-close" on:click={handleClose}>✕</button>
            </div>
            <div class="modal-body">
                {#if loading}
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading participants...</p>
                    </div>
                {:else if participants.length === 0}
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <p>No RSVPs yet</p>
                    </div>
                {:else}
                    <ul class="participants-list">
                        {#each participants as participant (participant.user_id)}
                            <li>
                                <Avatar avatar={participant.profile?.avatar} size="sm" />
                                <div class="participant-info">
                                    <span class="participant-name">
                                        {participant.profile?.display_name || 'Neighbor'}
                                    </span>
                                    <span class="participant-meta">
                                        {participant.status || 'registered'}
                                    </span>
                                </div>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }

    .modal-content {
        background: white;
        border-radius: var(--radius-lg, 16px);
        max-width: 420px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--cream-dark, #E0E0E0);
    }

    .modal-header h2 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
        margin: 0;
    }

    .modal-close {
        width: 32px;
        height: 32px;
        border: none;
        background: var(--cream, #F5F5DC);
        border-radius: 50%;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
    }

    .modal-close:hover {
        background: var(--cream-dark, #E0E0E0);
    }

    .modal-body {
        padding: 20px;
    }

    .participants-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .participants-list li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        background: var(--cream);
    }

    .participant-info {
        display: flex;
        flex-direction: column;
    }

    .participant-name {
        font-weight: 600;
        color: var(--text);
        font-size: 14px;
    }

    .participant-meta {
        font-size: 12px;
        color: var(--text-muted);
    }

    .loading-state,
    .empty-state {
        text-align: center;
        padding: 30px 20px;
        color: var(--text-muted);
    }

    .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--cream-dark);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .empty-icon {
        font-size: 40px;
        margin-bottom: 12px;
        opacity: 0.5;
    }
</style>
