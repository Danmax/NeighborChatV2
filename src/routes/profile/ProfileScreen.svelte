<script>
    import { push } from 'svelte-spa-router';
    import { currentUser, isAuthenticated, signOut } from '../../stores/auth.js';
    import { currentTheme, setTheme, THEMES } from '../../stores/theme.js';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import AvatarCreator from '../../components/avatar/AvatarCreator.svelte';
    import {
        updateAvatar,
        updateInterests,
        updateUsername,
        updateProfileDetails,
        updateBio,
        updateBanner,
        uploadBannerImage,
        addFavoriteMovie,
        removeFavoriteMovie,
        fetchFavoriteMovies,
        updatePrivacySettings,
        BANNER_COLORS,
        BANNER_PATTERNS
    } from '../../services/profile.service.js';
    import { interestOptions } from '../../stores/options.js';
    import { formatPhoneNumber } from '../../lib/utils/phone.js';
    import ProfilePrivacySettings from '../../components/profile/ProfilePrivacySettings.svelte';
    import { submitEventManagerRequest } from '../../services/admin.service.js';
    import { toDateInputUtc } from '../../lib/utils/date.js';
    import { getClerkToken } from '../../lib/clerk.js';

    let activeTab = 'info';
    let editingAvatar = false;
    let editingUsername = false;
    let editingDetails = false;
    let tempUsername = '';
    let tempAvatar = null;
    let saving = false;
    let message = '';
    let usernameError = '';
    let showProfilePreview = false;

    // Profile details fields
    let tempBirthday = '';
    let tempTimezone = '';
    let tempTitle = '';
    let tempPhone = '';
    let displayPhone = ''; // For formatted display
    let tempCity = '';
    let tempMagicEmail = '';
    let tempSpotifyTrackUrl = '';

    // Common timezone options
    const TIMEZONE_OPTIONS = [
        { value: '', label: 'Select timezone...' },
        { value: 'America/New_York', label: 'Eastern Time (ET)' },
        { value: 'America/Chicago', label: 'Central Time (CT)' },
        { value: 'America/Denver', label: 'Mountain Time (MT)' },
        { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
        { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
        { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
        { value: 'Europe/London', label: 'London (GMT/BST)' },
        { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
        { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
        { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
        { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
        { value: 'Asia/Kolkata', label: 'India (IST)' },
        { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
        { value: 'UTC', label: 'UTC' }
    ];
    let requestingAccess = false;
    let favoriteMovies = [];
    let movieQuery = '';
    let movieResults = [];
    let searchingMovies = false;
    let movieError = '';
    let spotifyQuery = '';
    let spotifyResults = [];
    let searchingSpotify = false;
    let spotifyError = '';
    let spotifyEmbedPreviewTrackId = null;

    // Privacy tab fields
    let editingBio = false;
    let tempBio = '';
    let editingBanner = false;
    let tempBannerColor = '';
    let tempBannerPattern = '';
    let tempBannerImageUrl = '';
    let bannerImageFile = null;
    let bannerImagePreview = '';
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
        editingUsername = false;
        editingBio = false;
        editingBanner = false;
        message = '';
        usernameError = '';
    }

    function startEditUsername() {
        tempUsername = $currentUser?.username || $currentUser?.name || '';
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
        tempBirthday = toDateInputUtc($currentUser?.birthday) || '';
        tempTimezone = $currentUser?.timezone || '';
        tempTitle = $currentUser?.title || '';
        // Format phone for display when editing
        tempPhone = $currentUser?.phone || '';
        displayPhone = tempPhone ? formatPhoneNumber(tempPhone) : '';
        tempCity = $currentUser?.city || '';
        tempMagicEmail = $currentUser?.magic_email || '';
        tempSpotifyTrackUrl = $currentUser?.spotify_track_url || '';
        editingDetails = true;
    }

    function handlePhoneBlur() {
        // Format phone number on blur
        if (displayPhone) {
            displayPhone = formatPhoneNumber(displayPhone);
        }
    }

    function isValidSpotifyTrackUrl(url) {
        if (!url) return true;
        const trimmed = String(url).trim();
        return /spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+/.test(trimmed)
            || /spotify:(track|album|playlist):[a-zA-Z0-9]+/.test(trimmed);
    }

    async function saveDetails() {
        saving = true;
        if (tempSpotifyTrackUrl && !isValidSpotifyTrackUrl(tempSpotifyTrackUrl)) {
            message = 'Please enter a valid Spotify track, album, or playlist URL.';
            saving = false;
            return;
        }
        try {
            await updateProfileDetails({
                birthday: tempBirthday,
                timezone: tempTimezone,
                title: tempTitle,
                phone: displayPhone, // Pass formatted phone (will be normalized in service)
                city: tempCity,
                magic_email: tempMagicEmail,
                spotify_track_url: tempSpotifyTrackUrl
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

    async function requestEventManagerAccess() {
        if (requestingAccess) return;
        requestingAccess = true;
        try {
            await submitEventManagerRequest('Requesting access to manage events.');
            message = 'Request sent for Event Manager access.';
            setTimeout(() => message = '', 2500);
        } catch (err) {
            message = 'Failed to request access: ' + err.message;
        } finally {
            requestingAccess = false;
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
        tempBannerImageUrl = $currentUser?.banner_image_url || '';
        bannerImagePreview = $currentUser?.banner_image_url || '';
        bannerImageFile = null;
        editingBanner = true;
    }

    async function saveBanner() {
        saving = true;
        try {
            let bannerUrl = tempBannerImageUrl || null;
            if (bannerImageFile) {
                bannerUrl = await uploadBannerImage(bannerImageFile);
            }
            await updateBanner(tempBannerColor, tempBannerPattern, bannerUrl);
            editingBanner = false;
            message = 'Banner updated!';
            setTimeout(() => message = '', 2000);
        } catch (err) {
            message = 'Failed to save banner: ' + err.message;
        } finally {
            saving = false;
        }
    }

    function clearBannerImage() {
        bannerImageFile = null;
        bannerImagePreview = '';
        tempBannerImageUrl = '';
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

    async function loadFavorites() {
        try {
            if ($currentUser?.user_id) {
                favoriteMovies = await fetchFavoriteMovies($currentUser.user_uuid || $currentUser.user_id);
            }
        } catch (err) {
            movieError = 'Failed to load favorites.';
        }
    }

    async function searchMovies() {
        if (!movieQuery.trim()) return;
        searchingMovies = true;
        movieError = '';
        try {
            const accessToken = await getClerkToken();
            const res = await fetch(`/api/movie-search?q=${encodeURIComponent(movieQuery.trim())}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Search failed');
            }
            movieResults = data.results || [];
        } catch (err) {
            movieError = err.message || 'Search failed';
        } finally {
            searchingMovies = false;
        }
    }

    async function searchSpotifyTracks() {
        if (!spotifyQuery.trim()) return;
        searchingSpotify = true;
        spotifyError = '';
        try {
            const accessToken = await getClerkToken();
            const res = await fetch(`/api/spotify-search?q=${encodeURIComponent(spotifyQuery.trim())}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Search failed');
            }
            spotifyResults = data.results || [];
            spotifyEmbedPreviewTrackId = null;
        } catch (err) {
            spotifyError = err.message || 'Search failed';
        } finally {
            searchingSpotify = false;
        }
    }

    function handleSpotifyPreviewPlay(event) {
        const currentAudio = event.currentTarget;
        const resultsContainer = currentAudio?.closest('.spotify-results');
        if (!resultsContainer) return;
        resultsContainer.querySelectorAll('audio').forEach(audio => {
            if (audio !== currentAudio) {
                audio.pause();
            }
        });
    }

    function toggleSpotifyEmbedPreview(trackId) {
        spotifyEmbedPreviewTrackId = spotifyEmbedPreviewTrackId === trackId ? null : trackId;
    }

    function getSpotifyTrackEmbedUrl(track) {
        if (track?.id) {
            return `https://open.spotify.com/embed/track/${track.id}`;
        }
        const uriMatch = (track?.uri || '').match(/^spotify:track:([a-zA-Z0-9]+)$/);
        if (uriMatch) {
            return `https://open.spotify.com/embed/track/${uriMatch[1]}`;
        }
        const webMatch = (track?.url || '').match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
        if (webMatch) {
            return `https://open.spotify.com/embed/track/${webMatch[1]}`;
        }
        return null;
    }

    function handleSelectSpotifyTrack(track) {
        tempSpotifyTrackUrl = track?.url || track?.uri || '';
        spotifyResults = [];
        spotifyQuery = '';
        spotifyError = '';
        spotifyEmbedPreviewTrackId = null;
    }

    async function saveSpotifyPreference() {
        saving = true;
        message = '';
        try {
            if (tempSpotifyTrackUrl && !isValidSpotifyTrackUrl(tempSpotifyTrackUrl)) {
                message = 'Please enter a valid Spotify track, album, or playlist URL.';
                saving = false;
                return;
            }
            await updateProfileDetails({
                spotify_track_url: tempSpotifyTrackUrl
            });
            message = 'Music preference saved!';
            setTimeout(() => message = '', 3000);
        } catch (err) {
            message = err.message || 'Failed to save music preference';
        } finally {
            saving = false;
        }
    }

    async function handleAddFavorite(movie) {
        try {
            const saved = await addFavoriteMovie(movie);
            favoriteMovies = [saved, ...favoriteMovies];
        } catch (err) {
            movieError = err.message || 'Failed to save favorite';
        }
    }

    async function handleRemoveFavorite(movieId) {
        try {
            await removeFavoriteMovie(movieId);
            favoriteMovies = favoriteMovies.filter(m => m.movie_id !== movieId);
        } catch (err) {
            movieError = err.message || 'Failed to remove favorite';
        }
    }

    $: favoriteMovieIds = new Set(favoriteMovies.map(m => m.movie_id));

    let favoritesLoadedFor = null;
    $: if ($currentUser?.user_id && favoritesLoadedFor !== ($currentUser.user_uuid || $currentUser.user_id)) {
        favoritesLoadedFor = $currentUser.user_uuid || $currentUser.user_id;
        loadFavorites();
    }

    function getBannerStyle(color, pattern, imageUrl) {
        let style = imageUrl
            ? `background-image: url('${imageUrl}'); background-size: cover; background-position: center;`
            : `background-color: ${color || '#4CAF50'};`;

        if (!imageUrl) {
            if (pattern === 'dots') {
                style += ' background-image: radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px); background-size: 20px 20px;';
            } else if (pattern === 'stripes') {
                style += ' background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 10px, transparent 10px, transparent 20px);';
            } else if (pattern === 'grid') {
                style += ' background-image: linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 20px 20px;';
            } else if (pattern === 'sparkle') {
                style += ' background-image: radial-gradient(circle, rgba(255,255,255,0.3) 2px, transparent 2px), radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px); background-size: 30px 30px, 15px 15px; background-position: 0 0, 7px 7px;';
            }
        }

        return style;
    }

    function getInterestEmojis(interestIds) {
        if (!interestIds || interestIds.length === 0) return '';
        return interestIds
            .map(id => {
                const interest = $interestOptions.find(i => i.id === id);
                return interest ? interest.emoji : '';
            })
            .filter(Boolean)
            .join(' ');
    }

    function formatBirthdayLabel(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return null;
        const month = date.getUTCMonth();
        const day = date.getUTCDate();
        const labelDate = new Date(Date.UTC(2000, month, day));
        return labelDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
    }

    function getBirthdayCountdown(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return null;
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const target = new Date(Date.UTC(currentYear, date.getUTCMonth(), date.getUTCDate()));
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        if (target < today) {
            target.setUTCFullYear(currentYear + 1);
        }
        const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 5) {
            return `${diffDays} day${diffDays === 1 ? '' : 's'} until birthday`;
        }
        if (diffDays === 0) return 'Birthday today 🎉';
        if (diffDays === 1) return '1 day until birthday';
        const afterDays = 365 - diffDays;
        if (afterDays >= 0 && afterDays <= 2) {
            return `${afterDays} day${afterDays === 1 ? '' : 's'} since birthday`;
        }
        return null;
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
            <button class="btn btn-secondary btn-small" on:click={() => showProfilePreview = true}>
                👁️ Preview
            </button>
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
                            <h3>@{$currentUser?.username || $currentUser?.name || 'not_set'}</h3>
                            <button class="edit-btn" on:click={startEditUsername}>✏️ Edit</button>
                        {/if}

                        <p class="profile-email">
                            {$currentUser?.email || ''}
                        </p>
                    </div>
                </div>

                <fieldset class="form-group">
                    <legend>My Interests</legend>
                    <div class="interests-container" role="group" aria-label="My Interests">
                        {#each $interestOptions as interest}
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
                </fieldset>
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
                            <label for="timezone">Timezone</label>
                            <select
                                id="timezone"
                                bind:value={tempTimezone}
                                class="form-select"
                            >
                                {#each TIMEZONE_OPTIONS as tz}
                                    <option value={tz.value}>{tz.label}</option>
                                {/each}
                            </select>
                            <span class="field-hint">Your local timezone for event times</span>
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
                            <label for="magic_email">Email</label>
                            <input
                                type="email"
                                id="magic_email"
                                bind:value={tempMagicEmail}
                                placeholder="alternate@email.com"
                                maxlength="255"
                            />
                            <span class="field-hint">Optional alternate email for sign-in</span>
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
                            {#if $currentUser?.birthday}
                                <div class="detail-value">
                                    <div>{formatBirthdayLabel($currentUser.birthday)}</div>
                                    {#if getBirthdayCountdown($currentUser.birthday)}
                                        <div class="birthday-countdown">{getBirthdayCountdown($currentUser.birthday)}</div>
                                    {/if}
                                </div>
                            {:else}
                                <span class="detail-value">Not set</span>
                            {/if}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">🕐 Timezone</span>
                            <span class="detail-value">
                                {TIMEZONE_OPTIONS.find(tz => tz.value === $currentUser?.timezone)?.label || $currentUser?.timezone || 'Not set'}
                            </span>
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
                            <span class="detail-label">✉️ Email</span>
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
                        <div
                            class="banner-preview"
                            style={bannerImagePreview
                                ? `background-image: url('${bannerImagePreview}'); background-size: cover; background-position: center;`
                                : `background-color: ${tempBannerColor};`}
                        ></div>

                        <div class="form-group">
                            <label for="banner-image">Banner Image (optional)</label>
                            <input
                                id="banner-image"
                                type="file"
                                accept="image/*"
                                on:change={(e) => {
                                    const file = e.currentTarget.files?.[0];
                                    bannerImageFile = file || null;
                                    if (file) {
                                        bannerImagePreview = URL.createObjectURL(file);
                                    }
                                }}
                            />
                            {#if bannerImagePreview}
                                <button class="btn btn-secondary btn-small" on:click={clearBannerImage} type="button">
                                    Remove Image
                                </button>
                            {/if}
                        </div>

                        <fieldset class="form-group">
                            <legend>Banner Color</legend>
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
                        </fieldset>

                        <fieldset class="form-group">
                            <legend>Pattern</legend>
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
                        </fieldset>

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
                            style={$currentUser?.banner_image_url
                                ? `background-image: url('${$currentUser.banner_image_url}'); background-size: cover; background-position: center;`
                                : `background-color: ${$currentUser?.banner_color || '#4CAF50'};`}
                        ></div>
                        <button class="btn btn-secondary btn-full" on:click={startEditBanner}>
                            🎨 Customize Banner
                        </button>
                    </div>
                {/if}
            </div>

            <div class="card">
                <h3 class="card-title">
                    <span class="icon">🎬</span>
                    Favorite Movies
                </h3>

                <div class="movie-search">
                    <input
                        type="text"
                        placeholder="Search movies..."
                        bind:value={movieQuery}
                        on:keydown={(e) => e.key === 'Enter' && searchMovies()}
                    />
                    <button class="btn btn-secondary" on:click={searchMovies} disabled={searchingMovies || !movieQuery.trim()}>
                        {searchingMovies ? 'Searching...' : 'Search'}
                    </button>
                </div>

                {#if movieError}
                    <div class="movie-error">{movieError}</div>
                {/if}

                {#if movieResults.length > 0}
                    <div class="movie-results">
                        {#each movieResults as movie (movie.id)}
                            <div class="movie-card">
                                {#if movie.poster_url}
                                    <img src={movie.poster_url} alt={movie.title} />
                                {/if}
                                <div class="movie-info">
                                    <div class="movie-title">{movie.title}</div>
                                    {#if movie.year}
                                        <div class="movie-year">{movie.year}</div>
                                    {/if}
                                    <button
                                        class="btn btn-primary btn-small"
                                        on:click={() => handleAddFavorite(movie)}
                                        disabled={favoriteMovieIds.has(movie.id)}
                                    >
                                        {favoriteMovieIds.has(movie.id) ? 'Added' : 'Add to Favorites'}
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                <div class="movie-favorites">
                    {#if favoriteMovies.length === 0}
                        <p class="empty-text">No favorite movies yet.</p>
                    {:else}
                        <div class="movie-grid">
                            {#each favoriteMovies as movie (movie.id)}
                                <div class="movie-card">
                                    {#if movie.poster_url}
                                        <img src={movie.poster_url} alt={movie.title} />
                                    {/if}
                                    <div class="movie-info">
                                        <div class="movie-title">{movie.title}</div>
                                        {#if movie.year}
                                            <div class="movie-year">{movie.year}</div>
                                        {/if}
                                        <button class="btn btn-secondary btn-small" on:click={() => handleRemoveFavorite(movie.movie_id)}>
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
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

            <!-- Music Preferences Card -->
            <div class="card">
                <h3 class="card-title">
                    <span class="icon">🎵</span>
                    Music Preferences
                </h3>
                <p class="card-subtitle">
                    Add a song to display on your public profile
                </p>

                <div class="form-group">
                    <label for="settings_spotify_track_url">Spotify Track URL</label>
                    <input
                        type="url"
                        id="settings_spotify_track_url"
                        bind:value={tempSpotifyTrackUrl}
                        placeholder="https://open.spotify.com/track/..."
                        maxlength="400"
                    />
                    <span class="field-hint">Paste a Spotify track link to show on your public profile</span>
                </div>

                <div class="spotify-search">
                    <div class="spotify-search-row">
                        <input
                            type="text"
                            placeholder="Search for a song..."
                            bind:value={spotifyQuery}
                            on:keydown={(e) => e.key === 'Enter' && searchSpotifyTracks()}
                        />
                        <button
                            class="btn btn-secondary"
                            on:click={searchSpotifyTracks}
                            disabled={searchingSpotify || !spotifyQuery.trim()}
                        >
                            {searchingSpotify ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                    {#if spotifyError}
                        <div class="spotify-error">{spotifyError}</div>
                    {/if}
                    {#if spotifyResults.length > 0}
                        <div class="spotify-results">
                            {#each spotifyResults as track (track.id)}
                                <div class="spotify-track-card">
                                    {#if track.image_url}
                                        <img src={track.image_url} alt={track.title} />
                                    {/if}
                                    <div class="spotify-track-info">
                                        <div class="spotify-track-title">{track.title}</div>
                                        <div class="spotify-track-meta">
                                            {track.artists}{#if track.album} • {track.album}{/if}
                                        </div>
                                        {#if track.preview_url}
                                            <audio
                                                class="spotify-preview"
                                                controls
                                                preload="none"
                                                src={track.preview_url}
                                                on:play={handleSpotifyPreviewPlay}
                                            ></audio>
                                        {:else}
                                            <button
                                                class="btn btn-secondary btn-small spotify-preview-fallback-btn"
                                                type="button"
                                                on:click={() => toggleSpotifyEmbedPreview(track.id)}
                                            >
                                                {spotifyEmbedPreviewTrackId === track.id ? 'Hide Preview' : 'Preview'}
                                            </button>
                                            {#if spotifyEmbedPreviewTrackId === track.id}
                                                {@const embedUrl = getSpotifyTrackEmbedUrl(track)}
                                                {#if embedUrl}
                                                    <iframe
                                                        class="spotify-preview-embed"
                                                        title={`Spotify preview ${track.title}`}
                                                        src={embedUrl}
                                                        width="100%"
                                                        height="80"
                                                        frameborder="0"
                                                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                                        loading="lazy"
                                                    ></iframe>
                                                {/if}
                                            {/if}
                                        {/if}
                                    </div>
                                    <button
                                        class="btn btn-secondary btn-small"
                                        on:click={() => handleSelectSpotifyTrack(track)}
                                    >
                                        Use
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                {#if $currentUser?.spotify_track_url}
                    <div class="current-spotify">
                        <span class="detail-label">Current:</span>
                        <span class="detail-value spotify-url">{$currentUser.spotify_track_url}</span>
                    </div>
                {/if}

                <button
                    class="btn btn-primary btn-full"
                    on:click={saveSpotifyPreference}
                    disabled={saving}
                    style="margin-top: 12px;"
                >
                    {saving ? 'Saving...' : 'Save Music Preference'}
                </button>
            </div>

            <div class="card">
                <h3 class="card-title">
                    <span class="icon">🗂️</span>
                    Event Manager Access
                </h3>
                <p class="card-subtitle">
                    Request access to create and manage community events.
                </p>
                <button class="btn btn-secondary btn-full" on:click={requestEventManagerAccess} disabled={requestingAccess}>
                    {requestingAccess ? 'Requesting...' : 'Request Access'}
                </button>
            </div>

            <div class="card">
                <h3 class="card-title">
                    <span class="icon">🚪</span>
                    Account
                </h3>
                <a class="btn btn-secondary btn-full" href="#/pricing">
                    💳 Billing & Plans
                </a>
                <button class="btn btn-danger btn-full" on:click={handleSignOut}>
                    Sign Out
                </button>
            </div>
        {/if}
    </div>
{/if}

{#if showProfilePreview}
    <div class="modal-overlay" on:click|self={() => showProfilePreview = false}>
        <div class="modal-content">
            <div class="modal-header">
                <h3>Profile Preview</h3>
                <button class="modal-close" on:click={() => showProfilePreview = false}>✕</button>
            </div>

            <div class="preview-banner" style={getBannerStyle($currentUser?.banner_color, $currentUser?.banner_pattern, $currentUser?.banner_image_url)}>
                <div class="preview-avatar">
                    <Avatar avatar={$currentUser?.avatar} size="xl" />
                </div>
            </div>

            <div class="preview-body">
                <h2 class="preview-name">@{$currentUser?.username || $currentUser?.name || 'neighbor'}</h2>
                {#if $currentUser?.bio}
                    <p class="preview-bio">{$currentUser.bio}</p>
                {/if}

                <div class="preview-details">
                    {#if $currentUser?.city}
                        <div>🏙️ {$currentUser.city}</div>
                    {/if}
                    {#if $currentUser?.phone}
                        <div>📱 {formatPhoneNumber($currentUser.phone)}</div>
                    {/if}
                    {#if $currentUser?.birthday}
                        <div>🎂 {$currentUser.birthday}</div>
                    {/if}
                </div>

                {#if $currentUser?.interests?.length}
                    <div class="preview-interests">
                        <div class="preview-interests-labels">
                            {#each $currentUser.interests as interestId}
                                {@const interest = $interestOptions.find(i => i.id === interestId)}
                                {#if interest}
                                    <span class="interest-pill" style={`--pill-color: ${interest.color || '#4CAF50'}`}>
                                        <span class="pill-emoji">{interest.emoji}</span>
                                        {interest.label}
                                    </span>
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>
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

    .card-subtitle {
        color: var(--text-muted);
        font-size: 13px;
        margin: 6px 0 12px;
    }

    .profile-email {
        color: var(--text-muted);
        font-size: 13px;
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

    fieldset.form-group {
        border: 0;
        padding: 0;
        margin: 0;
    }

    fieldset.form-group legend {
        font-weight: 600;
        font-size: 14px;
        color: var(--text);
        margin-bottom: 8px;
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

    .details-form select,
    .form-select {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid var(--border, #E0E0E0);
        border-radius: var(--radius-sm, 8px);
        font-size: 14px;
        transition: border-color 0.2s ease;
        background: white;
        cursor: pointer;
    }

    .details-form select:focus,
    .form-select:focus {
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
        height: 120px;
        border-radius: var(--radius-sm);
        background-size: cover;
        background-position: center;
    }

    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 1000;
    }

    .modal-content {
        background: white;
        border-radius: 16px;
        width: 100%;
        max-width: 520px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        overflow: hidden;
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--cream-dark);
    }

    .modal-close {
        border: none;
        background: none;
        font-size: 18px;
        cursor: pointer;
    }

    .preview-banner {
        height: 140px;
        position: relative;
    }

    .preview-avatar {
        position: absolute;
        left: 20px;
        bottom: -28px;
        background: white;
        padding: 4px;
        border-radius: 999px;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    }

    .preview-body {
        padding: 36px 20px 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .preview-name {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
    }

    .preview-bio {
        margin: 0;
        color: var(--text-muted);
    }

    .preview-details {
        display: grid;
        gap: 6px;
        font-size: 13px;
        color: var(--text);
    }

    .preview-interests {
        display: grid;
        gap: 6px;
    }

    .preview-interests-emoji {
        font-size: 18px;
    }

    .movie-search {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
    }

    .movie-search input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
    }

    .movie-results,
    .movie-favorites {
        margin-top: 12px;
    }

    .movie-grid,
    .movie-results {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
    }

    .movie-card {
        display: flex;
        gap: 10px;
        padding: 10px;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        background: white;
    }

    .movie-card img {
        width: 64px;
        height: 96px;
        object-fit: cover;
        border-radius: 8px;
    }

    .movie-info {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
    }

    .movie-title {
        font-weight: 600;
        font-size: 14px;
    }

    .movie-year {
        font-size: 12px;
        color: var(--text-muted);
    }

    .movie-error {
        color: #c62828;
        font-size: 12px;
        margin-top: 6px;
    }

    .spotify-search {
        margin-top: 12px;
    }

    .spotify-search-row {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .spotify-search-row input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-size: 14px;
    }

    .spotify-error {
        color: #c62828;
        font-size: 12px;
        margin-top: 6px;
    }

    .spotify-results {
        display: grid;
        gap: 10px;
        margin-top: 12px;
    }

    .spotify-track-card {
        display: grid;
        grid-template-columns: 54px 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 10px;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        background: white;
    }

    .spotify-track-card img {
        width: 54px;
        height: 54px;
        object-fit: cover;
        border-radius: 8px;
    }

    .spotify-track-title {
        font-weight: 600;
        font-size: 14px;
    }

    .spotify-track-meta {
        font-size: 12px;
        color: var(--text-muted);
    }

    .spotify-preview {
        margin-top: 8px;
        width: 100%;
        max-width: 260px;
        height: 32px;
    }

    .spotify-preview-fallback-btn {
        margin-top: 8px;
    }

    .spotify-preview-embed {
        margin-top: 8px;
        border: 0;
        border-radius: 10px;
        overflow: hidden;
        width: 100%;
        max-width: 320px;
        background: #fff;
    }

    .current-spotify {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--cream);
        border-radius: var(--radius-sm);
        margin-top: 12px;
    }

    .current-spotify .detail-label {
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
    }

    .current-spotify .spotify-url {
        font-size: 12px;
        color: var(--text-muted);
        word-break: break-all;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .preview-interests-labels {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .birthday-countdown {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
    }
    .interest-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        color: #1f2f22;
        background: color-mix(in srgb, var(--pill-color) 18%, white);
        border: 1px solid color-mix(in srgb, var(--pill-color) 45%, white);
    }

    .pill-emoji {
        font-size: 14px;
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
