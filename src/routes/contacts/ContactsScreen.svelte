<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
    import { savedContacts, contactsLoading, contactsError } from '../../stores/contacts.js';
    import {
        fetchContacts,
        deleteContact,
        toggleFavoriteInDb,
        updateContactInDb
    } from '../../services/contacts.service.js';
    import ContactList from '../../components/contacts/ContactList.svelte';
    import EditContactModal from '../../components/contacts/EditContactModal.svelte';

    let showEditModal = false;
    let selectedContact = null;
    let searchQuery = '';
    let sortBy = 'name'; // 'name' or 'favorite'
    let actionMessage = '';
    let actionError = '';

    onMount(() => {
        if ($isAuthenticated) {
            fetchContacts();
        }
    });

    $: filteredContacts = ($savedContacts || [])
        .filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => {
            if (sortBy === 'favorite') {
                if (a.favorite !== b.favorite) {
                    return b.favorite ? 1 : -1;
                }
            }
            return a.name.localeCompare(b.name);
        });

    function openEditModal(contact) {
        selectedContact = contact;
        showEditModal = true;
    }

    function handleEditClose() {
        showEditModal = false;
        selectedContact = null;
    }

    async function handleEditSave(event) {
        const updatedContact = event.detail;
        actionMessage = '';
        actionError = '';

        try {
            await updateContactInDb(updatedContact.user_id, {
                notes: updatedContact.notes
            });
            actionMessage = `${updatedContact.name}'s notes updated!`;
            setTimeout(() => actionMessage = '', 3000);
        } catch (err) {
            actionError = 'Failed to update notes: ' + err.message;
            setTimeout(() => actionError = '', 3000);
        }
    }

    async function handleChat(event) {
        const contact = event.detail;
        console.log('[ContactsScreen] handleChat - contact:', contact, 'user_id:', contact.user_id);
        if (!contact.user_id) {
            console.error('[ContactsScreen] Contact has no user_id!');
            actionError = 'Cannot message this contact - no user ID found.';
            setTimeout(() => actionError = '', 3000);
            return;
        }
        push(`/messages/${contact.user_id}`);
    }

    async function handleToggleFavorite(event) {
        const contact = event.detail;
        actionMessage = '';
        actionError = '';

        try {
            await toggleFavoriteInDb(contact.user_id, contact.favorite);
            actionMessage = contact.favorite
                ? `Removed ${contact.name} from favorites`
                : `Added ${contact.name} to favorites`;
            setTimeout(() => actionMessage = '', 3000);
        } catch (err) {
            actionError = 'Failed to update favorite: ' + err.message;
            setTimeout(() => actionError = '', 3000);
        }
    }

    async function handleRemove(event) {
        const contact = event.detail;

        if (!confirm(`Are you sure you want to remove ${contact.name} from your contacts?`)) {
            return;
        }

        actionMessage = '';
        actionError = '';

        try {
            await deleteContact(contact.user_id);
            actionMessage = `${contact.name} removed from contacts`;
            setTimeout(() => actionMessage = '', 3000);
        } catch (err) {
            actionError = 'Failed to remove contact: ' + err.message;
            setTimeout(() => actionError = '', 3000);
        }
    }

    function clearSearch() {
        searchQuery = '';
    }
</script>

