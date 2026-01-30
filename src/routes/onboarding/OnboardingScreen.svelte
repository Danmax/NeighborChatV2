<script>
    import { push } from 'svelte-spa-router';
    import { currentUser, updateCurrentUser } from '../../stores/auth.js';
    import { showTopMenu } from '../../stores/ui.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import AvatarCreator from '../../components/avatar/AvatarCreator.svelte';
    import { INTERESTS, FUN_NAMES, saveUserProfile } from '../../services/profile.service.js';
    import { generateRandomAvatar } from '../../lib/utils/avatar.js';

    let step = 1;
    let displayName = $currentUser?.name || '';
    let avatar = $currentUser?.avatar || generateRandomAvatar();
    let selectedInterests = [];
    let saving = false;
    let error = '';

    function selectFunName(name) {
        displayName = name;
    }

    function toggleInterest(interestId) {
        if (selectedInterests.includes(interestId)) {
            selectedInterests = selectedInterests.filter(i => i !== interestId);
        } else {
            selectedInterests = [...selectedInterests, interestId];
        }
    }

    function handleAvatarChange(event) {
        avatar = event.detail;
    }

    function nextStep() {
        if (step === 1) {
            if (!displayName.trim()) {
                error = 'Please enter a display name';
                return;
            }
            error = '';
        }
        step++;
    }

    function prevStep() {
        step--;
        error = '';
    }

    async function finishOnboarding() {
        if (selectedInterests.length === 0) {
            error = 'Please select at least one interest';
            return;
        }

        saving = true;
        error = '';

        try {
            await saveUserProfile({
                name: displayName,
                avatar,
                interests: selectedInterests
            });

            showTopMenu.set(true);
            push('/');
        } catch (err) {
            error = err.message;
        } finally {
            saving = false;
        }
    }
</script>

<div class="onboarding-screen">
    <!-- Progress Steps -->
    <div class="onboarding-progress">
        <div class="onboard-step" class:active={step === 1} class:completed={step > 1}>
            {step > 1 ? '✓' : '1'}
        </div>
        <div class="progress-line" class:filled={step > 1}></div>
        <div class="onboard-step" class:active={step === 2} class:completed={step > 2}>
            {step > 2 ? '✓' : '2'}
        </div>
        <div class="progress-line" class:filled={step > 2}></div>
        <div class="onboard-step" class:active={step === 3}>3</div>
    </div>

    <!-- Step 1: Name & Avatar -->
    {#if step === 1}
        <div class="card onboarding-step-content">
            <h2 class="card-title">
                <span class="icon">👋</span>
                Welcome! Let's set up your profile
            </h2>

            <div class="form-group">
                <label>Your Display Name</label>
                <input
                    type="text"
                    bind:value={displayName}
                    placeholder="How should neighbors know you?"
                    maxlength="50"
                />
            </div>

            <div class="form-group">
                <label>Or pick a fun name:</label>
                <div class="fun-names-grid">
                    {#each FUN_NAMES.slice(0, 6) as name}
                        <button
                            class="fun-name-btn"
                            class:selected={displayName === name}
                            on:click={() => selectFunName(name)}
                        >
                            {name}
                        </button>
                    {/each}
                </div>
            </div>

            {#if error}
                <div class="error-message">{error}</div>
            {/if}

            <button class="btn btn-primary btn-full" on:click={nextStep}>
                Continue →
            </button>
        </div>
    {/if}

    <!-- Step 2: Avatar Creator -->
    {#if step === 2}
        <div class="card onboarding-step-content">
            <h2 class="card-title">
                <span class="icon">🎨</span>
                Create Your Avatar
            </h2>

            <AvatarCreator {avatar} on:change={handleAvatarChange} />

            <div class="step-actions">
                <button class="btn btn-secondary" on:click={prevStep}>
                    ← Back
                </button>
                <button class="btn btn-primary" on:click={nextStep}>
                    Continue →
                </button>
            </div>
        </div>
    {/if}

    <!-- Step 3: Interests -->
    {#if step === 3}
        <div class="card onboarding-step-content">
            <h2 class="card-title">
                <span class="icon">💬</span>
                What do you enjoy?
            </h2>

            <p class="step-description">
                Select your interests to help find neighbors with similar hobbies
            </p>

            <div class="interests-container">
                {#each INTERESTS as interest}
                    <button
                        class="interest-tag"
                        class:selected={selectedInterests.includes(interest.id)}
                        on:click={() => toggleInterest(interest.id)}
                    >
                        <span class="emoji">{interest.emoji}</span>
                        {interest.label}
                    </button>
                {/each}
            </div>

            <div class="selected-count">
                {selectedInterests.length} selected
            </div>

            {#if error}
                <div class="error-message">{error}</div>
            {/if}

            <div class="step-actions">
                <button class="btn btn-secondary" on:click={prevStep}>
                    ← Back
                </button>
                <button
                    class="btn btn-primary"
                    on:click={finishOnboarding}
                    disabled={saving}
                >
                    {#if saving}
                        Saving...
                    {:else}
                        Start Chatting! 🎉
                    {/if}
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .onboarding-screen {
        padding: 20px 0;
    }

    .onboarding-progress {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 24px;
    }

    .onboard-step {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--cream-dark);
        color: var(--text-light);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 14px;
        transition: all 0.3s ease;
    }

    .onboard-step.active {
        background: var(--primary);
        color: white;
        transform: scale(1.1);
    }

    .onboard-step.completed {
        background: #4ADE80;
        color: white;
    }

    .progress-line {
        width: 40px;
        height: 3px;
        background: var(--cream-dark);
        border-radius: 2px;
        transition: background 0.3s ease;
    }

    .progress-line.filled {
        background: #4ADE80;
    }

    .onboarding-step-content {
        animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .fun-names-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }

    .fun-name-btn {
        padding: 10px 12px;
        border: 2px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        background: white;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
    }

    .fun-name-btn:hover {
        border-color: var(--primary-light);
        background: var(--cream);
    }

    .fun-name-btn.selected {
        border-color: var(--primary);
        background: rgba(45, 90, 71, 0.1);
    }

    .step-description {
        color: var(--text-light);
        font-size: 14px;
        margin-bottom: 16px;
    }

    .interests-container {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 16px;
    }

    .selected-count {
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
        margin-bottom: 16px;
    }

    .error-message {
        background: #FFEBEE;
        color: #C62828;
        padding: 12px 16px;
        border-radius: var(--radius-sm);
        font-size: 14px;
        margin-bottom: 16px;
    }

    .step-actions {
        display: flex;
        gap: 12px;
        margin-top: 20px;
    }

    .step-actions .btn {
        flex: 1;
    }
</style>
