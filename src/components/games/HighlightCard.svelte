<script>
	export let highlight = {
		id: '',
		title: '',
		description: '',
		highlight_type: 'play_of_the_game',
		media_url: '',
		media_type: 'image',
		timestamp_in_game: 0,
		reactions: { likes: 0, loves: 0, fire: 0, clap: 0 },
		is_featured: false,
		created_at: new Date()
	};

	export let onReact = null;
	export let onToggleFeatured = null;
	export let onDelete = null;
	export let currentUserCanManage = false;

	const highlightTypes = {
		play_of_the_game: { label: 'Play of the Game', icon: '⭐', color: '#FFD700' },
		clutch_moment: { label: 'Clutch Moment', icon: '🔥', color: '#FF6B6B' },
		comeback: { label: 'Comeback', icon: '📈', color: '#4CAF50' },
		milestone: { label: 'Milestone', icon: '🎯', color: '#2196F3' },
		funny_moment: { label: 'Funny Moment', icon: '😄', color: '#FF9800' },
		sportsmanship: { label: 'Sportsmanship', icon: '🤝', color: '#9C27B0' },
		upset: { label: 'Upset', icon: '😲', color: '#E91E63' },
		record_breaking: { label: 'Record Breaking', icon: '🚀', color: '#00BCD4' }
	};

	const reactionTypes = [
		{ id: 'likes', emoji: '👍', label: 'Like' },
		{ id: 'loves', emoji: '❤️', label: 'Love' },
		{ id: 'fire', emoji: '🔥', label: 'Fire' },
		{ id: 'clap', emoji: '👏', label: 'Clap' }
	];

	function getHighlightTypeInfo() {
		return highlightTypes[highlight.highlight_type] || {
			label: highlight.highlight_type,
			icon: '⭐',
			color: '#607D8B'
		};
	}

	function formatTime(seconds) {
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}

	function formatDate(dateString) {
		const date = new Date(dateString);
		return date.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getTotalReactions() {
		return Object.values(highlight.reactions || {}).reduce((a, b) => a + b, 0);
	}
</script>

<div class="highlight-card" class:featured={highlight.is_featured}>
	{#if highlight.is_featured}
		<div class="featured-badge">Featured</div>
	{/if}

	{#if highlight.media_url}
		<div class="highlight-media">
			{#if highlight.media_type === 'video'}
				<video
					src={highlight.media_url}
					controls
					preload="metadata"
					aria-label="Highlight video"
				/>
			{:else}
				<img
					src={highlight.media_url}
					alt={highlight.title}
					loading="lazy"
				/>
			{/if}
		</div>
	{/if}

	<div class="card-content">
		<div class="card-header">
			<div class="highlight-type-badge">
				{@const typeInfo = getHighlightTypeInfo()}
				<span class="type-icon">{typeInfo.icon}</span>
				<span class="type-label">{typeInfo.label}</span>
			</div>
			{#if currentUserCanManage}
				<div class="card-actions">
					{#if onToggleFeatured}
						<button
							class="action-btn"
							on:click={() => onToggleFeatured(highlight.id)}
							title={highlight.is_featured ? 'Unfeature' : 'Feature'}
						>
							{highlight.is_featured ? '⭐' : '☆'}
						</button>
					{/if}
					{#if onDelete}
						<button
							class="action-btn delete"
							on:click={() => onDelete(highlight.id)}
							title="Delete highlight"
						>
							🗑️
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<h3 class="highlight-title">{highlight.title}</h3>

		{#if highlight.description}
			<p class="highlight-description">{highlight.description}</p>
		{/if}

		<div class="highlight-meta">
			{#if highlight.timestamp_in_game !== undefined}
				<span class="meta-item">⏱️ {formatTime(highlight.timestamp_in_game)}</span>
			{/if}
			<span class="meta-item">📅 {formatDate(highlight.created_at)}</span>
		</div>

		<div class="reactions-section">
			<div class="reactions-list">
				{#each reactionTypes as reaction}
					{@const count = highlight.reactions?.[reaction.id] || 0}
					<button
						class="reaction-btn"
						class:has-reactions={count > 0}
						on:click={() => onReact && onReact(highlight.id, reaction.id)}
						title={reaction.label}
						aria-label={`${reaction.label} (${count})`}
					>
						<span class="reaction-emoji">{reaction.emoji}</span>
						{#if count > 0}
							<span class="reaction-count">{count}</span>
						{/if}
					</button>
				{/each}
			</div>
			{#if getTotalReactions() > 0}
				<span class="total-reactions">{getTotalReactions()} reaction{getTotalReactions() !== 1 ? 's' : ''}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.highlight-card {
		background: white;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: all 0.3s ease;
		position: relative;
	}

	.highlight-card:hover {
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		transform: translateY(-4px);
	}

	.highlight-card.featured {
		border: 2px solid #FFD700;
		background: linear-gradient(135deg, #fffbea 0%, #ffffff 100%);
	}

	.featured-badge {
		position: absolute;
		top: 12px;
		right: 12px;
		background: #FFD700;
		color: #333;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		z-index: 10;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
	}

	.highlight-media {
		position: relative;
		width: 100%;
		background: #000;
		aspect-ratio: 16 / 9;
		overflow: hidden;
	}

	.highlight-media img,
	.highlight-media video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-content {
		padding: 16px;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}

	.highlight-type-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: #f0f0f0;
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.type-icon {
		font-size: 1rem;
	}

	.card-actions {
		display: flex;
		gap: 6px;
	}

	.action-btn {
		background: none;
		border: none;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition: all 0.2s;
		opacity: 0.7;
	}

	.action-btn:hover {
		opacity: 1;
		background: #f0f0f0;
	}

	.action-btn.delete:hover {
		background: #ffebee;
	}

	.highlight-title {
		margin: 0 0 8px 0;
		font-size: 1.1rem;
		color: #333;
		line-height: 1.3;
	}

	.highlight-description {
		margin: 0 0 12px 0;
		color: #666;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.highlight-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 12px;
		padding-bottom: 12px;
		border-bottom: 1px solid #eee;
	}

	.meta-item {
		font-size: 0.85rem;
		color: #999;
	}

	.reactions-section {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.reactions-list {
		display: flex;
		gap: 6px;
	}

	.reaction-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		background: #f5f5f5;
		border: 1px solid #e0e0e0;
		padding: 4px 8px;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.9rem;
	}

	.reaction-btn:hover {
		background: #efefef;
		border-color: #d0d0d0;
	}

	.reaction-btn.has-reactions {
		background: #e3f2fd;
		border-color: #2196F3;
		color: #2196F3;
	}

	.reaction-emoji {
		font-size: 1rem;
	}

	.reaction-count {
		font-size: 0.75rem;
		font-weight: 600;
	}

	.total-reactions {
		font-size: 0.8rem;
		color: #999;
	}

	@media (max-width: 640px) {
		.card-content {
			padding: 12px;
		}

		.highlight-title {
			font-size: 1rem;
		}

		.highlight-meta {
			flex-direction: column;
			gap: 6px;
		}

		.reactions-section {
			flex-direction: column;
			align-items: flex-start;
			width: 100%;
		}

		.reactions-list {
			width: 100%;
			flex-wrap: wrap;
		}
	}
</style>
