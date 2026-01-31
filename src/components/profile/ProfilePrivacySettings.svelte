<script>
    import { createEventDispatcher } from 'svelte';
    import { currentUser } from '../../stores/auth.js';

    const dispatch = createEventDispatcher();

    export let settings = {
        show_city: true,
        show_phone: false,
        show_email: false,
        show_birthday: false,
        show_interests: true
    };

    // Initialize from current user if available
    $: if ($currentUser && !settings.initialized) {
        settings = {
            show_city: $currentUser.show_city ?? true,
            show_phone: $currentUser.show_phone ?? false,
            show_email: $currentUser.show_email ?? false,
            show_birthday: $currentUser.show_birthday ?? false,
            show_interests: $currentUser.show_interests ?? true,
            initialized: true
        };
    }

    function toggleSetting(key) {
        settings[key] = !settings[key];
        dispatch('change', settings);
    }
</script>

<div class="privacy-settings">
    <div class="privacy-header">
        <h4>Privacy Settings</h4>
        <p class="privacy-description">Choose what's visible on your public profile</p>
    </div>

    <div class="privacy-options">
        <div class="privacy-option">
            <div class="option-info">
                <span class="option-icon">🏙️</span>
                <div class="option-text">
                    <span class="option-label">City</span>
                    <span class="option-hint">Show your city location</span>
                </div>
            </div>
            <button
                class="toggle-btn"
                class:active={settings.show_city}
                on:click={() => toggleSetting('show_city')}
                type="button"
            >
                <span class="toggle-slider"></span>
            </button>
        </div>

        <div class="privacy-option">
            <div class="option-info">
                <span class="option-icon">📱</span>
                <div class="option-text">
                    <span class="option-label">Phone Number</span>
                    <span class="option-hint">Share your phone with others</span>
                </div>
            </div>
            <button
                class="toggle-btn"
                class:active={settings.show_phone}
                on:click={() => toggleSetting('show_phone')}
                type="button"
            >
                <span class="toggle-slider"></span>
            </button>
        </div>

        <div class="privacy-option">
            <div class="option-info">
                <span class="option-icon">🎂</span>
                <div class="option-text">
                    <span class="option-label">Birthday</span>
                    <span class="option-hint">Display your birthday</span>
                </div>
            </div>
            <button
                class="toggle-btn"
                class:active={settings.show_birthday}
                on:click={() => toggleSetting('show_birthday')}
                type="button"
            >
                <span class="toggle-slider"></span>
            </button>
        </div>

        <div class="privacy-option">
            <div class="option-info">
                <span class="option-icon">🎨</span>
                <div class="option-text">
                    <span class="option-label">Interests</span>
                    <span class="option-hint">Show your hobbies and interests</span>
                </div>
            </div>
            <button
                class="toggle-btn"
                class:active={settings.show_interests}
                on:click={() => toggleSetting('show_interests')}
                type="button"
            >
                <span class="toggle-slider"></span>
            </button>
        </div>
    </div>

    <div class="privacy-note">
        <span class="note-icon">🔒</span>
        <p>Your email is never shared publicly for security reasons.</p>
    </div>
</div>

<style>
    .privacy-settings {
        padding: 20px;
        background: var(--cream);
        border-radius: var(--radius-sm);
    }

    .privacy-header {
        margin-bottom: 20px;
    }

    .privacy-header h4 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 6px;
    }

    .privacy-description {
        font-size: 13px;
        color: var(--text-muted);
        margin: 0;
    }

    .privacy-options {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .privacy-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px;
        background: white;
        border-radius: var(--radius-sm);
    }

    .option-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }

    .option-icon {
        font-size: 24px;
    }

    .option-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .option-label {
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
    }

    .option-hint {
        font-size: 12px;
        color: var(--text-muted);
    }

    .toggle-btn {
        position: relative;
        width: 50px;
        height: 28px;
        border: none;
        background: #E0E0E0;
        border-radius: 14px;
        cursor: pointer;
        transition: background 0.2s ease;
        padding: 0;
    }

    .toggle-btn:hover {
        background: #D0D0D0;
    }

    .toggle-btn.active {
        background: var(--primary);
    }

    .toggle-btn.active:hover {
        background: var(--primary-dark);
    }

    .toggle-slider {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 22px;
        height: 22px;
        background: white;
        border-radius: 50%;
        transition: transform 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .toggle-btn.active .toggle-slider {
        transform: translateX(22px);
    }

    .privacy-note {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-top: 20px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.6);
        border-radius: var(--radius-sm);
        border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .note-icon {
        font-size: 16px;
        flex-shrink: 0;
    }

    .privacy-note p {
        font-size: 12px;
        color: var(--text-muted);
        margin: 0;
        line-height: 1.4;
    }
</style>
