<script>
	import { createEventDispatcher } from 'svelte';
	import { showToast } from '../../stores/toasts.js';
	import { requestGameRole } from '../../services/games.service.js';

	export let instanceId = '';
	export let currentRoles = [];

	const dispatch = createEventDispatcher();

	let isOpen = false;
	let isSubmitting = false;
	let selectedRole = 'game_manager';
	let reason = '';

	const roleOptions = [
		{
			id: 'game_manager',
			label: 'Game Manager',
			icon: '🎮',
			description: 'Create and manage game templates and locations',
			requirements: 'Need to be an active instance member'
		},
		{
			id: 'team_lead',
			label: 'Team Lead',
			icon: '👥',
			description: 'Create and manage your own teams',
			requirements: 'Must have participated in at least one game'
		},
		{
			id: 'referee',
			label: 'Referee',
			icon: '⚖️',
			description: 'Manage scoring and timekeeping for matches',
			requirements: 'Must have strong knowledge of game rules'
		}
	];

	const roleLabels = {
		game_manager: 'Game Manager',
		team_lead: 'Team Lead',
		referee: 'Referee'
	};

	function hasRole(role) {
		return currentRoles.some(r => r.role === role && r.is_active);
	}

	function getSelectedRoleInfo() {
		return roleOptions.find(r => r.id === selectedRole);
	}

	async function handleSubmit() {
		if (!selectedRole || !instanceId) {
			showToast('Please select a role', 'error');
			return;
		}

		if (hasRole(selectedRole)) {
			showToast(`You already have the ${roleLabels[selectedRole]} role`, 'warning');
			return;
		}

		isSubmitting = true;
		try {
			await requestGameRole(instanceId, selectedRole, reason || null);
			showToast(`Request submitted for ${roleLabels[selectedRole]} role`, 'success');
			dispatch('roleRequested', { role: selectedRole });
			closeModal();
		} catch (error) {
			console.error('Error requesting role:', error);
			showToast(error.message || 'Failed to submit role request', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	function openModal() {
		isOpen = true;
		reason = '';
		selectedRole = 'game_manager';
	}

	function closeModal() {
		isOpen = false;
		reason = '';
		selectedRole = 'game_manager';
	}
</script>

<button
	class="role-request-button"
	title="Request a game-specific role"
	on:click={openModal}
	aria-label="Request game role"
>
	<span class="icon">✨</span>
	<span class="label">Request Role</span>
</button>

{#if isOpen}
	<div class="modal-overlay" on:click={closeModal}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Request Game Role</h3>
				<button class="close-button" on:click={closeModal} aria-label="Close modal">✕</button>
			</div>

			<div class="modal-body">
				<p class="description">
					Request a specialized role to unlock additional features and permissions in the Games module.
				</p>

				<div class="roles-grid">
					{#each roleOptions as option}
						{@const isSelected = selectedRole === option.id}
						{@const alreadyHas = hasRole(option.id)}
						<div
							class="role-card"
							class:selected={isSelected}
							class:disabled={alreadyHas}
							on:click={() => !alreadyHas && (selectedRole = option.id)}
						>
							<div class="role-icon">{option.icon}</div>
							<h4>{option.label}</h4>
							{#if alreadyHas}
								<span class="badge">You have this</span>
							{:else}
								<p class="desc">{option.description}</p>
								<p class="req">{option.requirements}</p>
							{/if}
						</div>
					{/each}
				</div>

				{#if !hasRole(selectedRole)}
					<div class="form-group">
						<label for="reason">Why do you want this role? (Optional)</label>
						<textarea
							id="reason"
							bind:value={reason}
							placeholder="Tell admins why you're interested in this role..."
							rows="4"
							disabled={isSubmitting}
						/>
						<p class="help-text">
							This helps admins understand your experience and intentions.
						</p>
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button class="button secondary" on:click={closeModal} disabled={isSubmitting}>
					Cancel
				</button>
				{#if !hasRole(selectedRole)}
					<button
						class="button primary"
						on:click={handleSubmit}
						disabled={isSubmitting}
						aria-busy={isSubmitting}
					>
						{isSubmitting ? 'Submitting...' : 'Submit Request'}
					</button>
				{:else}
					<button class="button secondary" disabled>
						Already have this role
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.role-request-button {
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

	.role-request-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.role-request-button:active {
		transform: translateY(0);
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

	.description {
		margin: 0 0 1.5rem 0;
		color: #666;
		font-size: 0.95rem;
	}

	.roles-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.role-card {
		padding: 1rem;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		text-align: center;
		cursor: pointer;
		transition: all 0.3s ease;
		background: #fff;
	}

	.role-card:not(.disabled):hover {
		border-color: #667eea;
		background: #f8f9ff;
	}

	.role-card.selected {
		border-color: #667eea;
		background: linear-gradient(135deg, #f8f9ff 0%, #f0f1ff 100%);
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.role-card.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.role-icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}

	.role-card h4 {
		margin: 0.5rem 0;
		font-size: 1rem;
		color: #333;
	}

	.role-card .desc {
		font-size: 0.75rem;
		color: #666;
		margin: 0.5rem 0;
	}

	.role-card .req {
		font-size: 0.7rem;
		color: #999;
		margin: 0;
	}

	.badge {
		display: inline-block;
		background: #4CAF50;
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		margin-top: 0.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: inherit;
		font-size: 0.9rem;
		resize: vertical;
		transition: border-color 0.2s;
	}

	.form-group textarea:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.form-group textarea:disabled {
		background: #f5f5f5;
		cursor: not-allowed;
	}

	.help-text {
		font-size: 0.8rem;
		color: #999;
		margin-top: 0.5rem;
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
		.roles-grid {
			grid-template-columns: 1fr;
		}

		.modal-content {
			max-height: 100vh;
		}

		.label {
			display: none;
		}
	}
</style>
