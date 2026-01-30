<script>
    import { push } from 'svelte-spa-router';
    import { sendMagicLink, signInWithGitHub, checkPasswordStrength } from '../../services/auth.service.js';
    import { createGuestUser } from '../../stores/auth.js';
    import { showTopMenu } from '../../stores/ui.js';

    let email = '';
    let loading = false;
    let sent = false;
    let error = '';
    let success = '';

    async function handleSendMagicLink() {
        if (!email.trim()) {
            error = 'Please enter your email';
            return;
        }

        loading = true;
        error = '';

        try {
            const result = await sendMagicLink(email);
            sent = true;
            success = `Magic link sent to ${result.email}`;
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    async function handleGitHubAuth() {
        loading = true;
        error = '';

        try {
            await signInWithGitHub();
            // User will be redirected to GitHub, then back to app
            // setupAuthListener in App.svelte will handle the callback
        } catch (err) {
            error = err.message;
            loading = false;
        }
    }

    function handleGuestAccess() {
        const user = createGuestUser();
        showTopMenu.set(true);
        push('/');
    }

    function resetForm() {
        sent = false;
        email = '';
        error = '';
        success = '';
    }

    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            handleSendMagicLink();
        }
    }
</script>

<div class="auth-screen">
    <div class="card" style="max-width: 400px; margin: 0 auto;">
        <div class="auth-header">
            <div class="auth-icon">🏘️</div>
            <h2>Neighbor Chat</h2>
            <p>Connect with your community</p>
        </div>

        {#if !sent}
            <!-- Email Input Form -->
            <div class="auth-form">
                <div class="form-group">
                    <label for="authEmail">📧 Email Address</label>
                    <input
                        type="email"
                        id="authEmail"
                        bind:value={email}
                        placeholder="your@email.com"
                        on:keypress={handleKeyPress}
                        disabled={loading}
                    />
                </div>

                {#if error}
                    <div class="auth-message error">{error}</div>
                {/if}

                <button
                    class="btn btn-primary btn-full"
                    on:click={handleSendMagicLink}
                    disabled={loading}
                >
                    {#if loading}
                        <span class="btn-spinner"></span>
                        Sending...
                    {:else}
                        ✉️ Send Magic Link
                    {/if}
                </button>

                <p class="auth-hint">
                    We'll send you a login link - no password needed!
                </p>

                <button
                    class="btn btn-github btn-full"
                    on:click={handleGitHubAuth}
                    disabled={loading}
                >
                    <svg class="github-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    Continue with GitHub
                </button>

                <div class="auth-divider">
                    <span>or</span>
                </div>

                <button
                    class="btn btn-secondary btn-full"
                    on:click={handleGuestAccess}
                    disabled={loading}
                >
                    👤 Continue as Guest
                </button>

                <p class="guest-hint">
                    Try the app without an account
                </p>
            </div>
        {:else}
            <!-- Magic Link Sent State -->
            <div class="auth-sent">
                <div class="sent-icon">📬</div>
                <h4>Check Your Email!</h4>
                <p class="sent-message">
                    We sent a magic link to<br/>
                    <strong>{email}</strong>
                </p>
                <p class="sent-hint">
                    Click the link in the email to sign in.<br/>
                    The link expires in 1 hour.
                </p>

                <button class="btn btn-secondary btn-full" on:click={resetForm}>
                    ← Use Different Email
                </button>

                <button class="btn-link" on:click={handleSendMagicLink}>
                    Didn't receive it? Send again
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
    .auth-screen {
        padding: 20px 0;
    }

    .auth-header {
        text-align: center;
        margin-bottom: 24px;
    }

    .auth-icon {
        font-size: 48px;
        margin-bottom: 12px;
    }

    .auth-header h2 {
        color: var(--primary);
        margin-bottom: 8px;
    }

    .auth-header p {
        color: var(--text-light);
        font-size: 14px;
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .auth-message {
        padding: 12px 16px;
        border-radius: var(--radius-sm);
        font-size: 14px;
    }

    .auth-message.error {
        background: #FFEBEE;
        color: #C62828;
        border: 1px solid #EF5350;
    }

    .auth-message.success {
        background: #E8F5E9;
        color: #2E7D32;
        border: 1px solid #66BB6A;
    }

    .auth-hint {
        text-align: center;
        color: var(--text-muted);
        font-size: 12px;
        margin-top: -8px;
    }

    .auth-divider {
        display: flex;
        align-items: center;
        gap: 16px;
        color: var(--text-muted);
        font-size: 13px;
    }

    .auth-divider::before,
    .auth-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--cream-dark);
    }

    .guest-hint {
        text-align: center;
        color: var(--text-muted);
        font-size: 12px;
        margin-top: -8px;
    }

    .btn-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 8px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* Sent State */
    .auth-sent {
        text-align: center;
    }

    .sent-icon {
        font-size: 48px;
        margin-bottom: 16px;
    }

    .auth-sent h4 {
        color: var(--primary);
        margin-bottom: 8px;
    }

    .sent-message {
        color: var(--text-light);
        font-size: 14px;
        margin-bottom: 16px;
        line-height: 1.5;
    }

    .sent-hint {
        color: var(--text-muted);
        font-size: 12px;
        margin-bottom: 20px;
        line-height: 1.5;
    }

    .btn-link {
        background: none;
        border: none;
        color: var(--primary);
        cursor: pointer;
        font-size: 13px;
        margin-top: 12px;
        text-decoration: underline;
    }

    .btn-link:hover {
        color: var(--primary-dark);
    }

    .btn-github {
        background: #24292e;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 12px;
    }

    .btn-github:hover {
        background: #1b1f23;
    }

    .btn-github:disabled {
        background: #6a737d;
        cursor: not-allowed;
    }

    .github-icon {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
    }
</style>
