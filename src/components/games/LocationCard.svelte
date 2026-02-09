<script>
	export let location = {
		id: '',
		name: '',
		description: '',
		venue_type: 'office',
		capacity: null,
		address: '',
		amenities: [],
		image_url: '',
		is_active: true
	};

	export let onEdit = null;
	export let onDelete = null;
	export let isGameManager = false;

	const venueIcons = {
		office: '🏢',
		park: '🌳',
		gym: '🏋️',
		conference_room: '🛑',
		outdoor: '🏞️',
		other: '📍'
	};

	const amenityIcons = {
		parking: '🅿️',
		wifi: '📡',
		food: '🍕',
		restrooms: '🚻',
		seating: '🪑',
		lighting: '💡'
	};

	function getVenueIcon() {
		return venueIcons[location.venue_type] || '📍';
	}

	function formatVenueType(type) {
		return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
	}
</script>

<div class="location-card" class:inactive={!location.is_active}>
	<div class="card-header">
		<div class="venue-info">
			<h3>
				<span class="icon">{getVenueIcon()}</span>
				{location.name}
			</h3>
			{#if !location.is_active}
				<span class="badge inactive">Inactive</span>
			{/if}
		</div>
		{#if isGameManager}
			<div class="actions">
				{#if onEdit}
					<button class="action-btn" on:click={() => onEdit(location)} title="Edit location">
						✏️
					</button>
				{/if}
				{#if onDelete}
					<button class="action-btn delete" on:click={() => onDelete(location.id)} title="Delete location">
						🗑️
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if location.description}
		<p class="description">{location.description}</p>
	{/if}

	<div class="location-details">
		{#if location.address}
			<div class="detail">
				<span class="label">📍 Address</span>
				<span class="value">{location.address}</span>
			</div>
		{/if}

		<div class="detail">
			<span class="label">🏷️ Type</span>
			<span class="value">{formatVenueType(location.venue_type)}</span>
		</div>

		{#if location.capacity}
			<div class="detail">
				<span class="label">👥 Capacity</span>
				<span class="value">{location.capacity} people</span>
			</div>
		{/if}
	</div>

	{#if location.amenities && location.amenities.length > 0}
		<div class="amenities">
			<p class="amenities-label">Amenities</p>
			<div class="amenities-list">
				{#each location.amenities as amenity}
					<span class="amenity-badge">
						{amenityIcons[amenity] || '✓'} {amenity.replace('_', ' ')}
					</span>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.location-card {
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1.25rem;
		transition: all 0.3s ease;
	}

	.location-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		border-color: #667eea;
	}

	.location-card.inactive {
		opacity: 0.6;
		background: #f9f9f9;
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.venue-info {
		flex: 1;
	}

	.card-header h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.2rem;
		color: #333;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.icon {
		font-size: 1.4rem;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		background: #f0f0f0;
		color: #666;
	}

	.badge.inactive {
		background: #ffebee;
		color: #c62828;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		background: none;
		border: none;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0.5rem;
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

	.description {
		margin: 0 0 1rem 0;
		color: #666;
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.location-details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.detail .label {
		font-size: 0.85rem;
		color: #999;
		font-weight: 500;
	}

	.detail .value {
		color: #333;
		font-size: 0.95rem;
	}

	.amenities {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0e0;
	}

	.amenities-label {
		margin: 0 0 0.75rem 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
	}

	.amenities-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.amenity-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: #f0f0f0;
		color: #333;
		padding: 0.4rem 0.75rem;
		border-radius: 12px;
		font-size: 0.8rem;
	}

	@media (max-width: 640px) {
		.location-card {
			padding: 1rem;
		}

		.card-header {
			flex-direction: column;
		}

		.location-details {
			grid-template-columns: 1fr;
		}
	}
</style>
