<script>
	import { createEventDispatcher } from 'svelte';
	import { showToast } from '../../stores/toasts.js';

	export let availableInstances = [];
	export let isLoading = false;

	const dispatch = createEventDispatcher();

	let showModal = false;
	let selectedInstanceId = null;
	let isSubmitting = false;
	let searchQuery = '';

	$: filteredInstances = availableInstances.filter(instance => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			instance.name?.toLowerCase().includes(query) ||
			instance.description?.toLowerCase().includes(query)
		);
	});

	function openModal() {
		showModal = true;
		selectedInstanceId = null;
		searchQuery = '';
	}

	function closeModal() {
		showModal = false;
		selectedInstanceId = null;
		searchQuery = '';
	}

	async function handleJoinInstance() {
		if (!selectedInstanceId) {
			showToast('Please select a community', 'error');
			return;
		}

		isSubmitting = true;
		try {
			dispatch('joinInstance', { instanceId: selectedInstanceId });
			showToast('Joining community...', 'success');
			closeModal();
		} catch (error) {
			console.error('Error joining instance:', error);
			showToast(error.message || 'Failed to join community', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	function getInstanceIcon(instance) {
		return instance.icon || '🏘️';
	}
</script>

<button
	class="join-instance-btn"
	on:click={openModal}
	disabled={isLoading}
	aria-label="Join a community"
>
	<span class="icon">➕</span>
	<span class="label">Join Community</span>
</button>

{#if showModal}
	<div class="modal-overlay" on:click={closeModal}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Join a Community</h3>
				<button
					class="close-button"
					on:click={closeModal}
					aria-label="Close modal"
					disabled={isSubmitting}
				>
					✕
				</button>
			</div>

			<div class="modal-body">
				{#if availableInstances.length === 0}
					<div class="empty-state">
						<p class="empty-icon">🏘️</p>
						<p>No communities available to join.</p>
						<p style="font-size: 0.9rem; color: #999;">
							Contact your administrator to be invited to a community.
						</p>
					</div>
				{:else}
					<div class="search-box">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search communities..."
							aria-label="Search communities"
						/>
						<span class="search-icon">🔍</span>
					</div>

					{#if filteredInstances.length === 0}
						<div class="empty-state">
							<p>No communities match your search.</p>
						</div>
					{:else}
						<div class="instances-list">
							{#each filteredInstances as instance (instance.id)}
								<label class="instance-item">
									<input
										type="radio"
										name="instance"
										value={instance.id}
										bind:group={selectedInstanceId}
										disabled={isSubmitting}
									/>
									<div class="instance-content">
										<div class="instance-header">
											<span class="instance-icon">{getInstanceIcon(instance)}</span>
											<h4 class="instance-name">{instance.name}</h4>
										</div>
										{#if instance.description}
											<p class="instance-description">{instance.description}</p>
										{/if}
										{#if instance.member_count !== undefined}
											<span class="member-count">
												👥 {instance.member_count} member{instance.member_count !== 1
													? 's'
													: ''}
											</span>
										{/if}
									</div>
								</label>
							{/each}
						</div>
					{/if}
				{/if}
			</div>

			{#if availableInstances.length > 0}
				<div class="modal-footer">
					<button
						class="button secondary"
						on:click={closeModal}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						class="button primary"
						on:click={handleJoinInstance}
						disabled={!selectedInstanceId || isSubmitting}
						aria-busy={isSubmitting}
					>
						{isSubmitting ? 'Joining...' : 'Join Community'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.join-instance-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.join-instance-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
	}

	.join-instance-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.icon {
		font-size: 1.2rem;
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
		border-radius: 12px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
		flex-shrink: 0;
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

	.close-button:hover:not(:disabled) {
		background: #f0f0f0;
		color: #333;
	}

	.close-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-body {
		padding: 1.5rem;
		flex: 1;
		overflow-y: auto;
	}

	.search-box {
		position: relative;
		margin-bottom: 1.5rem;
	}

	.search-box input {
		width: 100%;
		padding: 0.75rem 2.5rem 0.75rem 1rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.95rem;
		transition: border-color 0.2s;
	}

	.search-box input:focus {
		outline: none;
		border-color: #4CAF50;
		box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
	}

	.search-icon {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
		color: #999;
	}

	.instances-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.instance-item {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		align-items: flex-start;
	}

	.instance-item:hover {
		border-color: #4CAF50;
		background: #f9f9f9;
	}

	.instance-item input[type='radio'] {
		width: 20px;
		height: 20px;
		margin-top: 4px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.instance-item input[type='radio']:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.instance-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.instance-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.instance-icon {
		font-size: 1.5rem;
	}

	.instance-name {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
		color: #333;
	}

	.instance-description {
		margin: 0;
		font-size: 0.9rem;
		color: #666;
		line-height: 1.4;
	}

	.member-count {
		font-size: 0.85rem;
		color: #999;
		display: inline-block;
	}

	.empty-state {
		text-align: center;
		padding: 2rem 1rem;
		color: #999;
	}

	.empty-icon {
		font-size: 3rem;
		display: block;
		margin-bottom: 1rem;
	}

	.empty-state p {
		margin: 0.5rem 0;
	}

	.modal-footer {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		padding: 1.5rem;
		border-top: 1px solid #e0e0e0;
		flex-shrink: 0;
	}

	.button {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 6px;
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.button.primary {
		background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
		color: white;
	}

	.button.primary:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
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
		.modal-content {
			max-width: 100%;
		}

		.instance-item {
			padding: 0.75rem;
		}

		.instance-name {
			font-size: 1rem;
		}

		.label {
			display: none;
		}

		.join-instance-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
