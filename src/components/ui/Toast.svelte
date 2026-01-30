<script>
    import { fly, fade } from 'svelte/transition';

    export let message = '';
    export let type = 'info'; // info, success, error, warning
    export let show = false;
    export let duration = 3000;

    let timeout;

    $: if (show && duration > 0) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            show = false;
        }, duration);
    }

    const icons = {
        info: 'ℹ️',
        success: '✓',
        error: '✕',
        warning: '⚠️'
    };
</script>

{#if show}
    <div
        class="toast toast-{type}"
        role="alert"
        in:fly={{ y: -20, duration: 200 }}
        out:fade={{ duration: 150 }}
    >
        <span class="toast-icon">{icons[type]}</span>
        <span class="toast-message">{message}</span>
    </div>
{/if}

<style>
    .toast {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 20px;
        border-radius: 8px;
        background: white;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 90%;
    }

    .toast-icon {
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
    }

    .toast-message {
        font-size: 14px;
        font-weight: 500;
        color: var(--text);
    }

    .toast-info .toast-icon {
        background: #E3F2FD;
        color: #1976D2;
    }

    .toast-success .toast-icon {
        background: #E8F5E9;
        color: #4CAF50;
    }

    .toast-error .toast-icon {
        background: #FFEBEE;
        color: #F44336;
    }

    .toast-warning .toast-icon {
        background: #FFF3E0;
        color: #FF9800;
    }
</style>
