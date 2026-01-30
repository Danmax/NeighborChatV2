<script>
    import { push } from 'svelte-spa-router';
    import { sendMagicLink, checkPasswordStrength } from '../../services/auth.service.js';
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
</style>
