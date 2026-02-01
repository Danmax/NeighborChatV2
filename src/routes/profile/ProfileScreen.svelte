<script>
    import { authInitialized } from '../../stores/ui.js';
    import { push } from 'svelte-spa-router';
    import { currentUser, isAuthenticated, signOut } from '../../stores/auth.js';
    import { currentTheme, setTheme, THEMES } from '../../stores/theme.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import AvatarCreator from '../../components/avatar/AvatarCreator.svelte';
    import {
        INTERESTS,
        updateAvatar,
        updateInterests,
        updateDisplayName,
        updateUsername,
        updateProfileDetails,
        updateBio,
        updateBanner,
        updatePrivacySettings,
        BANNER_COLORS,
        BANNER_PATTERNS
    } from '../../services/profile.service.js';
    import { formatPhoneNumber } from '../../lib/utils/phone.js';
    import ProfilePrivacySettings from '../../components/profile/ProfilePrivacySettings.svelte';

    // Redirect if not authenticated
    $: if ($authInitialized && !$isAuthenticated) {
        console.log('🔐 ProfileScreen: Not authenticated, redirecting to /auth');
        push('/auth');
    }

    let activeTab = 'info';
    let editingAvatar = false;
    let editingName = false;
    let editingUsername = false;
    let editingDetails = false;
    let tempName = '';
    let tempUsername = '';
    let tempAvatar = null;
    let saving = false;
    let message = '';
    let usernameError = '';

    // Profile details fields
    let tempBirthday = '';
    let tempTitle = '';
    let tempPhone = '';
    let displayPhone = ''; // For formatted display
    let tempCity = '';
    let tempMagicEmail = '';

    // Privacy tab fields
    let editingBio = false;
    let tempBio = '';
    let editingBanner = false;
    let tempBannerColor = '';
    let tempBannerPattern = '';
    let privacySettings = {
        show_city: true,
        show_phone: false,
        show_email: false,
        show_birthday: false,
        show_interests: true
    };

    $: userInterests = $currentUser?.interests || [];

    function setTab(tab) {
        activeTab = tab;
        editingAvatar = false;
        editingName = false;
        editingUsername = false;
        editingBio = false;
        editingBanner = false;
        message = '';
        usernameError = '';
    }

    function startEditName() {
        tempName = $currentUser?.name || '';
        editingName = true;
    }

    async function saveName() {
        if (!tempName.trim()) return;

        saving = true;
        try {
            await updateDisplayName(tempName);
            editingName = false;
            message = 'Name updated!';
            setTimeout(() => message = '', 2000);
        } catch (err) {
            message = 'Failed to save: ' + err.message;
        } finally {
            saving = false;
        }
    }

    function startEditUsername() {
        tempUsername = $currentUser?.username || '';
        usernameError = '';
        editingUsername = true;
    }

    async function saveUsername() {
        if (!tempUsername.trim()) {
            usernameError = 'Username cannot be empty';
            return;
        }

        saving = true;
        usernameError = '';
        try {
            await updateUsername(tempUsername);
            editingUsername = false;
            message = 'Username updated!';
            setTimeout(() => message = '', 2000);
        } catch (err) {
            usernameError = err.message;
            message = '';
        } finally {
            saving = false;
        }
    }

    function startEditAvatar() {
        tempAvatar = { ...$currentUser?.avatar };
        editingAvatar = true;
    }

    function handleAvatarChange(event) {
        tempAvatar = event.detail;
    }

    async function saveAvatar() {
        saving = true;
        try {
            await updateAvatar(tempAvatar);
            editingAvatar = false;
            message = 'Avatar updated!';
            setTimeout(() => message = '', 2000);
        } catch (err) {
            message = 'Failed to save: ' + err.message;
        } finally {
            saving = false;
        }
    }

    async function toggleInterest(interestId) {
        let newInterests;
        if (userInterests.includes(interestId)) {
            newInterests = userInterests.filter(i => i !== interestId);
        } else {
            newInterests = [...userInterests, interestId];
        }

        try {
            await updateInterests(newInterests);
        } catch (err) {
            console.error('Failed to update interests:', err);
        }
    }

    function startEditDetails() {
        tempBirthday = $currentUser?.birthday || '';
        tempTitle = $currentUser?.title || '';
        // Format phone for display when editing
        tempPhone = $currentUser?.phone || '';
        displayPhone = tempPhone ? formatPhoneNumber(tempPhone) : '';
        tempCity = $currentUser?.city || '';
        tempMagicEmail = $currentUser?.magic_email || '';
        editingDetails = true;
    }

    function handlePhoneBlur() {
        // Format phone number on blur
        if (displayPhone) {
            displayPhone = formatPhoneNumber(displayPhone);
        }
    }

    async function saveDetails() {
        saving = true;
        try {
            await updateProfileDetails({
                birthday: tempBirthday,
                title: tempTitle,
                phone: displayPhone, // Pass formatted phone (will be normalized in service)
                city: tempCity,
                magic_email: tempMagicEmail
            });
            editingDetails = false;
            message = 'Profile details updated!';
            setTimeout(() => message = '', 2000);
        } catch (err) {
            message = 'Failed to save: ' + err.message;
        } finally {
            saving = false;
        }
    }

    function cancelEditDetails() {
        editingDetails = false;
    }

    async function handleSignOut() {
        if (confirm('Are you sure you want to sign out?')) {
            try {
                const { signOut: authSignOut } = await import('../../services/auth.service.js');
                await authSignOut();
                push('/auth');
            } catch (err) {
                console.error('Sign out failed:', err);
            }
        }
    }

    // Privacy tab functions
    function startEditBio() {
        tempBio = $currentUser?.bio || '';
        editingBio = true;
    }

    async function saveBio() {
        saving = true;
        try {
            await updateBio(tempBio);
            editingBio = false;
            message = 'Bio updated!';
            setTimeout(() => message = '', 2000);
        } catch (err) {
            message = 'Failed to save bio: ' + err.message;
        } finally {
            saving = false;
        }
    }

    function startEditBanner() {
        tempBannerColor = $currentUser?.banner_color || '#4CAF50';
        tempBannerPattern = $currentUser?.banner_pattern || 'solid';
        editingBanner = true;
    }

    async function saveBanner() {
        saving = true;
        try {
            await updateBanner(tempBannerColor, tempBannerPattern);
            editingBanner = false;
            message = 'Banner updated!';
            setTimeout(() => message = '', 2000);
        } catch (err) {
            message = 'Failed to save banner: ' + err.message;
        } finally {
            saving = false;
        }
    }

    async function handlePrivacyChange(event) {
        const settings = event.detail;
        saving = true;
        try {
            await updatePrivacySettings(settings);
            message = 'Privacy settings updated!';
            setTimeout(() => message = '', 2000);
        } catch (err) {
            message = 'Failed to save privacy settings: ' + err.message;
        } finally {
            saving = false;
        }
    }
