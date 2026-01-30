<script>
    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import Avatar from '../avatar/Avatar.svelte';

    export let show = false;
    export let invite = null;

    const dispatch = createEventDispatcher();

    function handleAccept() {
        dispatch('accept', invite);
    }

    function handleDecline() {
        dispatch('decline', invite);
    }

    function handleBackdropClick(e) {
        if (e.target === e.currentTarget) {
            handleDecline();
        }
    }
</script>

{#if show && invite}
    <div
        class="modal-backdrop"
        on:click={handleBackdropClick}
        on:keypress={(e) => e.key === 'Escape' && handleDecline()}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        transition:fade={{ duration: 200 }}
    >
        <div class="modal-content" transition:scale={{ duration: 200, start: 0.95 }}>
            <div class="invite-header">
                <span class="invite-icon">💬</span>
                <h3>Chat Invite</h3>
            </div>

            <div class="invite-body">
                <div class="inviter-info">
                    <Avatar avatar={invite.from?.avatar} size="xl" />
                    <h4 class="inviter-name">{invite.from?.name || 'Someone'}</h4>
                    {#if invite.from?.interests?.length > 0}
                        <div class="inviter-interests">
                            {invite.from.interests.slice(0, 4).map(i => i).join(' ')}
                        </div>
                    {/if}
                </div>

                <p class="invite-message">wants to chat with you!</p>
            </div>

            <div class="invite-actions">
                <button class="btn btn-secondary" on:click={handleDecline}>
                    Not Now
                </button>
                <button class="btn btn-primary" on:click={handleAccept}>
                    💬 Accept
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 1000;
    }

    .modal-content {
        background: white;
        border-radius: var(--radius-lg, 16px);
        padding: 24px;
        max-width: 340px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .invite-header {
        margin-bottom: 20px;
    }

    .invite-icon {
        font-size: 40px;
        display: block;
        margin-bottom: 8px;
    }

    .invite-header h3 {
        font-size: 20px;
        font-weight: 700;
        color: var(--text);
        margin: 0;
    }

    .invite-body {
        margin-bottom: 24px;
    }

    .inviter-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 16px;
    }

    .inviter-name {
        margin-top: 12px;
        font-size: 18px;
        font-weight: 600;
        color: var(--text);
    }

    .inviter-interests {
        margin-top: 4px;
        font-size: 16px;
        letter-spacing: 2px;
    }

    .invite-message {
        font-size: 14px;
        color: var(--text-light);
    }

    .invite-actions {
        display: flex;
        gap: 12px;
    }

    .btn {
        flex: 1;
        padding: 14px 20px;
        border: none;
        border-radius: var(--radius-sm, 8px);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-primary:hover {
        background: var(--primary-dark);
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-secondary:hover {
        background: var(--cream-dark);
    }
</style>
