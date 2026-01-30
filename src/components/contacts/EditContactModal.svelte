<script>
    import { createEventDispatcher } from 'svelte';

    export let contact = null;
    export let show = false;

    const dispatch = createEventDispatcher();

    let notes = '';

    $: if (contact && show) {
        notes = contact.notes || '';
    }

    function handleSave() {
        dispatch('save', { ...contact, notes: notes.trim() });
        close();
    }

    function close() {
        show = false;
        dispatch('close');
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            close();
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show && contact}
    <div class="modal-overlay" on:click={close}>
        <div class="modal" on:click|stopPropagation>
            <div class="modal-header">
                <h3>Edit Contact Notes</h3>
                <button class="close-btn" on:click={close}>✕</button>
            </div>

            <div class="modal-body">
                <div class="contact-header">
                    <div class="contact-name">{contact.name}</div>
                </div>

                <div class="form-group">
                    <label for="notes">Notes</label>
                    <textarea
                        id="notes"
                        bind:value={notes}
                        placeholder="Add personal notes about this contact..."
                        rows="4"
                    ></textarea>
                    <div class="char-count">
                        {notes.length} / 500 characters
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={close}>Cancel</button>
                <button class="btn btn-primary" on:click={handleSave}>Save Notes</button>
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
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    .modal {
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        animation: slideUp 0.2s ease;
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--cream-dark);
    }

    .modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: var(--text);
    }

    .close-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s ease;
    }

    .close-btn:hover {
        background: var(--cream-dark);
    }

    .modal-body {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    }

    .contact-header {
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--cream);
    }

    .contact-name {
        font-weight: 600;
        font-size: 16px;
        color: var(--text);
    }

    .form-group {
        margin-bottom: 16px;
    }

    label {
        display: block;
        font-weight: 600;
        font-size: 14px;
        color: var(--text);
        margin-bottom: 8px;
    }

    textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--cream-dark);
        border-radius: 8px;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.4;
        resize: vertical;
        box-sizing: border-box;
        transition: border-color 0.2s ease;
    }

    textarea:focus {
        outline: none;
        border-color: var(--primary);
    }

    .char-count {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 6px;
        text-align: right;
    }

    .modal-footer {
        display: flex;
        gap: 10px;
        padding: 16px 20px;
        border-top: 1px solid var(--cream-dark);
        flex-shrink: 0;
    }

    .btn {
        flex: 1;
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-secondary:hover {
        background: var(--cream-dark);
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-primary:hover {
        background: var(--primary-dark, #388E3C);
    }
</style>
