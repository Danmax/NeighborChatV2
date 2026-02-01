<script>
    import { createEventDispatcher, onDestroy } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import Avatar from '../avatar/Avatar.svelte';

    export let show = false;
    export let invite = null;

    const dispatch = createEventDispatcher();

    let remainingTime = 30;
    let intervalId = null;
    let timeoutId = null;

    // Start countdown when modal shows
    $: if (show && invite) {
        remainingTime = 30;

        // Clear any existing interval
        if (intervalId) {
            clearInterval(intervalId);
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Start countdown
        intervalId = setInterval(() => {
            remainingTime--;

            if (remainingTime <= 0) {
                clearInterval(intervalId);
                intervalId = null;
                handleDecline(); // Auto-decline on timeout
            }
        }, 1000);

        timeoutId = setTimeout(() => {
            handleDecline();
        }, 30000);
    }

    $: if (show && remainingTime <= 0 && invite) {
        handleDecline();
    }

    // Clean up interval when modal closes
    $: if (!show && (intervalId || timeoutId)) {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }

    onDestroy(() => {
        if (intervalId) {
            clearInterval(intervalId);
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });

    function handleAccept() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        dispatch('accept', invite);
    }

    function handleDecline() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        dispatch('decline', invite);
    }

    function handleBackdropClick(e) {
        if (e.target === e.currentTarget) {
            handleDecline();
        }
    }

    // Format time as MM:SS
    $: timeDisplay = `${Math.floor(remainingTime / 60)}:${String(remainingTime % 60).padStart(2, '0')}`;
    $: timeWarning = remainingTime <= 10;
</script>

{#if show && invite}
    <div
        class="modal-backdrop"
        on:click={handleBackdropClick}
        on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && handleDecline()}
        role="button"
        aria-label="Close invite dialog"
        tabindex="0"
        transition:fade={{ duration: 200 }}
    >
        <div
            class="modal-content"
            role="dialog"
            aria-modal="true"
            transition:scale={{ duration: 200, start: 0.95 }}
        >
            <div class="invite-header">
                <span class="invite-icon">💬</span>
                <h3>Chat Invite</h3>
                <div class="countdown-timer" class:warning={timeWarning}>
                    ⏱️ {timeDisplay}
                </div>
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

    .countdown-timer {
        margin-top: 8px;
        font-size: 14px;
        font-weight: 600;
        color: var(--primary);
        padding: 4px 12px;
        background: var(--cream);
        border-radius: 12px;
        display: inline-block;
        transition: all 0.2s ease;
    }

    .countdown-timer.warning {
        background: #FFEBEE;
        color: #C62828;
        animation: pulse 0.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.05);
        }
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
