<script>
    import { authInitialized } from '../../stores/ui.js';
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
    import { inboxThreads, messagesLoading, messagesError } from '../../stores/messages.js';
    import { fetchInbox, subscribeToInbox } from '../../services/messages.service.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import { getTimeAgo } from '../../lib/utils/time.js';

    // Redirect if not authenticated
    $: if ($authInitialized && !$isAuthenticated) {
        console.log('🔐 MessagesScreen: Not authenticated, redirecting to /auth');
        push('/auth');
    }

    let subscription = null;

    onMount(() => {
        if ($isAuthenticated) {
            fetchInbox();
            subscribeToInbox().then((channel) => {
                subscription = channel;
            });
        }
    });

    onDestroy(() => {
        if (subscription) {
            subscription.unsubscribe();
        }
    });

    function openThread(thread) {
        push(`/messages/${thread.user_id}`);
    }
</script>

{#if $isAuthenticated}
    <div class="messages-screen">
        <div class="screen-header">
            <button class="back-btn" on:click={() => push('/')}>← Back</button>
            <h2 class="card-title">
                <span class="icon">✉️</span>
                Messages
            </h2>
        </div>

        <div class="card">
            {#if $messagesLoading}
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading messages...</p>
                </div>
            {:else if $messagesError}
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <p>{$messagesError}</p>
                    <button class="btn btn-primary" on:click={() => fetchInbox()}>
                        Try Again
                    </button>
                </div>
            {:else if $inboxThreads.length === 0}
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>No messages yet</p>
                    <p class="empty-hint">Start a conversation from your contacts list.</p>
                </div>
            {:else}
                <div class="thread-list">
                    {#each $inboxThreads as thread}
                        <button class="thread-item" on:click={() => openThread(thread)}>
                            <div class="thread-avatar">
                                <Avatar avatar={thread.profile?.avatar} size="sm" />
                                {#if thread.unread_count > 0}
                                    <span class="unread-badge">{thread.unread_count}</span>
                                {/if}
                            </div>
                            <div class="thread-body">
                                <div class="thread-top">
                                    <span class="thread-name">{thread.profile?.name || 'Neighbor'}</span>
                                    <span class="thread-time">{getTimeAgo(thread.last_at)}</span>
                                </div>
                                <div class="thread-preview">{thread.last_message}</div>
                            </div>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .messages-screen {
        padding-bottom: 20px;
    }

    .screen-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
    }

    .screen-header .card-title {
        margin: 0;
    }

    .back-btn {
        background: none;
        border: none;
        color: var(--primary);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        padding: 8px 0;
    }

    .card {
        background: white;
        border-radius: var(--radius-md);
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .thread-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .thread-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
    }

    .thread-item:hover {
        background: var(--cream);
        border-color: var(--primary-light);
    }

    .thread-avatar {
        position: relative;
        flex-shrink: 0;
    }

    .unread-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 18px;
        height: 18px;
        padding: 0 6px;
        background: var(--primary);
        color: white;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .thread-body {
        flex: 1;
        min-width: 0;
    }

    .thread-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
    }

    .thread-name {
        font-weight: 600;
        color: var(--text);
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .thread-time {
        font-size: 12px;
        color: var(--text-muted);
        flex-shrink: 0;
    }

    .thread-preview {
        font-size: 13px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 4px;
    }

    .loading-state,
    .empty-state {
        text-align: center;
        padding: 40px 20px;
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
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
    }

    .empty-hint {
        font-size: 13px;
        opacity: 0.7;
        margin-top: 4px;
    }

    .btn {
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
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
</style>
