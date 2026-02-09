<script>
	import { createEventDispatcher } from 'svelte';
	import { showToast } from '../../stores/toasts.js';

	export let sessionId = '';
	export let instanceMembers = [];
	export let currentPlayers = [];
	export let isSessionHost = false;
	export let teams = [];

	const dispatch = createEventDispatcher();

	let selectedTeam = null;
	let searchQuery = '';
	let sortBy = 'name';
	let showAddPlayersPanel = false;
	let selectedPlayers = new Set();

	$: filteredMembers = instanceMembers
		.filter(member => {
			if (!member.displayName && !member.user?.name) return false;
			const name = member.displayName || member.user?.name || '';
			if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) {
				return false;
			}
			// Filter out already added players
			return !currentPlayers.some(p => p.membershipId === member.id);
		})
		.sort((a, b) => {
			const aName = a.displayName || a.user?.name || '';
			const bName = b.displayName || b.user?.name || '';
			return aName.localeCompare(bName);
		});

	$: playersToAdd = instanceMembers.filter(m => selectedPlayers.has(m.id));

	function togglePlayerSelection(memberId) {
		if (selectedPlayers.has(memberId)) {
			selectedPlayers.delete(memberId);
		} else {
			selectedPlayers.add(memberId);
		}
		selectedPlayers = selectedPlayers;
	}

	function selectAll() {
		filteredMembers.forEach(m => selectedPlayers.add(m.id));
		selectedPlayers = selectedPlayers;
	}

	function deselectAll() {
		selectedPlayers.clear();
		selectedPlayers = selectedPlayers;
	}

	async function handleAddPlayers() {
		if (playersToAdd.length === 0) {
			showToast('Select at least one player', 'error');
			return;
		}

		dispatch('addPlayers', {
			members: playersToAdd,
			teamId: selectedTeam
		});

		selectedPlayers.clear();
		selectedPlayers = selectedPlayers;
		showAddPlayersPanel = false;
		searchQuery = '';
	}

	async function handleRemovePlayer(memberId) {
		dispatch('removePlayer', { memberId });
	}

	function getTeamName(teamId) {
		const team = teams.find(t => t.id === teamId);
		return team?.name || 'No Team';
	}

	function getMemberName(member) {
		return member.displayName || member.user?.name || 'Unknown Player';
	}
</script>

