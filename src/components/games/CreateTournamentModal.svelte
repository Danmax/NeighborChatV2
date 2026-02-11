<script>
	import { createEventDispatcher } from 'svelte';
	import { showToast } from '../../stores/toasts.js';
	import { createTournament } from '../../services/games.service.js';

	export let instanceId = '';
	export let gameTemplates = [];
	export let isGameManager = false;

	const dispatch = createEventDispatcher();

	let isOpen = false;
	let isSubmitting = false;
	let step = 1;
	let formData = {
		name: '',
		description: '',
		tournament_type: 'single_elimination',
		game_template_id: null,
		participant_type: 'individual',
		start_date: '',
		end_date: '',
		registration_deadline: '',
		max_participants: '',
		prize_info: '',
		rules: ''
	};

	const tournamentTypes = [
		{ id: 'single_elimination', label: 'Single Elimination', description: 'Lose once, you\'re out' },
		{ id: 'double_elimination', label: 'Double Elimination', description: 'Two losses to be eliminated' },
		{ id: 'round_robin', label: 'Round Robin', description: 'Everyone plays everyone' },
		{ id: 'swiss', label: 'Swiss', description: 'Fair matching based on performance' },
		{ id: 'group_stage', label: 'Group Stage', description: 'Groups then playoffs' },
		{ id: 'custom', label: 'Custom', description: 'Flexible format' }
	];

	const participantTypes = [
		{ id: 'individual', label: 'Individual Players' },
		{ id: 'team', label: 'Teams' },
		{ id: 'mixed', label: 'Mixed (Players & Teams)' }
	];

	function resetForm() {
		formData = {
			name: '',
			description: '',
			tournament_type: 'single_elimination',
			game_template_id: null,
			participant_type: 'individual',
			start_date: '',
			end_date: '',
			registration_deadline: '',
			max_participants: '',
			prize_info: '',
			rules: ''
		};
		step = 1;
	}

	function openModal() {
		if (!isGameManager) {
			showToast('Only Game Managers can create tournaments', 'warning');
			return;
		}
		isOpen = true;
		resetForm();
	}

	function closeModal() {
		isOpen = false;
		resetForm();
	}

	function nextStep() {
		if (step === 1) {
			if (!formData.name.trim()) {
				showToast('Tournament name is required', 'error');
				return;
			}
			if (!formData.tournament_type) {
				showToast('Tournament type is required', 'error');
				return;
			}
		}
		if (step < 3) step++;
	}

	function prevStep() {
		if (step > 1) step--;
	}

	async function handleSubmit() {
		if (!formData.start_date || !formData.end_date) {
			showToast('Start and end dates are required', 'error');
			return;
		}

		if (new Date(formData.start_date) >= new Date(formData.end_date)) {
			showToast('Start date must be before end date', 'error');
			return;
		}

		if (formData.registration_deadline && new Date(formData.registration_deadline) > new Date(formData.start_date)) {
			showToast('Registration deadline must be before tournament start', 'error');
			return;
		}

		isSubmitting = true;
		try {
			const tournamentData = {
				name: formData.name.trim(),
				description: formData.description.trim() || null,
				tournament_type: formData.tournament_type,
				game_template_id: formData.game_template_id,
				participant_type: formData.participant_type,
				start_date: formData.start_date,
				end_date: formData.end_date,
				registration_deadline: formData.registration_deadline || null,
				max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
				prize_info: formData.prize_info ? JSON.parse(`{"info": ${JSON.stringify(formData.prize_info)}}`) : null,
				rules: formData.rules.trim() || null
			};

			await createTournament(instanceId, tournamentData);
			showToast('Tournament created successfully', 'success');
			dispatch('tournamentCreated', { tournament: tournamentData });
			closeModal();
		} catch (error) {
			console.error('Error creating tournament:', error);
			showToast(error.message || 'Failed to create tournament', 'error');
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if isGameManager}
	<button
		class="create-tournament-button"
		on:click={openModal}
		title="Create a new tournament"
		aria-label="Create tournament"
	>
		<span class="icon">🏆</span>
		<span class="label">Create Tournament</span>
	</button>
{/if}

{#if isOpen}
	<div class="modal-overlay" on:click={closeModal}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Create Tournament</h3>
				<button class="close-button" on:click={closeModal} aria-label="Close modal">✕</button>
			</div>

			<div class="modal-body">
				<div class="steps">
					<div class="step-indicator">
						<div class="step" class:active={step === 1} class:completed={step > 1}>1</div>
						<div class="step" class:active={step === 2} class:completed={step > 2}>2</div>
						<div class="step" class:active={step === 3}>3</div>
					</div>
					<div class="step-labels">
						<span class:active={step === 1}>Basic Info</span>
						<span class:active={step === 2}>Schedule</span>
						<span class:active={step === 3}>Details</span>
					</div>
				</div>

				{#if step === 1}
					<div class="step-content">
						<h4>Tournament Information</h4>

						<div class="form-group">
							<label for="name">Tournament Name *</label>
							<input
								id="name"
								type="text"
								bind:value={formData.name}
								placeholder="e.g., Summer Championship 2026"
								required
								disabled={isSubmitting}
							/>
						</div>

						<div class="form-group">
							<label for="description">Description</label>
							<textarea
								id="description"
								bind:value={formData.description}
								placeholder="Tell participants about this tournament..."
								rows="3"
								disabled={isSubmitting}
							/>
						</div>

						<div class="form-row">
							<div class="form-group">
								<label for="tournament_type">Tournament Type *</label>
								<select
									id="tournament_type"
									bind:value={formData.tournament_type}
									disabled={isSubmitting}
								>
									{#each tournamentTypes as type}
										<option value={type.id}>{type.label}</option>
									{/each}
								</select>
							</div>

							<div class="form-group">
								<label for="participant_type">Participants *</label>
								<select
									id="participant_type"
									bind:value={formData.participant_type}
									disabled={isSubmitting}
								>
									{#each participantTypes as type}
										<option value={type.id}>{type.label}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="form-group">
							<label for="game_template">Game Template (Optional)</label>
							<select id="game_template" bind:value={formData.game_template_id} disabled={isSubmitting}>
								<option value={null}>No specific game</option>
								{#each gameTemplates as template}
									<option value={template.id}>{template.name}</option>
								{/each}
							</select>
						</div>
					</div>
				{:else if step === 2}
					<div class="step-content">
						<h4>Tournament Schedule</h4>

						<div class="form-row">
							<div class="form-group">
								<label for="registration_deadline">Registration Deadline</label>
								<input
									id="registration_deadline"
									type="datetime-local"
									bind:value={formData.registration_deadline}
									disabled={isSubmitting}
								/>
							</div>
						</div>

						<div class="form-row">
							<div class="form-group">
								<label for="start_date">Start Date *</label>
								<input
									id="start_date"
									type="datetime-local"
									bind:value={formData.start_date}
									required
									disabled={isSubmitting}
								/>
							</div>

							<div class="form-group">
								<label for="end_date">End Date *</label>
								<input
									id="end_date"
									type="datetime-local"
									bind:value={formData.end_date}
									required
									disabled={isSubmitting}
								/>
							</div>
						</div>

						<div class="form-group">
							<label for="max_participants">Max Participants</label>
							<input
								id="max_participants"
								type="number"
								bind:value={formData.max_participants}
								placeholder="Leave empty for unlimited"
								min="2"
								disabled={isSubmitting}
							/>
						</div>
					</div>
				{:else if step === 3}
					<div class="step-content">
						<h4>Additional Details</h4>

						<div class="form-group">
							<label for="prize_info">Prize Information</label>
							<textarea
								id="prize_info"
								bind:value={formData.prize_info}
								placeholder="e.g., 1st: Trophy, 2nd: $50, 3rd: $25"
								rows="3"
								disabled={isSubmitting}
							/>
						</div>

						<div class="form-group">
							<label for="rules">Tournament Rules</label>
							<textarea
								id="rules"
								bind:value={formData.rules}
								placeholder="Special rules or conditions for this tournament..."
								rows="4"
								disabled={isSubmitting}
							/>
						</div>
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button
					class="button secondary"
					on:click={prevStep}
					disabled={step === 1 || isSubmitting}
				>
					Back
				</button>
				<button class="button secondary" on:click={closeModal} disabled={isSubmitting}>
					Cancel
				</button>
				{#if step < 3}
					<button
						class="button primary"
						on:click={nextStep}
						disabled={isSubmitting}
					>
						Next
					</button>
				{:else}
					<button
						class="button primary"
						on:click={handleSubmit}
						disabled={isSubmitting || !formData.name.trim()}
						aria-busy={isSubmitting}
					>
						{isSubmitting ? 'Creating...' : 'Create Tournament'}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.create-tournament-button {
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

	.create-tournament-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.create-tournament-button:disabled {
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

	.steps {
		margin-bottom: 1.5rem;
	}

	.step-indicator {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.step {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #e0e0e0;
		color: #999;
		font-weight: 600;
		font-size: 0.85rem;
		transition: all 0.3s;
	}

	.step.active {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
	}

	.step.completed {
		background: #4CAF50;
		color: white;
	}

	.step-labels {
		display: flex;
		justify-content: space-around;
		font-size: 0.8rem;
		color: #999;
	}

	.step-labels span.active {
		color: #667eea;
		font-weight: 500;
	}

	.step-content {
		animation: fadeIn 0.3s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.step-content h4 {
		margin: 0 0 1rem 0;
		color: #333;
		font-size: 1.1rem;
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

		.label {
			display: none;
		}
	}
</style>
