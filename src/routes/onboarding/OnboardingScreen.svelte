<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { currentUser, updateCurrentUser } from '../../stores/auth.js';
    import { showTopMenu } from '../../stores/ui.js';
    import { getSupabase } from '../../lib/supabase.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import AvatarCreator from '../../components/avatar/AvatarCreator.svelte';
import { INTERESTS } from '../../services/profile.service.js';
    import { generateRandomAvatar } from '../../lib/utils/avatar.js';
    import {
        generateRandomUsername,
        generateUsernameSuggestions,
        validateUsername,
        sanitizeUsernameInput
    } from '../../lib/utils/username.js';

    let step = 1;
    let displayName = $currentUser?.username || $currentUser?.name || '';
    let usernameError = '';
    let avatar = $currentUser?.avatar || generateRandomAvatar();
    let selectedInterests = [];
    let saving = false;
    let error = '';
    let usernameSuggestions = generateUsernameSuggestions(3);

    // Auth routing handled centrally in App.svelte

    onMount(async () => {
        console.log('Onboarding mounted - user:', $currentUser?.name);

        try {
            const supabase = getSupabase();
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('display_name, avatar, interests, username, onboarding_completed')
                .eq('user_id', authUser.id)
                .maybeSingle();

            if (profile) {
                displayName = profile.username || profile.display_name || displayName;
                avatar = profile.avatar || avatar;
                selectedInterests = profile.interests || selectedInterests;

                if (profile.onboarding_completed) {
                    updateCurrentUser({
                        name: profile.username || profile.display_name || displayName,
                        avatar: profile.avatar || avatar,
                        interests: profile.interests || selectedInterests,
                        username: profile.username || displayName,
                        onboardingCompleted: true
                    });
                    showTopMenu.set(true);
                    push('/');
                }
            }
        } catch (err) {
            console.warn('Failed to preload profile:', err);
        }
    });

    function randomizeUsername() {
        displayName = generateRandomUsername();
        usernameError = '';
    }

    function selectSuggestion(suggestion) {
        displayName = suggestion;
        usernameError = '';
    }

    function handleUsernameInput(event) {
        displayName = sanitizeUsernameInput(event.target.value);
        usernameError = '';
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
                error = 'Please enter a username';
                return;
            }

            // Validate username
            if (displayName.trim()) {
                const validation = validateUsername(displayName);
                if (!validation.valid) {
                    usernameError = validation.error;
                    error = 'Please fix the username error';
                    return;
                }
            }

            error = '';
            usernameError = '';
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
            const supabase = getSupabase();

            // Get the authenticated user from Supabase
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError || !authUser) {
                throw new Error('User authentication not found. Please log in again.');
            }

            // Prepare profile data
            const profileData = {
                user_id: authUser.id,
                display_name: displayName,
                avatar: avatar,
                interests: selectedInterests,
                onboarding_completed: true
            };

            // Username required (consolidated)
            profileData.username = displayName.trim().toLowerCase();

            // Upsert profile in database (handles existing users)
            const { data: savedProfile, error: profileError } = await supabase
                .from('user_profiles')
                .upsert(profileData, { onConflict: 'user_id' })
                .select()
                .single();

            if (profileError) {
                throw new Error('Failed to save profile: ' + profileError.message);
            }

            console.log('✅ Profile created:', savedProfile);

            // Update local user state
            updateCurrentUser({
                name: displayName,
                avatar: avatar,
                interests: selectedInterests,
                username: displayName.trim().toLowerCase(),
                onboardingCompleted: true
            });

            console.log('✅ Onboarding complete! Redirecting to lobby...');
            showTopMenu.set(true);
            push('/');
        } catch (err) {
            console.error('❌ Onboarding failed:', err);
            error = err.message || 'Failed to save profile';
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
                <label for="username-input">Choose Your Username</label>
                <div class="username-input-row">
                    <input
                        id="username-input"
                        type="text"
                        bind:value={displayName}
                        on:input={handleUsernameInput}
                        placeholder="friendly_neighbor_4285"
                        maxlength="30"
                        class="username-input"
                        class:error={usernameError}
                    />
                    <button class="btn btn-icon" on:click={randomizeUsername} title="Generate random username">
                        🎲
                    </button>
                </div>
                {#if usernameError}
                    <div class="username-error">{usernameError}</div>
                {/if}
                <div class="username-suggestions">
                    <span class="suggestion-label">Suggestions:</span>
                    {#each usernameSuggestions as suggestion}
                        <button class="suggestion-btn" on:click={() => selectSuggestion(suggestion)}>
                            {suggestion}
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

    .optional-label {
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 400;
    }

    .username-input-row {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .username-input {
        flex: 1;
        text-transform: lowercase;
    }

    .username-input.error {
        border-color: #C62828;
    }

    .username-error {
        font-size: 12px;
        color: #C62828;
        margin-top: 4px;
    }

    .username-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        margin-top: 8px;
    }

    .suggestion-label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
    }

    .suggestion-btn {
        padding: 4px 10px;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        background: white;
        font-size: 11px;
        color: var(--primary);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .suggestion-btn:hover {
        border-color: var(--primary);
        background: rgba(45, 90, 71, 0.05);
    }
</style>
