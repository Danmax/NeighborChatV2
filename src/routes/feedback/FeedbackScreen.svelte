<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
    import { showToast } from '../../stores/toasts.js';
    import {
        submitFeedback,
        fetchMyFeedback,
        fetchAllFeedback,
        updateFeedbackStatus,
        isPlatformAdmin
    } from '../../services/feedback.service.js';

    let category = 'issue';
    let title = '';
    let message = '';
    let sending = false;
    let feedbackList = [];
    let adminView = false;
    let loading = false;

    const categories = [
        { id: 'issue', label: 'Issue' },
        { id: 'bug', label: 'Bug' },
        { id: 'question', label: 'Question' },
        { id: 'feature', label: 'Feature Request' }
    ];

    const statuses = ['open', 'reviewing', 'resolved', 'closed'];

    onMount(async () => {
        if ($isAuthenticated) {
            await loadFeedback();
        }
    });

    async function loadFeedback() {
        loading = true;
        try {
            adminView = await isPlatformAdmin();
            feedbackList = adminView ? await fetchAllFeedback() : await fetchMyFeedback();
        } catch (err) {
            console.error('Failed to load feedback:', err);
        } finally {
            loading = false;
        }
    }

    async function handleSubmit() {
        if (!message.trim()) {
            showToast('Please add details before submitting.', 'error');
            return;
        }

        sending = true;
        try {
            await submitFeedback({ category, title, message });
            title = '';
            message = '';
            category = 'issue';
            showToast('Thanks! Your feedback was sent.', 'success');
            await loadFeedback();
        } catch (err) {
            showToast(`Failed to submit: ${err.message}`, 'error');
        } finally {
            sending = false;
        }
    }

    async function handleStatusChange(item, newStatus) {
        try {
            await updateFeedbackStatus(item.id, newStatus);
            feedbackList = feedbackList.map(entry =>
                entry.id === item.id ? { ...entry, status: newStatus } : entry
            );
        } catch (err) {
            showToast(`Failed to update: ${err.message}`, 'error');
        }
    }
</script>

{#if $isAuthenticated}
    <div class="feedback-screen">
        <div class="screen-header">
            <button class="back-btn" on:click={() => push('/')}>← Back</button>
            <h2 class="card-title">Feedback</h2>
        </div>

        <div class="card">
            <h3 class="card-title">Submit Feedback</h3>

            <div class="form-group">
                <label for="category">Type</label>
                <select id="category" bind:value={category}>
                    {#each categories as option}
                        <option value={option.id}>{option.label}</option>
                    {/each}
                </select>
            </div>

            <div class="form-group">
                <label for="title">Title (optional)</label>
                <input id="title" type="text" bind:value={title} maxlength="120" />
            </div>

            <div class="form-group">
                <label for="message">Details *</label>
                <textarea
                    id="message"
                    rows="4"
                    bind:value={message}
                    placeholder="Tell us what happened or what you'd like to see"
                ></textarea>
            </div>

            <div class="form-actions">
                <button class="btn btn-primary" on:click={handleSubmit} disabled={sending}>
                    {sending ? 'Sending...' : 'Send Feedback'}
                </button>
            </div>
        </div>

        <div class="card">
            <h3 class="card-title">{adminView ? 'All Feedback' : 'Your Feedback'}</h3>
            {#if loading}
                <div class="empty-state">
                    <p>Loading feedback...</p>
                </div>
            {:else if feedbackList.length === 0}
                <div class="empty-state">
                    <p>No feedback yet.</p>
                </div>
            {:else}
                <div class="feedback-list">
                    {#each feedbackList as item (item.id)}
                        <div class="feedback-item">
                            <div class="feedback-meta">
                                <span class="pill">{item.category}</span>
                                <span class="pill status">{item.status}</span>
                                {#if item.username}
                                    <span class="pill user">@{item.username}</span>
                                {/if}
                            </div>
                            <h4>{item.title || 'Untitled'}</h4>
                            <p>{item.message}</p>

                            {#if adminView}
                                <div class="status-actions">
                                    {#each statuses as status}
                                        <button
                                            class="status-btn"
                                            class:active={item.status === status}
                                            on:click={() => handleStatusChange(item, status)}
                                        >
                                            {status}
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .feedback-screen {
        padding-bottom: 24px;
    }

    .screen-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
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
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .card-title {
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 16px;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        padding: 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-family: inherit;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
    }

    .btn {
        padding: 10px 18px;
        border: none;
        border-radius: var(--radius-sm);
        font-weight: 600;
        cursor: pointer;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .feedback-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .feedback-item {
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        padding: 16px;
        background: var(--cream);
    }

    .feedback-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
    }

    .pill {
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(45, 90, 71, 0.12);
        color: var(--text);
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
    }

    .pill.status {
        background: rgba(0, 0, 0, 0.08);
    }

    .pill.user {
        background: rgba(33, 150, 243, 0.12);
        color: #0d47a1;
    }

    .status-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
    }

    .status-btn {
        border: 1px solid var(--cream-dark);
        background: white;
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        text-transform: capitalize;
    }

    .status-btn.active {
        background: var(--primary);
        border-color: var(--primary);
        color: white;
    }

    .empty-state {
        text-align: center;
        color: var(--text-muted);
    }
</style>