{#if $isAuthenticated}
    <div class="contacts-screen">
        <!-- Header -->
        <div class="screen-header">
            <div class="header-top">
                <button class="back-btn" on:click={() => push('/')}>←</button>
                <h1>Contacts</h1>
                <div class="header-stats">
                    {#if $savedContacts.length > 0}
                        <span class="stat-badge">{$savedContacts.length}</span>
                    {/if}
                </div>
            </div>

            <!-- Search and Filter -->
            <div class="search-filter">
                <div class="search-box">
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        bind:value={searchQuery}
                        class="search-input"
                    />
                    {#if searchQuery}
                        <button class="clear-btn" on:click={clearSearch}>✕</button>
                    {/if}
                </div>

                <div class="sort-controls">
                    <button
                        class="sort-btn"
                        class:active={sortBy === 'name'}
                        on:click={() => sortBy = 'name'}
                        title="Sort by name"
                    >
                        A-Z
                    </button>
                    <button
                        class="sort-btn"
                        class:active={sortBy === 'favorite'}
                        on:click={() => sortBy = 'favorite'}
                        title="Sort by favorites"
                    >
                        ⭐
                    </button>
                </div>
            </div>
        </div>

        <!-- Action Messages -->
        {#if actionMessage}
            <div class="action-banner success">{actionMessage}</div>
        {/if}
        {#if actionError}
            <div class="action-banner error">{actionError}</div>
        {/if}

        <!-- Loading State -->
        {#if $contactsLoading}
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading contacts...</p>
            </div>
        {/if}

        <!-- Error State -->
        {#if $contactsError}
            <div class="error-state">
                <p>⚠️ {$contactsError}</p>
                <button class="btn btn-primary" on:click={() => fetchContacts()}>
                    Try Again
                </button>
            </div>
        {/if}

        <!-- Contacts List -->
        <div class="contacts-container">
            {#if !$contactsLoading && !$contactsError}
                {#if searchQuery && filteredContacts.length === 0}
                    <div class="no-results">
                        <p>No contacts found for "{searchQuery}"</p>
                        <button class="btn btn-secondary" on:click={clearSearch}>
                            Clear Search
                        </button>
                    </div>
                {:else}
                    <ContactList
                        contacts={filteredContacts}
                        emptyMessage="No saved contacts yet"
                        emptyIcon="👥"
                        showInterests={true}
                        on:click={handleChat}
                        on:chat={handleChat}
                        on:edit={(e) => openEditModal(e.detail)}
                        on:toggleFavorite={handleToggleFavorite}
                        on:remove={handleRemove}
                    />
                {/if}
            {/if}
        </div>

        <!-- Summary -->
        {#if !$contactsLoading && !$contactsError && $savedContacts.length > 0}
            <div class="contacts-summary">
                <div class="summary-item">
                    <span class="summary-label">Total Contacts:</span>
                    <span class="summary-value">{$savedContacts.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Favorites:</span>
                    <span class="summary-value">{$savedContacts.filter(c => c.favorite).length}</span>
                </div>
            </div>
        {/if}
    </div>

    <!-- Edit Modal -->
    <EditContactModal
        bind:show={showEditModal}
        contact={selectedContact}
        on:save={handleEditSave}
        on:close={handleEditClose}
    />
{/if}

<style>
    .contacts-screen {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--bg, #FAFAFA);
    }

    /* Header */
    .screen-header {
        background: white;
        border-bottom: 1px solid var(--cream-dark, #E0E0E0);
        padding: 16px;
        flex-shrink: 0;
    }

    .header-top {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .back-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .back-btn:hover {
        background: var(--cream-dark);
    }

    .screen-header h1 {
        flex: 1;
        margin: 0;
        font-size: 20px;
        color: var(--text);
    }

    .header-stats {
        display: flex;
        gap: 8px;
    }

    .stat-badge {
        background: var(--primary);
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
    }

    /* Search and Filter */
    .search-filter {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .search-box {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid var(--cream-dark);
        border-radius: 20px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s ease;
    }

    .search-input:focus {
        border-color: var(--primary);
    }

    .clear-btn {
        position: absolute;
        right: 12px;
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: var(--text-muted);
        transition: color 0.2s ease;
    }

    .clear-btn:hover {
        color: var(--text);
    }

    /* Sort Controls */
    .sort-controls {
        display: flex;
        gap: 4px;
    }

    .sort-btn {
        padding: 8px 12px;
        border: 1px solid var(--cream-dark);
        background: white;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--text-muted);
    }

    .sort-btn:hover {
        border-color: var(--primary);
        color: var(--primary);
    }

    .sort-btn.active {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
    }

    /* Action Banners */
    .action-banner {
        padding: 12px 16px;
        border-radius: 8px;
        margin: 12px 16px 0;
        font-size: 14px;
        text-align: center;
        animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .action-banner.success {
        background: #E8F5E9;
        color: #2E7D32;
        border: 1px solid #A5D6A7;
    }

    .action-banner.error {
        background: #FFEBEE;
        color: #C62828;
        border: 1px solid #EF9A9A;
    }

    /* Loading State */
    .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        color: var(--text-muted);
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid var(--cream-dark);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 16px;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .loading-state p {
        margin: 0;
        font-size: 14px;
    }

    /* Error State */
    .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
    }

    .error-state p {
        margin: 0 0 16px;
        color: #D32F2F;
        font-size: 14px;
    }

    /* Contacts Container */
    .contacts-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
    }

    /* No Results */
    .no-results {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        color: var(--text-muted);
    }

    .no-results p {
        margin: 0 0 16px;
        font-size: 14px;
    }

    /* Summary */
    .contacts-summary {
        display: flex;
        gap: 16px;
        padding: 16px;
        background: var(--cream, #F5F5DC);
        border-top: 1px solid var(--cream-dark);
        flex-shrink: 0;
    }

    .summary-item {
        flex: 1;
        text-align: center;
    }

    .summary-label {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
    }

    .summary-value {
        display: block;
        font-size: 18px;
        font-weight: 700;
        color: var(--primary);
    }

    /* Buttons */
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
        background: var(--primary-dark, #388E3C);
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-secondary:hover {
        background: var(--cream-dark);
    }
</style>
