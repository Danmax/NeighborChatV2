<script>
	import { createEventDispatcher } from 'svelte';
	import { showToast } from '../../stores/toasts.js';
	import HighlightCard from './HighlightCard.svelte';

	export let session = null;
	export let players = [];
	export let isSessionHost = false;
	export let isReferee = false;

	const dispatch = createEventDispatcher();

	let matchStarted = false;
	let elapsedSeconds = 0;
	let timerInterval = null;
	let scoringMode = 'individual'; // 'individual' or 'team'
	let playLog = [];
	let highlights = [];
	let showHighlightForm = false;
	let highlightFormData = {
		title: '',
		type: 'play_of_the_game',
		description: ''
	};

	const highlightTypes = [
		{ id: 'play_of_the_game', label: '⭐ Play of the Game' },
		{ id: 'clutch_moment', label: '🔥 Clutch Moment' },
		{ id: 'comeback', label: '📈 Comeback' },
		{ id: 'milestone', label: '🎯 Milestone' },
		{ id: 'funny_moment', label: '😄 Funny Moment' },
		{ id: 'sportsmanship', label: '🤝 Sportsmanship' },
		{ id: 'upset', label: '😲 Upset' },
		{ id: 'record_breaking', label: '🚀 Record Breaking' }
	];

	function formatTime(seconds) {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}

	function startTimer() {
		if (timerInterval) return;
		matchStarted = true;
		timerInterval = setInterval(() => {
			elapsedSeconds++;
		}, 1000);
	}

	function pauseTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function stopTimer() {
		pauseTimer();
		matchStarted = false;
		elapsedSeconds = 0;
	}

	function resetTimer() {
		pauseTimer();
		elapsedSeconds = 0;
	}

	function updatePlayerScore(memberId, points) {
		const player = players.find(p => p.membershipId === memberId);
		if (player) {
			player.points = (player.points || 0) + points;
			players = players;
			addPlayLog(`${player.name} scored ${points} points`, 'score');
		}
	}

	function addPlayLog(message, type = 'info') {
		playLog = [
			{
				timestamp: elapsedSeconds,
				message,
				type,
				id: Date.now()
			},
			...playLog
		];
	}

	async function createHighlight() {
		if (!highlightFormData.title.trim()) {
			showToast('Highlight title is required', 'error');
			return;
		}

		const highlight = {
			id: `hl_${Date.now()}`,
			title: highlightFormData.title,
			description: highlightFormData.description,
			type: highlightFormData.type,
			timestamp: elapsedSeconds,
			reactions: { likes: 0, loves: 0, fire: 0, clap: 0 },
			createdAt: new Date()
		};

		highlights = [highlight, ...highlights];
		addPlayLog(`Highlight created: "${highlight.title}"`, 'highlight');

		// Reset form
		highlightFormData = {
			title: '',
			type: 'play_of_the_game',
			description: ''
		};
		showHighlightForm = false;
		showToast('Highlight created!', 'success');
	}

	function handleReaction(highlightId, reactionType) {
		const highlight = highlights.find(h => h.id === highlightId);
		if (highlight) {
			highlight.reactions[reactionType] = (highlight.reactions[reactionType] || 0) + 1;
			highlights = highlights;
		}
	}

	function endMatch() {
		if (!confirm('End the match? This will finalize all scores.')) return;
		stopTimer();
		dispatch('endMatch', { finalScores: players, log: playLog });
	}

	function handleCancelMatch() {
		if (!confirm('Cancel the match? This cannot be undone.')) return;
		stopTimer();
		dispatch('cancelMatch');
	}

	$: topPlayers = [...players].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 5);
</script>

