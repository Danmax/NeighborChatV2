<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { currentUser } from '../../stores/auth.js';
    import { loadPublicProfile } from '../../services/profile.service.js';
    import { interestOptions } from '../../stores/options.js';
    import { saveContact } from '../../services/contacts.service.js';
    import { isContact } from '../../stores/contacts.js';
    import { sendChatInviteWithResponse } from '../../services/realtime.service.js';
    import { trackSentInvite, updateInviteStatus } from '../../stores/invites.js';
    import { formatPhoneNumber } from '../../lib/utils/phone.js';
    import Avatar from '../../components/avatar/Avatar.svelte';

    export let params = {};

    let profile = null;
    let loading = true;
    let error = null;
    let message = '';
    let actionError = '';
    let isSaved = false;

    $: userId = params.userId;
    $: isOwnProfile = userId === $currentUser?.user_id;

    onMount(async () => {
        if (isOwnProfile) {
            push('/profile');
            return;
        }

        try {
            loading = true;
            error = null;
            profile = await loadPublicProfile(userId);

            if (!profile) {
                error = 'Profile not found';
                return;
            }

            // Check if user is already in contacts
            isSaved = await isContact(userId);
        } catch (err) {
            console.error('Failed to load public profile:', err);
            error = 'Failed to load profile';
        } finally {
            loading = false;
        }
    });

    async function handleSaveContact() {
        if (!profile) return;

        try {
            await saveContact({
                user_id: profile.user_id,
                name: profile.username || profile.display_name,
                avatar: profile.avatar,
                interests: profile.interests || []
            });
            isSaved = true;
            message = `${profile.username || profile.display_name} saved to contacts!`;
            setTimeout(() => message = '', 3000);
        } catch (err) {
            actionError = 'Failed to save contact: ' + err.message;
            setTimeout(() => actionError = '', 3000);
        }
    }

    async function handleSendInvite() {
        if (!profile) return;

        try {
            const timeoutId = setTimeout(() => {
                updateInviteStatus(profile.user_id, 'expired');
            actionError = `Invite to ${profile.username || profile.display_name} expired (no response)`;
                setTimeout(() => actionError = '', 3000);
            }, 60000);

            trackSentInvite(profile.user_id, timeoutId);

            const cleanup = await sendChatInviteWithResponse(profile.user_id, (accepted) => {
                if (accepted) {
                    updateInviteStatus(profile.user_id, 'accepted');
                    message = `${profile.username || profile.display_name} accepted your invite!`;
                    setTimeout(() => message = '', 3000);
                    push(`/chat/${profile.user_id}`);
                } else {
                    updateInviteStatus(profile.user_id, 'declined');
                    actionError = `${profile.username || profile.display_name} declined your invite`;
                    setTimeout(() => actionError = '', 3000);
                }
                cleanup?.();
            });

            message = `Invite sent to ${profile.username || profile.display_name}. Waiting for response...`;
            setTimeout(() => {
                if (message.includes('Waiting for response')) {
                    message = '';
                }
            }, 3000);
        } catch (err) {
            actionError = 'Failed to send invite: ' + err.message;
            setTimeout(() => actionError = '', 3000);
        }
    }

    function getBannerStyle(color, pattern, imageUrl) {
        let style = imageUrl
            ? `background-image: url('${imageUrl}'); background-size: cover; background-position: center;`
            : `background-color: ${color || '#4CAF50'};`;

        if (pattern === 'dots') {
            style += ' background-image: radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px); background-size: 20px 20px;';
        } else if (pattern === 'stripes') {
            style += ' background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 10px, transparent 10px, transparent 20px);';
        } else if (pattern === 'grid') {
            style += ' background-image: linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 20px 20px;';
        } else if (pattern === 'sparkle') {
            style += ' background-image: radial-gradient(circle, rgba(255,255,255,0.3) 2px, transparent 2px), radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px); background-size: 30px 30px, 15px 15px; background-position: 0 0, 7px 7px;';
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
</script>

<div class="public-profile-screen">
    {#if loading}
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading profile...</p>
        </div>
    {:else if error}
        <div class="error-state">
            <div class="error-icon">😞</div>
            <p>{error}</p>
            <button class="btn btn-secondary" on:click={() => push('/')}>
                ← Back to Home
            </button>
        </div>
    {:else if profile}
        <!-- Profile Banner -->
        <div class="profile-banner" style={getBannerStyle(profile.banner_color, profile.banner_pattern, profile.banner_image_url)}>
            <button class="back-btn" on:click={() => window.history.back()} title="Go back">
                ←
            </button>
            <div class="banner-avatar">
                <Avatar avatar={profile.avatar} size="xl" />
            </div>
        </div>

        <!-- Action Messages -->
        {#if message}
            <div class="action-banner success">{message}</div>
        {/if}
        {#if actionError}
            <div class="action-banner error">{actionError}</div>
        {/if}

        <!-- Profile Info Card -->
        <div class="card profile-info-card">
            <h2 class="profile-name">@{profile.username || profile.display_name}</h2>

            {#if profile.bio}
                <p class="profile-bio">{profile.bio}</p>
            {/if}

            <!-- Profile Details -->
            <div class="profile-details">
                {#if profile.city}
                    <div class="profile-detail">
                        <span class="detail-icon">🏙️</span>
                        <span class="detail-text">{profile.city}</span>
                    </div>
                {/if}

                {#if profile.phone}
                    <div class="profile-detail">
                        <span class="detail-icon">📱</span>
                        <span class="detail-text">{formatPhoneNumber(profile.phone)}</span>
                    </div>
                {/if}

                {#if profile.birthday}
                    <div class="profile-detail">
                        <span class="detail-icon">🎂</span>
                        <span class="detail-text">{profile.birthday}</span>
                    </div>
                {/if}
            </div>

            <!-- Interests -->
            {#if profile.interests && profile.interests.length > 0}
                <div class="interests-section">
                    <h4 class="section-title">Interests</h4>
                    <div class="interests-labels">
                        {#each profile.interests as interestId}
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

            <!-- Actions -->
            <div class="profile-actions">
                {#if !isSaved}
                    <button class="btn btn-secondary" on:click={handleSaveContact}>
                        💾 Save to Contacts
                    </button>
                {:else}
                    <button class="btn btn-secondary" disabled>
                        ✓ Saved
                    </button>
                {/if}
                <button class="btn btn-primary" on:click={handleSendInvite}>
                    💬 Send Chat Invite
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .public-profile-screen {
        min-height: 100vh;
        background: var(--cream, #F5F5DC);
    }

    .loading-state,
    .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        padding: 20px;
        text-align: center;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid var(--cream-dark);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 16px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .error-icon {
        font-size: 60px;
        margin-bottom: 16px;
    }

    .profile-banner {
        position: relative;
        height: 200px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 60px;
    }

    .back-btn {
        position: absolute;
        top: 16px;
        left: 16px;
        width: 40px;
        height: 40px;
        border: none;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        font-size: 20px;
        color: var(--text);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .back-btn:hover {
        background: white;
        transform: scale(1.05);
    }

    .banner-avatar {
        position: absolute;
        bottom: -40px;
        border: 4px solid white;
        border-radius: 50%;
        background: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .action-banner {
        padding: 12px 16px;
        margin: 16px 16px 0;
        border-radius: var(--radius-sm);
        font-size: 14px;
        text-align: center;
        animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .action-banner.success {
        background: #E8F5E9;
        color: #2E7D32;
        border: 1px solid #A5D6A7;
    }

    .action-banner.error {
        background: #FFEBEE;
        color: #C62828;
        border: 1px solid #EF9A9A;
    }

    .profile-info-card {
        margin: 56px 16px 16px;
        text-align: center;
    }

    .profile-name {
        font-size: 24px;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 4px;
    }

    .profile-username {
        font-size: 14px;
        color: var(--text-muted);
        margin-bottom: 16px;
    }

    .profile-bio {
        font-size: 15px;
        color: var(--text);
        line-height: 1.5;
        margin: 16px 0;
        padding: 12px;
        background: var(--cream);
        border-radius: var(--radius-sm);
    }

    .profile-details {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 20px 0;
    }

    .profile-detail {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 14px;
        color: var(--text);
    }

    .detail-icon {
        font-size: 18px;
    }

    .interests-section {
        margin: 24px 0;
        padding: 20px;
        background: var(--cream);
        border-radius: var(--radius-sm);
    }

    .section-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
    }

    .interests-labels {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
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

    .profile-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
    }

    .profile-actions .btn {
        flex: 1;
    }

    .btn {
        padding: 14px 20px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-primary:hover {
        background: var(--primary-dark);
    }

    .btn-secondary {
        background: var(--cream-dark);
        color: var(--text);
    }

    .btn-secondary:hover:not(:disabled) {
        background: #D0D0C0;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
