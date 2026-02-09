<script>
	import { createEventDispatcher } from 'svelte';
	import { showToast } from '../../stores/toasts.js';
	import { createGameLocation } from '../../services/games.service.js';

	export let instanceId = '';
	export let isGameManager = false;

	const dispatch = createEventDispatcher();

	let isOpen = false;
	let isSubmitting = false;
	let formData = {
		name: '',
		description: '',
		address: '',
		venue_type: 'office',
		capacity: '',
		amenities: []
	};

	const venueTypes = [
		{ id: 'office', label: 'Office' },
		{ id: 'park', label: 'Park' },
		{ id: 'gym', label: 'Gym' },
		{ id: 'conference_room', label: 'Conference Room' },
		{ id: 'outdoor', label: 'Outdoor' },
		{ id: 'other', label: 'Other' }
	];

	const amenitiesList = [
		{ id: 'parking', label: 'Parking' },
		{ id: 'wifi', label: 'WiFi' },
		{ id: 'food', label: 'Food/Snacks' },
		{ id: 'restrooms', label: 'Restrooms' },
		{ id: 'seating', label: 'Seating' },
		{ id: 'lighting', label: 'Lighting' }
	];

	function toggleAmenity(amenityId) {
		const index = formData.amenities.indexOf(amenityId);
		if (index > -1) {
			formData.amenities.splice(index, 1);
		} else {
			formData.amenities.push(amenityId);
		}
		formData.amenities = formData.amenities;
	}

	function hasAmenity(amenityId) {
		return formData.amenities.includes(amenityId);
	}

	function resetForm() {
		formData = {
			name: '',
			description: '',
			address: '',
			venue_type: 'office',
			capacity: '',
			amenities: []
		};
	}

	function openModal() {
		if (!isGameManager) {
			showToast('Only Game Managers can create locations', 'warning');
			return;
		}
		isOpen = true;
		resetForm();
	}

	function closeModal() {
		isOpen = false;
		resetForm();
	}

	async function handleSubmit() {
		if (!formData.name.trim()) {
			showToast('Location name is required', 'error');
			return;
		}

		if (!instanceId) {
			showToast('Instance ID is missing', 'error');
			return;
		}

		isSubmitting = true;
		try {
			const locationData = {
				name: formData.name.trim(),
				description: formData.description.trim() || null,
				address: formData.address.trim() || null,
				venue_type: formData.venue_type,
				capacity: formData.capacity ? parseInt(formData.capacity) : null,
				amenities: formData.amenities.length > 0 ? formData.amenities : []
			};

			await createGameLocation(instanceId, locationData);
			showToast('Location created successfully', 'success');
			dispatch('locationCreated', { location: locationData });
			closeModal();
		} catch (error) {
			console.error('Error creating location:', error);
			showToast(error.message || 'Failed to create location', 'error');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<button
	class="create-location-button"
	on:click={openModal}
	disabled={!isGameManager}
	title={isGameManager ? 'Create a new game location' : 'Only Game Managers can create locations'}
	aria-label="Create location"
>
	<span class="icon">📍</span>
	<span class="label">Add Location</span>
</button>

{#if isOpen}
	<div class="modal-overlay" on:click={closeModal}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Create Game Location</h3>
				<button class="close-button" on:click={closeModal} aria-label="Close modal">✕</button>
			</div>

			<div class="modal-body">
				<form on:submit|preventDefault={handleSubmit}>
					<div class="form-group">
						<label for="name">Location Name *</label>
						<input
							id="name"
							type="text"
							bind:value={formData.name}
							placeholder="e.g., Downtown Office, Central Park"
							required
							disabled={isSubmitting}
						/>
					</div>

					<div class="form-group">
						<label for="description">Description</label>
						<textarea
							id="description"
							bind:value={formData.description}
							placeholder="Describe the location..."
							rows="3"
							disabled={isSubmitting}
						/>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="address">Address</label>
							<input
								id="address"
								type="text"
								bind:value={formData.address}
								placeholder="Street address"
								disabled={isSubmitting}
							/>
						</div>

						<div class="form-group">
							<label for="venue_type">Venue Type</label>
							<select
								id="venue_type"
								bind:value={formData.venue_type}
								disabled={isSubmitting}
							>
								{#each venueTypes as type}
									<option value={type.id}>{type.label}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="capacity">Capacity</label>
							<input
								id="capacity"
								type="number"
								bind:value={formData.capacity}
								placeholder="Max participants"
								min="1"
								disabled={isSubmitting}
							/>
						</div>
					</div>

					<div class="form-group">
						<label>Amenities</label>
						<div class="amenities-grid">
							{#each amenitiesList as amenity}
								<label class="checkbox-label">
									<input
										type="checkbox"
										checked={hasAmenity(amenity.id)}
										on:change={() => toggleAmenity(amenity.id)}
										disabled={isSubmitting}
									/>
									<span>{amenity.label}</span>
								</label>
							{/each}
						</div>
					</div>
				</form>
			</div>

			<div class="modal-footer">
				<button class="button secondary" on:click={closeModal} disabled={isSubmitting}>
					Cancel
				</button>
				<button
					class="button primary"
					on:click={handleSubmit}
					disabled={isSubmitting || !formData.name.trim()}
					aria-busy={isSubmitting}
				>
					{isSubmitting ? 'Creating...' : 'Create Location'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.create-location-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.create-location-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.create-location-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.icon {
		font-size: 1.1rem;
	}

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
		padding: 1rem;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.3rem;
		color: #333;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #666;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-button:hover {
		background: #f0f0f0;
		color: #333;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
		font-size: 0.9rem;
	}

	.form-group input,
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.9rem;
		transition: border-color 0.2s;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.form-group input:disabled,
	.form-group textarea:disabled,
	.form-group select:disabled {
		background: #f5f5f5;
		cursor: not-allowed;
	}

	.amenities-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.75rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.checkbox-label input[type='checkbox'] {
		width: auto;
		margin: 0;
		cursor: pointer;
	}

	.checkbox-label input:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.modal-footer {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		padding: 1.5rem;
		border-top: 1px solid #e0e0e0;
	}

	.button {
		padding: 0.6rem 1.2rem;
		border: none;
		border-radius: 4px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.button.primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.button.primary:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.button.secondary {
		background: #f0f0f0;
		color: #333;
	}

	.button.secondary:hover:not(:disabled) {
		background: #e0e0e0;
	}

	.button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.form-row {
			grid-template-columns: 1fr;
		}

		.amenities-grid {
			grid-template-columns: 1fr;
		}

		.label {
			display: none;
		}
	}
</style>