<div class="match-view">
	<!-- Match Header -->
	<div class="match-header">
		<div class="match-info">
			<h2>{session?.name || 'Live Match'}</h2>
			<p class="match-status">
				{#if matchStarted}
					<span class="live-badge">● LIVE</span>
				{:else}
					<span class="ready-badge">◌ Ready</span>
				{/if}
			</p>
		</div>

		<div class="match-timer">
			<div class="timer-display">
				{formatTime(elapsedSeconds)}
			</div>
			{#if isSessionHost || isReferee}
				<div class="timer-controls">
					{#if !matchStarted}
						<button class="btn-icon" on:click={startTimer} title="Start Timer">
							▶
						</button>
					{:else}
						<button class="btn-icon" on:click={pauseTimer} title="Pause Timer">
							⏸
						</button>
					{/if}
					<button class="btn-icon" on:click={resetTimer} title="Reset Timer">
						↻
					</button>
				</div>
			{/if}
		</div>
	</div>

	<div class="match-container">
		<!-- Leaderboard -->
		<div class="match-section leaderboard-section">
			<h3>Leaderboard</h3>
			{#if topPlayers.length > 0}
				<div class="leaderboard">
					{#each topPlayers as player, index}
						<div class="leaderboard-row" class:winning={index === 0}>
							<span class="rank-badge">{index + 1}</span>
							<span class="player-name">{player.name || 'Unknown'}</span>
							<span class="points-badge">{player.points || 0} pts</span>
						</div>
					{/each}
				</div>
			{:else}
				<div class="empty-state">
					<p>No scores yet</p>
				</div>
			{/if}
		</div>

		<!-- Scoring Panel (Referee Only) -->
		{#if isSessionHost || isReferee}
			<div class="match-section scoring-section">
				<h3>Quick Score</h3>
				<div class="scoring-grid">
					{#each players.slice(0, 6) as player}
						<div class="score-card">
							<h4>{player.name || 'Unknown'}</h4>
							<div class="current-score">{player.points || 0}</div>
							<div class="score-buttons">
								{#each [1, 5, 10] as points}
									<button
										class="score-btn"
										on:click={() => updatePlayerScore(player.membershipId, points)}
									>
										+{points}
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				{#if players.length > 6}
					<p class="text-muted">Showing first 6 players. Use detail view for all players.</p>
				{/if}
			</div>
		{/if}

		<!-- Highlights -->
		<div class="match-section highlights-section">
			<div class="section-header">
				<h3>Highlights</h3>
				{#if isSessionHost || isReferee}
					<button class="btn-small" on:click={() => (showHighlightForm = !showHighlightForm)}>
						{showHighlightForm ? '✕' : '+'}
					</button>
				{/if}
			</div>

			{#if showHighlightForm && (isSessionHost || isReferee)}
				<div class="highlight-form">
					<div class="form-group">
						<label for="highlight-title">Title *</label>
						<input
							id="highlight-title"
							type="text"
							bind:value={highlightFormData.title}
							placeholder="e.g., Amazing Catch!"
						/>
					</div>

					<div class="form-group">
						<label for="highlight-type">Highlight Type *</label>
						<select id="highlight-type" bind:value={highlightFormData.type}>
							{#each highlightTypes as type}
								<option value={type.id}>{type.label}</option>
							{/each}
						</select>
					</div>

					<div class="form-group">
						<label for="highlight-desc">Description</label>
						<textarea
							id="highlight-desc"
							bind:value={highlightFormData.description}
							placeholder="Describe what happened..."
							rows="2"
						/>
					</div>

					<div class="form-actions">
						<button class="btn btn-secondary" on:click={() => (showHighlightForm = false)}>
							Cancel
						</button>
						<button class="btn btn-primary" on:click={createHighlight}>
							Create Highlight
						</button>
					</div>
				</div>
			{/if}

			{#if highlights.length === 0}
				<div class="empty-state">
					<p>No highlights yet</p>
				</div>
			{:else}
				<div class="highlights-grid">
					{#each highlights as highlight}
						<HighlightCard
							{highlight}
							onReact={(id, reaction) => handleReaction(id, reaction)}
						/>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Play Log -->
		<div class="match-section log-section">
			<h3>Play Log</h3>
			{#if playLog.length === 0}
				<div class="empty-state">
					<p>No events yet</p>
				</div>
			{:else}
				<div class="play-log">
					{#each playLog as entry}
						<div class="log-entry" class:highlight={entry.type === 'highlight'}>
							<span class="log-time">{formatTime(entry.timestamp)}</span>
							<span class="log-message">{entry.message}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Match Actions -->
	{#if isSessionHost || isReferee}
		<div class="match-actions">
			<button class="btn btn-secondary" on:click={handleCancelMatch}>
				Cancel Match
			</button>
			<button class="btn btn-success" on:click={endMatch} disabled={!matchStarted}>
				✓ End Match
			</button>
		</div>
	{/if}
</div>

<style>
	.match-view {
		background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
		border-radius: 12px;
		padding: 20px;
		min-height: 600px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.match-header {
		background: white;
		border-radius: 12px;
		padding: 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.match-info h2 {
		margin: 0 0 8px 0;
		font-size: 1.5rem;
		color: #333;
	}

	.match-status {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
		color: #666;
	}

	.live-badge {
		color: #F44336;
		font-weight: 700;
		animation: pulse 1s infinite;
	}

	.ready-badge {
		color: #FF9800;
		font-weight: 600;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.match-timer {
		text-align: center;
	}

	.timer-display {
		font-size: 3rem;
		font-weight: 700;
		color: #667eea;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		letter-spacing: 2px;
		margin-bottom: 12px;
	}

	.timer-controls {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	.btn-icon {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: none;
		background: #f0f0f0;
		cursor: pointer;
		font-size: 1rem;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-icon:hover {
		background: #e0e0e0;
		transform: scale(1.1);
	}

	.match-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 16px;
		flex: 1;
	}

	.match-section {
		background: white;
		border-radius: 12px;
		padding: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.match-section h3 {
		margin: 0 0 16px 0;
		font-size: 1.1rem;
		color: #333;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}

	.section-header h3 {
		margin: 0;
	}

	.btn-small {
		padding: 4px 12px;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.btn-small:hover {
		background: #764ba2;
	}

	.leaderboard {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.leaderboard-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: #f9f9f9;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.leaderboard-row:hover {
		background: #f0f0f0;
	}

	.leaderboard-row.winning {
		background: linear-gradient(135deg, #fff9c4 0%, #fffde7 100%);
		border: 1px solid #FFD700;
	}

	.rank-badge {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		flex-shrink: 0;
	}

	.player-name {
		flex: 1;
		font-weight: 500;
		color: #333;
	}

	.points-badge {
		background: #667eea;
		color: white;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.scoring-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
	}

	.score-card {
		background: #f9f9f9;
		padding: 12px;
		border-radius: 8px;
		text-align: center;
		border: 1px solid #e0e0e0;
	}

	.score-card h4 {
		margin: 0 0 8px 0;
		font-size: 0.9rem;
		color: #333;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.current-score {
		font-size: 2rem;
		font-weight: 700;
		color: #667eea;
		margin-bottom: 8px;
	}

	.score-buttons {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.score-btn {
		padding: 6px 8px;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 600;
		transition: all 0.2s;
	}

	.score-btn:hover {
		background: #764ba2;
		transform: scale(1.05);
	}

	.highlight-form {
		background: #f9f9f9;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 16px;
		margin-bottom: 16px;
	}

	.form-group {
		margin-bottom: 12px;
	}

	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-weight: 500;
		color: #333;
		font-size: 0.9rem;
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.9rem;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.form-actions {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}

	.btn {
		padding: 0.6rem 1.2rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.btn.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.btn.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.btn.btn-secondary {
		background: #f0f0f0;
		color: #333;
	}

	.btn.btn-secondary:hover {
		background: #e0e0e0;
	}

	.btn.btn-success {
		background: #4CAF50;
		color: white;
	}

	.btn.btn-success:hover:not(:disabled) {
		background: #45a049;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.highlights-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 12px;
	}

	.play-log {
		max-height: 300px;
		overflow-y: auto;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		background: #fafafa;
	}

	.log-entry {
		padding: 10px 12px;
		border-bottom: 1px solid #e0e0e0;
		font-size: 0.9rem;
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	.log-entry.highlight {
		background: #fffbea;
		color: #FF9800;
	}

	.log-time {
		font-weight: 600;
		color: #667eea;
		min-width: 50px;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.85rem;
	}

	.log-message {
		flex: 1;
		color: #333;
	}

	.empty-state {
		text-align: center;
		padding: 24px;
		color: #999;
	}

	.text-muted {
		color: #999;
		font-size: 0.85rem;
		margin-top: 8px;
	}

	.match-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	@media (max-width: 768px) {
		.match-view {
			padding: 12px;
			gap: 12px;
		}

		.match-header {
			flex-direction: column;
			gap: 16px;
			text-align: center;
		}

		.match-container {
			grid-template-columns: 1fr;
		}

		.timer-display {
			font-size: 2rem;
		}

		.scoring-grid {
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		}

		.match-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}
	}
</style>
