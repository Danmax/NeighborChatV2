<script>
    import { push } from 'svelte-spa-router';
    import { signInWithGitHub, signInWithGoogle } from '../../services/auth.service.js';

    let loading = false;
    let error = '';

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

    async function handleGoogleAuth() {
        loading = true;
        error = '';

        try {
            await signInWithGoogle();
            // User will be redirected to Google, then back to app
            // setupAuthListener in App.svelte will handle the callback
        } catch (err) {
            error = err.message;
            loading = false;
        }
    }

    // Auth routing handled centrally in App.svelte
</script>

<div class="auth-screen">
    <div class="auth-shell">
        <section class="auth-hero">
            <div class="hero-badge">Neighborhood 2.0</div>
            <h1>Meet. Play. Celebrate.</h1>
            <p>
                A community hub for events, games, kudos, and real-time connections.
            </p>
            <div class="hero-highlights">
                <div class="highlight-card">
                    <span class="highlight-icon">🎉</span>
                    <div>
                        <strong>Celebrations</strong>
                        <p>Share kudos, GIFs, and shout-outs.</p>
                    </div>
                </div>
                <div class="highlight-card">
                    <span class="highlight-icon">📅</span>
                    <div>
                        <strong>Events & Potlucks</strong>
                        <p>Plan meetups, items, and recipes.</p>
                    </div>
                </div>
                <div class="highlight-card">
                    <span class="highlight-icon">🎮</span>
                    <div>
                        <strong>Game Nights</strong>
                        <p>Teams, scores, and tournament formats.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="auth-panel">
            <div class="panel-header">
                <div class="auth-icon">🏘️</div>
                <div>
                    <h2>Sign in to Neighbor Chat</h2>
                    <p>Jump into your community in seconds.</p>
                </div>
            </div>

            {#if error}
                <div class="auth-message error">{error}</div>
            {/if}

            <div class="auth-actions">
                <a class="btn btn-clerk btn-full" href="#/pricing">
                    View Plans & Billing
                </a>
                <button
                    class="btn btn-google btn-full"
                    on:click={handleGoogleAuth}
                    disabled={loading}
                >
                    <svg class="oauth-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                </button>

                <button
                    class="btn btn-github btn-full"
                    on:click={handleGitHubAuth}
                    disabled={loading}
                >
                    <svg class="oauth-icon" viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    Continue with GitHub
                </button>
            </div>

            <div class="auth-footer">
                <p>Secure sign‑in. No passwords stored in Neighbor Chat.</p>
                <span class="auth-status">{loading ? 'Opening provider...' : 'Ready to sign in'}</span>
            </div>
        </section>
    </div>
</div>

<style>
    .auth-screen {
        padding: 24px 0 40px;
    }

    .auth-shell {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
        gap: 24px;
        align-items: stretch;
    }

    .auth-hero {
        background: radial-gradient(circle at top left, #ffffff 0%, #f5f2e8 60%, #efe6d8 100%);
        border-radius: 28px;
        padding: 32px;
        border: 1px solid #eadfcb;
        box-shadow: var(--shadow-sm);
    }

    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        background: #fff7e6;
        color: #a35c00;
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 16px;
    }

    .auth-hero h1 {
        margin: 0 0 12px;
        font-size: 34px;
        line-height: 1.1;
    }

    .auth-hero p {
        margin: 0 0 20px;
        color: var(--text-muted);
        font-size: 15px;
        max-width: 460px;
    }

    .hero-highlights {
        display: grid;
        gap: 12px;
    }

    .highlight-card {
        background: white;
        border-radius: 18px;
        padding: 14px 16px;
        display: flex;
        gap: 12px;
        align-items: flex-start;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
    }

    .highlight-icon {
        font-size: 22px;
    }

    .highlight-card strong {
        display: block;
        font-size: 14px;
    }

    .highlight-card p {
        margin: 4px 0 0;
        font-size: 13px;
        color: var(--text-muted);
    }

    .auth-panel {
        background: white;
        border-radius: 24px;
        padding: 24px;
        border: 1px solid #eee;
        box-shadow: var(--shadow-md);
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .panel-header {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .auth-icon {
        font-size: 40px;
    }

    .panel-header h2 {
        margin: 0 0 4px;
    }

    .panel-header p {
        margin: 0;
        color: var(--text-muted);
        font-size: 13px;
    }

    .auth-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
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

    .auth-footer {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 12px;
        color: var(--text-muted);
    }

    .auth-status {
        font-weight: 600;
        color: var(--text);
    }

    .btn-google {
        background: white;
        color: #3c4043;
        border: 1px solid #dadce0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-weight: 500;
    }

    .btn-google:hover:not(:disabled) {
        background: #f8f9fa;
        border-color: #d2d3d4;
    }

    .btn-google:disabled {
        background: #f5f5f5;
        color: #9aa0a6;
        cursor: not-allowed;
    }

    .btn-github {
        background: #24292e;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-weight: 500;
    }

    .btn-github:hover:not(:disabled) {
        background: #1b1f23;
    }

    .btn-github:disabled {
        background: #6a737d;
        cursor: not-allowed;
    }

    .btn-clerk {
        background: #111827;
        color: white;
        text-align: center;
        text-decoration: none;
        font-weight: 600;
    }

    .btn-clerk:hover {
        background: #0b1220;
    }

    .oauth-icon {
        flex-shrink: 0;
    }

    @media (max-width: 900px) {
        .auth-shell {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 640px) {
        .auth-hero {
            padding: 24px;
        }

        .auth-hero h1 {
            font-size: 28px;
        }

        .auth-panel {
            padding: 20px;
        }
    }
</style>
