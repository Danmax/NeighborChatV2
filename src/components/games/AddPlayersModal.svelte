<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { fetchInstanceMembers } from '../../services/games.service.js';
    import { gameTeams } from '../../stores/games.js';

    export let show = false;
    export let sessionId = null;
    export let existingPlayerIds = [];
    export let teamMode = 'individual';
    export let loading = false;

    const dispatch = createEventDispatcher();

    let members = [];
    let loadingMembers = false;
    let searchQuery = '';
    let selectedMembers = [];
    let selectedTeamId = null;

    $: availableMembers = members.filter(m =>
        !existingPlayerIds.includes(m.membershipId) &&
        m.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    $: if (show) {
        loadMembers();
        selectedMembers = [];
        selectedTeamId = null;
        searchQuery = '';
    }

    async function loadMembers() {
        loadingMembers = true;
        try {
            members = await fetchInstanceMembers();
        } catch (err) {
            console.error('Failed to load members:', err);
        } finally {
            loadingMembers = false;
        }
    }

    function toggleMember(member) {
        if (selectedMembers.find(m => m.membershipId === member.membershipId)) {
            selectedMembers = selectedMembers.filter(m => m.membershipId !== member.membershipId);
        } else {
            selectedMembers = [...selectedMembers, member];
        }
    }

    function isSelected(member) {
        return selectedMembers.some(m => m.membershipId === member.membershipId);
    }

    function handleClose() {
        dispatch('close');
    }

    function handleAdd() {
        if (selectedMembers.length === 0) return;
        dispatch('add', {
            members: selectedMembers,
            teamId: teamMode === 'team' ? selectedTeamId : null
        });
    }
</script>

{#if show}
    <div
        class="modal-overlay"
        on:click|self={handleClose}
        on:keydown={(e) => e.key === 'Escape' && handleClose()}
        role="button"
        tabindex="0"
        aria-label="Close add players dialog"
    >
        <div class="modal-content">
            <div class="modal-header">
                <h2>Add Players to Session</h2>
                <button class="modal-close" on:click={handleClose}>✕</button>
            </div>

            <div class="modal-body">
                <!-- Search -->
                <div class="search-box">
                    <input
                        type="text"
                        placeholder="Search members..."
                        bind:value={searchQuery}
                    />
                </div>

                <!-- Team Selection (if team mode) -->
                {#if teamMode === 'team' && $gameTeams.length > 0}
                    <div class="team-select">
                        <label>Assign to Team (optional)</label>
                        <select bind:value={selectedTeamId}>
                            <option value={null}>No team</option>
                            {#each $gameTeams as team}
                                <option value={team.id}>{team.icon} {team.name}</option>
                            {/each}
                        </select>
                    </div>
                {/if}

                <!-- Members List -->
                <div class="members-list">
                    {#if loadingMembers}
                        <div class="loading-state">
                            <div class="spinner"></div>
                            <p>Loading members...</p>
                        </div>
                    {:else if availableMembers.length === 0}
                        <div class="empty-state">
                            <p>{searchQuery ? 'No members match your search' : 'All members are already in this session'}</p>
                        </div>
                    {:else}
                        {#each availableMembers as member}
                            <button
                                class="member-item"
                                class:selected={isSelected(member)}
                                on:click={() => toggleMember(member)}
                            >
                                <div class="member-avatar">
                                    {#if member.avatar}
                                        <img src={member.avatar} alt={member.displayName} />
                                    {:else}
                                        <span>{(member.displayName || '?')[0].toUpperCase()}</span>
                                    {/if}
                                </div>
                                <div class="member-info">
                                    <span class="member-name">{member.displayName || 'Member'}</span>
                                    {#if member.role === 'admin' || member.role === 'moderator'}
                                        <span class="role-badge">{member.role}</span>
                                    {/if}
                                </div>
                                <div class="check-mark">
                                    {#if isSelected(member)}
                                        <span class="checked">✓</span>
                                    {:else}
                                        <span class="unchecked">○</span>
                                    {/if}
                                </div>
                            </button>
                        {/each}
                    {/if}
                </div>

                <!-- Selected Summary -->
                {#if selectedMembers.length > 0}
                    <div class="selected-summary">
                        <span>{selectedMembers.length} player{selectedMembers.length > 1 ? 's' : ''} selected</span>
                        <button class="clear-btn" on:click={() => selectedMembers = []}>Clear</button>
                    </div>
                {/if}
            </div>

            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={handleClose} disabled={loading}>
                    Cancel
                </button>
                <button
                    class="btn btn-primary"
                    on:click={handleAdd}
                    disabled={loading || selectedMembers.length === 0}
                >
                    {loading ? 'Adding...' : `Add ${selectedMembers.length || ''} Player${selectedMembers.length !== 1 ? 's' : ''}`}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    }

    .modal-content {
        background: white;
        border-radius: 16px;
        max-width: 480px;
        width: 100%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 20px 16px;
        border-bottom: 1px solid #f0f0f0;
    }

    .modal-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
    }

    .modal-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #999;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .modal-close:hover {
        background: #f5f5f5;
        color: #333;
    }

    .modal-body {
        padding: 16px 20px;
        overflow-y: auto;
        flex: 1;
    }

    .search-box {
        margin-bottom: 16px;
    }

    .search-box input {
        width: 100%;
        padding: 12px 16px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
    }

    .search-box input:focus {
        outline: none;
        border-color: #4CAF50;
    }

    .team-select {
        margin-bottom: 16px;
    }

    .team-select label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: #555;
        margin-bottom: 6px;
    }

    .team-select select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
    }

    .members-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #f0f0f0;
        border-radius: 8px;
    }

    .loading-state,
    .empty-state {
        padding: 32px 20px;
        text-align: center;
        color: #666;
    }

    .spinner {
        width: 24px;
        height: 24px;
        border: 3px solid #f0f0f0;
        border-top-color: #4CAF50;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 12px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .member-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        width: 100%;
        border: none;
        background: white;
        cursor: pointer;
        transition: background 0.2s;
        text-align: left;
        border-bottom: 1px solid #f5f5f5;
    }

    .member-item:last-child {
        border-bottom: none;
    }

    .member-item:hover {
        background: #f8f8f8;
    }

    .member-item.selected {
        background: #e8f5e9;
    }

    .member-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #e0e0e0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .member-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .member-avatar span {
        font-size: 14px;
        font-weight: 600;
        color: #666;
    }

    .member-info {
        flex: 1;
        min-width: 0;
    }

    .member-name {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: #333;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .role-badge {
        display: inline-block;
        font-size: 10px;
        padding: 2px 6px;
        background: #e3f2fd;
        color: #1976D2;
        border-radius: 4px;
        text-transform: uppercase;
        font-weight: 600;
        margin-top: 2px;
    }

    .check-mark {
        flex-shrink: 0;
    }

    .checked {
        color: #4CAF50;
        font-size: 18px;
        font-weight: 700;
    }

    .unchecked {
        color: #ccc;
        font-size: 18px;
    }

    .selected-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;
        padding: 10px 12px;
        background: #e8f5e9;
        border-radius: 8px;
        font-size: 13px;
        color: #2E7D32;
        font-weight: 500;
    }

    .clear-btn {
        background: none;
        border: none;
        color: #F44336;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    }

    .modal-footer {
        padding: 16px 20px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }

    .btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: #4CAF50;
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        filter: brightness(1.1);
    }

    .btn-secondary {
        background: #f0f0f0;
        color: #333;
    }

    .btn-secondary:hover:not(:disabled) {
        background: #e0e0e0;
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
