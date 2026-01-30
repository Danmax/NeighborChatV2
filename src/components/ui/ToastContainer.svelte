<script>
    import { fly, fade } from 'svelte/transition';
    import { toasts, dismissToast } from '../../stores/toasts.js';

    const icons = {
        info: 'ℹ️',
        success: '✓',
        error: '✕',
        warning: '⚠️'
    };
</script>

<div class="toast-container">
    {#each $toasts as toast (toast.id)}
        <div
            class="toast toast-{toast.type}"
            role="alert"
            in:fly={{ y: -20, duration: 200 }}
            out:fade={{ duration: 150 }}
        >
            <span class="toast-icon">{icons[toast.type]}</span>
            <span class="toast-message">{toast.message}</span>
            <button class="toast-dismiss" on:click={() => dismissToast(toast.id)}>
                ✕
            </button>
        </div>
    {/each}
</div>

<style>
    .toast-container {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 10000;
        max-width: 90%;
        width: 360px;
        pointer-events: none;
    }

    .toast {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 8px;
        background: white;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        pointer-events: auto;
    }

    .toast-icon {
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .toast-message {
        flex: 1;
        font-size: 14px;
        font-weight: 500;
        color: var(--text);
    }

    .toast-dismiss {
        width: 20px;
        height: 20px;
        border: none;
        background: none;
        color: var(--text-muted);
        font-size: 12px;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s;
        flex-shrink: 0;
    }

    .toast-dismiss:hover {
        opacity: 1;
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