</script>

{#if $isAuthenticated}
    <div class="profile-screen">
        <div class="screen-header">
            <button class="back-btn" on:click={() => push('/')}>← Back</button>
            <h2 class="card-title">
                <span class="icon">👤</span>
                My Profile
            </h2>
        </div>

        <!-- Tabs -->
        <div class="tabs">
            <button
                class="tab"
                class:active={activeTab === 'info'}
                on:click={() => setTab('info')}
            >
                Info
            </button>
            <button
                class="tab"
                class:active={activeTab === 'avatar'}
                on:click={() => setTab('avatar')}
            >
                Avatar
            </button>
            <button
                class="tab"
                class:active={activeTab === 'privacy'}
                on:click={() => setTab('privacy')}
            >
                Privacy
            </button>
            <button
                class="tab"
                class:active={activeTab === 'settings'}
                on:click={() => setTab('settings')}
            >
                Settings
            </button>
        </div>

        {#if message}
            <div class="message-banner">{message}</div>
        {/if}

        <!-- Info Tab -->
        {#if activeTab === 'info'}
            <div class="card">
                <div class="profile-header">
                    <Avatar avatar={$currentUser?.avatar} size="lg" />
                    <div class="profile-header-info">
                        {#if editingName}
                            <div class="edit-name-row">
                                <input
                                    type="text"
                                    bind:value={tempName}
                                    placeholder="Display name"
                                    maxlength="50"
                                />
                                <button class="btn btn-small btn-primary" on:click={saveName} disabled={saving}>
                                    {saving ? '...' : '✓'}
                                </button>
                                <button class="btn btn-small btn-secondary" on:click={() => editingName = false}>
                                    ✕
                                </button>
                            </div>
                        {:else}
                            <h3>{$currentUser?.name || 'Guest'}</h3>
                            <button class="edit-btn" on:click={startEditName}>✏️ Edit</button>
                        {/if}

                        {#if editingUsername}
                            <div class="edit-username-row">
                                <input
                                    type="text"
                                    bind:value={tempUsername}
                                    placeholder="username"
                                    maxlength="30"
                                    class="username-input"
                                    class:error={usernameError}
                                />
                                <button class="btn btn-small btn-primary" on:click={saveUsername} disabled={saving}>
                                    {saving ? '...' : '✓'}
                                </button>
                                <button class="btn btn-small btn-secondary" on:click={() => editingUsername = false}>
                                    ✕
                                </button>
                            </div>
                            {#if usernameError}
                                <p class="username-error">{usernameError}</p>
                            {/if}
                        {:else}
                            <p class="profile-username">
                                @{$currentUser?.username || 'not_set'}
                                <button class="edit-btn" on:click={startEditUsername}>✏️ Edit</button>
                            </p>
                        {/if}

                        <p class="profile-email">
                            {$currentUser?.email || ''}
                        </p>
                    </div>
                </div>

                <div class="form-group">
                    <label>My Interests</label>
                    <div class="interests-container">
                        {#each INTERESTS as interest}
                            <button
                                class="interest-tag"
                                class:selected={userInterests.includes(interest.id)}
                                on:click={() => toggleInterest(interest.id)}
                            >
                                <span class="emoji">{interest.emoji}</span>
                                {interest.label}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Personal Details Card -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <span class="icon">📋</span>
                        Personal Details
                    </h3>
                    {#if !editingDetails}
                        <button class="edit-btn" on:click={startEditDetails}>✏️ Edit</button>
                    {/if}
                </div>

                {#if editingDetails}
                    <div class="details-form">
                        <div class="form-group">
                            <label for="birthday">Birthday</label>
                            <input
                                type="date"
                                id="birthday"
                                bind:value={tempBirthday}
                            />
                        </div>

                        <div class="form-group">
                            <label for="title">Title / Profession</label>
                            <input
                                type="text"
                                id="title"
                                bind:value={tempTitle}
                                placeholder="e.g. Software Engineer, Teacher"
                                maxlength="100"
                            />
                        </div>

                        <div class="form-group">
                            <label for="phone">Phone Number</label>
                            <input
                                type="tel"
                                id="phone"
                                bind:value={displayPhone}
                                on:blur={handlePhoneBlur}
                                placeholder="e.g. 5551234567 or +1 555-123-4567"
                                maxlength="20"
                            />
                            <span class="field-hint">Type 10 digits for US format (auto-formatted)</span>
                        </div>

                        <div class="form-group">
                            <label for="city">City</label>
                            <input
                                type="text"
                                id="city"
                                bind:value={tempCity}
                                placeholder="e.g. San Francisco, CA"
                                maxlength="100"
                            />
                        </div>

                        <div class="form-group">
                            <label for="magic_email">Magic Email</label>
                            <input
                                type="email"
                                id="magic_email"
                                bind:value={tempMagicEmail}
                                placeholder="alternate@email.com"
                                maxlength="255"
                            />
                            <span class="field-hint">An alternate email for magic link sign-in</span>
                        </div>

                        <div class="form-actions">
                            <button class="btn btn-secondary" on:click={cancelEditDetails}>
                                Cancel
                            </button>
                            <button class="btn btn-primary" on:click={saveDetails} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Details'}
                            </button>
                        </div>
                    </div>
                {:else}
                    <div class="details-display">
                        <div class="detail-row">
                            <span class="detail-label">🎂 Birthday</span>
                            <span class="detail-value">{$currentUser?.birthday || 'Not set'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">💼 Title</span>
                            <span class="detail-value">{$currentUser?.title || 'Not set'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">📱 Phone</span>
                            <span class="detail-value">
                                {$currentUser?.phone ? formatPhoneNumber($currentUser.phone) : 'Not set'}
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">🏙️ City</span>
                            <span class="detail-value">{$currentUser?.city || 'Not set'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">✉️ Magic Email</span>
                            <span class="detail-value">{$currentUser?.magic_email || 'Not set'}</span>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Avatar Tab -->
        {#if activeTab === 'avatar'}
            <div class="card">
                {#if editingAvatar}
                    <AvatarCreator
                        avatar={tempAvatar}
                        on:change={handleAvatarChange}
                    />
                    <div class="avatar-actions">
                        <button class="btn btn-secondary" on:click={() => editingAvatar = false}>
                            Cancel
                        </button>
                        <button class="btn btn-primary" on:click={saveAvatar} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Avatar'}
                        </button>
                    </div>
                {:else}
                    <div class="current-avatar">
                        <Avatar avatar={$currentUser?.avatar} size="xl" />
                        <h3>{$currentUser?.name}</h3>
                        <button class="btn btn-primary" on:click={startEditAvatar}>
                            ✏️ Customize Avatar
                        </button>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Privacy Tab -->
        {#if activeTab === 'privacy'}
            <!-- Bio Section -->
            <div class="card">
                <h3 class="card-title">
                    <span class="icon">📝</span>
                    Bio
                </h3>

                {#if editingBio}
                    <div class="bio-edit">
                        <textarea
                            bind:value={tempBio}
                            placeholder="Tell others about yourself... (max 200 characters)"
                            maxlength="200"
                            rows="4"
                        ></textarea>
                        <div class="char-counter">
                            {tempBio.length}/200
                        </div>
                        <div class="edit-actions">
                            <button class="btn btn-secondary" on:click={() => editingBio = false}>
                                Cancel
                            </button>
                            <button class="btn btn-primary" on:click={saveBio} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Bio'}
                            </button>
                        </div>
                    </div>
                {:else}
                    <div class="bio-display">
                        {#if $currentUser?.bio}
                            <p class="bio-text">{$currentUser.bio}</p>
                        {:else}
                            <p class="bio-empty">No bio yet. Add one to tell others about yourself!</p>
                        {/if}
                        <button class="btn btn-secondary btn-full" on:click={startEditBio}>
                            ✏️ {$currentUser?.bio ? 'Edit Bio' : 'Add Bio'}
                        </button>
                    </div>
                {/if}
            </div>

            <!-- Banner Customization -->
            <div class="card">
                <h3 class="card-title">
                    <span class="icon">🎨</span>
                    Profile Banner
                </h3>

                {#if editingBanner}
                    <div class="banner-edit">
                        <div class="banner-preview" style="background-color: {tempBannerColor}; height: 120px; border-radius: var(--radius-sm); margin-bottom: 16px;"></div>

                        <div class="form-group">
                            <label>Banner Color</label>
                            <div class="color-picker">
                                {#each BANNER_COLORS as color}
                                    <button
                                        class="color-btn"
                                        class:selected={tempBannerColor === color}
                                        style="background-color: {color};"
                                        on:click={() => tempBannerColor = color}
                                        type="button"
                                    ></button>
                                {/each}
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Pattern</label>
                            <div class="pattern-picker">
                                {#each BANNER_PATTERNS as pattern}
                                    <button
                                        class="pattern-btn"
                                        class:selected={tempBannerPattern === pattern.id}
                                        on:click={() => tempBannerPattern = pattern.id}
                                        type="button"
                                    >
                                        <span class="pattern-preview">{pattern.preview}</span>
                                        <span class="pattern-label">{pattern.label}</span>
                                    </button>
                                {/each}
                            </div>
                        </div>

                        <div class="edit-actions">
                            <button class="btn btn-secondary" on:click={() => editingBanner = false}>
                                Cancel
                            </button>
                            <button class="btn btn-primary" on:click={saveBanner} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Banner'}
                            </button>
                        </div>
                    </div>
                {:else}
                    <div class="banner-display">
                        <div
                            class="banner-preview"
                            style="background-color: {$currentUser?.banner_color || '#4CAF50'}; height: 120px; border-radius: var(--radius-sm); margin-bottom: 12px;"
                        ></div>
                        <button class="btn btn-secondary btn-full" on:click={startEditBanner}>
                            🎨 Customize Banner
                        </button>
                    </div>
                {/if}
            </div>

            <!-- Privacy Settings -->
            <div class="card">
                <ProfilePrivacySettings
                    settings={privacySettings}
                    on:change={handlePrivacyChange}
                />
            </div>
        {/if}

        <!-- Settings Tab -->
        {#if activeTab === 'settings'}
            <div class="card">
                <h3 class="card-title">
                    <span class="icon">🎨</span>
                    Theme
                </h3>
                <div class="theme-selector">
                    {#each THEMES as theme}
                        <button
                            class="theme-btn"
                            class:selected={$currentTheme === theme.id}
                            on:click={() => setTheme(theme.id)}
                        >
                            <div
                                class="theme-preview"
                                style="background: {theme.color};"
                            ></div>
                            {theme.name}
                        </button>
                    {/each}
                </div>
            </div>

            <div class="card">
                <h3 class="card-title">
                    <span class="icon">🚪</span>
                    Account
                </h3>
                <button class="btn btn-danger btn-full" on:click={handleSignOut}>
                    Sign Out
                </button>
            </div>
        {/if}
    </div>
{/if}

<style>
    .profile-screen {
        padding-bottom: 20px;
    }

    .screen-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
    }

    .screen-header .card-title {
        margin: 0;
    }

    .back-btn {
        background: none;
        border: none;
        color: var(--primary);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        padding: 8px 0;
    }

    .message-banner {
        background: #E8F5E9;
        color: #2E7D32;
        padding: 12px 16px;
        border-radius: var(--radius-sm);
        margin-bottom: 16px;
        text-align: center;
        font-size: 14px;
    }

    .profile-header {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 24px;
    }

    .profile-header-info h3 {
        color: var(--text);
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .profile-email {
        color: var(--text-muted);
        font-size: 13px;
    }

    .profile-username {
        color: var(--text-muted);
        font-size: 12px;
        margin: 4px 0 0 0;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .edit-btn {
        background: none;
        border: none;
        color: var(--primary);
        font-size: 12px;
        cursor: pointer;
        padding: 0;
    }

    .edit-name-row {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .edit-name-row input {
        flex: 1;
        padding: 8px 12px;
        font-size: 14px;
    }

    .edit-username-row {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 6px;
    }

    .edit-username-row input {
        flex: 1;
        padding: 6px 10px;
        font-size: 12px;
        text-transform: lowercase;
    }

    .username-input.error {
        border-color: #C62828;
    }

    .username-error {
        font-size: 11px;
        color: #C62828;
        margin: 2px 0 0 0;
    }

    .current-avatar {
        text-align: center;
        padding: 20px;
    }

    .current-avatar h3 {
        margin: 16px 0;
        color: var(--text);
    }

    .avatar-actions {
        display: flex;
        gap: 12px;
        margin-top: 20px;
    }

    .avatar-actions .btn {
        flex: 1;
    }

    .theme-selector {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
    }

    .theme-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 8px;
        border: 2px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 12px;
        color: var(--text);
    }

    .theme-btn:hover {
        border-color: var(--primary-light);
    }

    .theme-btn.selected {
        border-color: var(--primary);
        background: rgba(45, 90, 71, 0.1);
    }

    .theme-preview {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    /* Personal Details Styles */
    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .card-header .card-title {
        margin: 0;
    }

    .details-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .details-form .form-group {
        margin-bottom: 0;
    }

    .details-form input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid var(--border, #E0E0E0);
        border-radius: var(--radius-sm, 8px);
        font-size: 14px;
        transition: border-color 0.2s ease;
    }

    .details-form input:focus {
        outline: none;
        border-color: var(--primary);
    }

    .field-hint {
        display: block;
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 4px;
    }

    .form-actions {
        display: flex;
        gap: 12px;
        margin-top: 8px;
    }

    .form-actions .btn {
        flex: 1;
    }

    .details-display {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid var(--cream-dark, #E8E8E0);
    }

    .detail-row:last-child {
        border-bottom: none;
    }

    .detail-label {
        font-size: 14px;
        color: var(--text-muted);
    }

    .detail-value {
        font-size: 14px;
        color: var(--text);
        font-weight: 500;
    }

    /* Privacy Tab Styles */
    .bio-edit textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
        resize: vertical;
        min-height: 100px;
    }

    .char-counter {
        text-align: right;
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 6px;
        margin-bottom: 12px;
    }

    .bio-display {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .bio-text {
        padding: 16px;
        background: var(--cream);
        border-radius: var(--radius-sm);
        font-size: 14px;
        line-height: 1.6;
        color: var(--text);
        margin: 0;
    }

    .bio-empty {
        padding: 16px;
        background: var(--cream);
        border-radius: var(--radius-sm);
        font-size: 14px;
        color: var(--text-muted);
        font-style: italic;
        margin: 0;
        text-align: center;
    }

    .banner-edit,
    .banner-display {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .banner-preview {
        width: 100%;
        border: 2px solid var(--cream-dark);
    }

    .color-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .color-btn {
        width: 44px;
        height: 44px;
        border: 3px solid transparent;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .color-btn:hover {
        transform: scale(1.1);
    }

    .color-btn.selected {
        border-color: var(--primary);
        box-shadow: 0 0 0 2px white, 0 0 0 4px var(--primary);
    }

    .pattern-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .pattern-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        border: 2px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .pattern-btn:hover {
        border-color: var(--primary-light);
        background: var(--cream);
    }

    .pattern-btn.selected {
        border-color: var(--primary);
        background: rgba(45, 90, 71, 0.05);
    }

    .pattern-preview {
        font-size: 20px;
    }

    .pattern-label {
        font-size: 11px;
        color: var(--text-muted);
        font-weight: 600;
    }

    .edit-actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
    }

    .edit-actions .btn {
        flex: 1;
    }
</style>