<div class="roster-management">
	<div class="roster-header">
		<h3>Game Roster</h3>
		<div class="roster-stats">
			<span class="stat-badge">{currentPlayers.length} Players</span>
		</div>
	</div>

	{#if isSessionHost}
		<div class="roster-actions">
			<button
				class="btn btn-primary"
				on:click={() => (showAddPlayersPanel = !showAddPlayersPanel)}
			>
				{showAddPlayersPanel ? '✕ Cancel' : '+ Add Players'}
			</button>
		</div>
	{/if}

	{#if showAddPlayersPanel && isSessionHost}
		<div class="add-players-panel">
			<div class="panel-header">
				<h4>Add Players to Session</h4>
				<div class="panel-filters">
					<div class="search-box">
						<input
							type="text"
							placeholder="Search players..."
							bind:value={searchQuery}
							aria-label="Search players"
						/>
						<span class="search-icon">🔍</span>
					</div>

					{#if teams.length > 0}
						<div class="team-filter">
							<select bind:value={selectedTeam} aria-label="Filter by team">
								<option value={null}>All Teams</option>
								{#each teams as team}
									<option value={team.id}>{team.name}</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>
			</div>

			<div class="player-selection">
				<div class="selection-header">
					<label class="checkbox-label">
						<input
							type="checkbox"
							indeterminate={selectedPlayers.size > 0 &&
								selectedPlayers.size < filteredMembers.length}
							checked={selectedPlayers.size === filteredMembers.length &&
								filteredMembers.length > 0}
							on:change={(e) => {
								if (e.target.checked) {
									selectAll();
								} else {
									deselectAll();
								}
							}}
						/>
						<span>Select All ({filteredMembers.length})</span>
					</label>
					<span class="selected-count">{selectedPlayers.size} selected</span>
				</div>

				{#if filteredMembers.length === 0}
					<div class="empty-state">
						<p>
							{searchQuery
								? 'No players match your search'
								: 'All available players are already in the session'}
						</p>
					</div>
				{:else}
					<div class="player-list">
						{#each filteredMembers as member (member.id)}
							<label class="player-item">
								<input
									type="checkbox"
									checked={selectedPlayers.has(member.id)}
									on:change={() => togglePlayerSelection(member.id)}
								/>
								<div class="player-info">
									<span class="player-name">{getMemberName(member)}</span>
									{#if member.user?.email}
										<span class="player-email">{member.user.email}</span>
									{/if}
								</div>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<div class="panel-footer">
				<button
					class="btn btn-secondary"
					on:click={() => (showAddPlayersPanel = false)}
				>
					Cancel
				</button>
				<button
					class="btn btn-primary"
					on:click={handleAddPlayers}
					disabled={playersToAdd.length === 0}
				>
					Add {selectedPlayers.size} Player{selectedPlayers.size !== 1 ? 's' : ''}
				</button>
			</div>
		</div>
	{/if}

	{#if currentPlayers.length === 0}
		<div class="empty-state">
			<span class="empty-icon">👥</span>
			<p>No players added to this session yet</p>
			{#if isSessionHost}
				<button class="btn btn-primary" on:click={() => (showAddPlayersPanel = true)}>
					Add Players
				</button>
			{/if}
		</div>
	{:else}
		<div class="current-players">
			{#each currentPlayers as player, index}
				<div class="player-card">
					<div class="player-rank">
						<span class="rank-number">{index + 1}</span>
					</div>
					<div class="player-details">
						<h4 class="player-name">{player.name || 'Unknown'}</h4>
						{#if player.teamName}
							<p class="player-team">{player.teamName}</p>
						{/if}
					</div>
					{#if player.points !== undefined}
						<div class="player-points">
							<span class="points-value">{player.points}</span>
							<span class="points-label">pts</span>
						</div>
					{/if}
					{#if isSessionHost}
						<button
							class="remove-btn"
							on:click={() => handleRemovePlayer(player.membershipId)}
							title="Remove player"
							aria-label="Remove {player.name} from session"
						>
							✕
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.roster-management {
		background: white;
		border-radius: 12px;
		padding: 16px;
		border: 1px solid #e0e0e0;
	}

	.roster-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		border-bottom: 1px solid #e0e0e0;
		padding-bottom: 12px;
	}

	.roster-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: #333;
	}

	.roster-stats {
		display: flex;
		gap: 8px;
	}

	.stat-badge {
		background: #f0f0f0;
		color: #666;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.roster-actions {
		margin-bottom: 16px;
	}

	.btn {
		padding: 0.6rem 1.2rem;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.btn.btn-primary:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.btn.btn-secondary {
		background: #f0f0f0;
		color: #333;
	}

	.btn.btn-secondary:hover:not(:disabled) {
		background: #e0e0e0;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.add-players-panel {
		background: #f9f9f9;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 16px;
		margin-bottom: 16px;
		animation: slideDown 0.3s ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.panel-header {
		margin-bottom: 16px;
	}

	.panel-header h4 {
		margin: 0 0 12px 0;
		font-size: 1rem;
		color: #333;
	}

	.panel-filters {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.search-box {
		position: relative;
		flex: 1;
		min-width: 200px;
	}

	.search-box input {
		width: 100%;
		padding: 0.6rem 2.5rem 0.6rem 1rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		transition: border-color 0.2s;
	}

	.search-box input:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.search-icon {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
		color: #999;
	}

	.team-filter {
		flex: 0 1 200px;
	}

	.team-filter select {
		width: 100%;
		padding: 0.6rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		transition: border-color 0.2s;
	}

	.team-filter select:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.player-selection {
		margin-bottom: 16px;
	}

	.selection-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid #ddd;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-weight: 500;
		color: #333;
	}

	.checkbox-label input[type='checkbox'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.selected-count {
		font-size: 0.85rem;
		color: #667eea;
		font-weight: 600;
	}

	.player-list {
		max-height: 300px;
		overflow-y: auto;
		border: 1px solid #ddd;
		border-radius: 6px;
	}

	.player-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-bottom: 1px solid #f0f0f0;
		cursor: pointer;
		transition: background 0.2s;
	}

	.player-item:hover {
		background: #fff;
	}

	.player-item:last-child {
		border-bottom: none;
	}

	.player-item input[type='checkbox'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.player-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.player-name {
		font-weight: 500;
		color: #333;
	}

	.player-email {
		font-size: 0.8rem;
		color: #999;
	}

	.panel-footer {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		padding-top: 12px;
		border-top: 1px solid #ddd;
	}

	.empty-state {
		text-align: center;
		padding: 24px 16px;
		color: #999;
	}

	.empty-icon {
		font-size: 2.5rem;
		display: block;
		margin-bottom: 8px;
	}

	.empty-state p {
		margin: 0 0 16px 0;
		font-size: 0.95rem;
	}

	.current-players {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.player-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: #f9f9f9;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.player-card:hover {
		background: #fff;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.player-rank {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.rank-number {
		color: white;
		font-weight: 700;
		font-size: 1rem;
	}

	.player-details {
		flex: 1;
	}

	.player-details .player-name {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #333;
	}

	.player-team {
		margin: 2px 0 0 0;
		font-size: 0.85rem;
		color: #999;
	}

	.player-points {
		display: flex;
		align-items: baseline;
		gap: 4px;
		text-align: center;
	}

	.points-value {
		font-size: 1.3rem;
		font-weight: 700;
		color: #667eea;
	}

	.points-label {
		font-size: 0.75rem;
		color: #999;
		font-weight: 600;
	}

	.remove-btn {
		background: #ffebee;
		border: none;
		color: #D32F2F;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1rem;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.remove-btn:hover {
		background: #ffcdd2;
		transform: scale(1.1);
	}

	@media (max-width: 640px) {
		.roster-management {
			padding: 12px;
		}

		.panel-filters {
			flex-direction: column;
		}

		.search-box,
		.team-filter {
			min-width: unset;
			flex: 1;
		}

		.player-card {
			padding: 10px;
			gap: 10px;
		}

		.player-rank {
			width: 32px;
			height: 32px;
		}

		.points-value {
			font-size: 1.1rem;
		}
	}
</style>
