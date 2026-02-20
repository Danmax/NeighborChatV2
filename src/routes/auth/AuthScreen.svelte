<script>
    import { onMount, onDestroy, tick } from 'svelte';
    import { loadClerk } from '../../lib/clerk.js';

    let loading = true;
    let error = '';
    let clerkNode;
    let authMode = 'sign-in';
    let clerk = null;

    function resolveAuthModeFromHash(hashValue) {
        return hashValue.includes('mode=sign-up') ? 'sign-up' : 'sign-in';
    }

    function getAuthUrls() {
        const appBaseUrl = window.location.origin;
        return {
            signInUrl: `${appBaseUrl}/#/auth?mode=sign-in`,
            signUpUrl: `${appBaseUrl}/#/auth?mode=sign-up`,
            homeUrl: `${appBaseUrl}/#/`
        };
    }

    async function mountAuthWidget() {
        if (!clerk) return;
        await tick();
        if (!clerkNode) {
            throw new Error('Auth container not found');
        }

        const { signInUrl, signUpUrl, homeUrl } = getAuthUrls();
        window.Clerk?.unmountSignIn?.(clerkNode);
        window.Clerk?.unmountSignUp?.(clerkNode);

        const sharedConfig = {
            routing: 'hash',
            signInUrl,
            signUpUrl,
            forceRedirectUrl: homeUrl,
            fallbackRedirectUrl: homeUrl
        };

        if (authMode === 'sign-up') {
            clerk.mountSignUp(clerkNode, sharedConfig);
            return;
        }

        clerk.mountSignIn(clerkNode, sharedConfig);
    }

    function setAuthMode(mode) {
        const nextMode = mode === 'sign-up' ? 'sign-up' : 'sign-in';
        const nextHash = nextMode === 'sign-up' ? '#/auth?mode=sign-up' : '#/auth?mode=sign-in';
        if (window.location.hash !== nextHash) {
            window.location.hash = nextHash;
        }
    }

    onMount(async () => {
        const handleHashChange = async () => {
            const nextMode = resolveAuthModeFromHash(window.location.hash || '');
            if (nextMode === authMode) return;
            authMode = nextMode;
            try {
                await mountAuthWidget();
            } catch (err) {
                error = err.message || 'Unable to load authentication';
            }
        };

        try {
            authMode = resolveAuthModeFromHash(window.location.hash || '');
            clerk = await loadClerk();
            await clerk.load();
            await mountAuthWidget();
            window.addEventListener('hashchange', handleHashChange);
        } catch (err) {
            error = err.message || 'Unable to load authentication';
        } finally {
            loading = false;
        }

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    });

    onDestroy(() => {
        if (!clerkNode) return;
        window.Clerk?.unmountSignIn?.(clerkNode);
        window.Clerk?.unmountSignUp?.(clerkNode);
    });
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
                    <h2>{authMode === 'sign-up' ? 'Create your Neighbor Chat account' : 'Sign in to Neighbor Chat'}</h2>
                    <p>{authMode === 'sign-up' ? 'Join your community in seconds.' : 'Jump into your community in seconds.'}</p>
                </div>
            </div>

            {#if error}
                <div class="auth-message error">{error}</div>
            {/if}

            <div class="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
                <button
                    type="button"
                    class="auth-mode-btn"
                    class:active={authMode === 'sign-in'}
                    on:click={() => setAuthMode('sign-in')}
                >
                    Log In
                </button>
                <button
                    type="button"
                    class="auth-mode-btn"
                    class:active={authMode === 'sign-up'}
                    on:click={() => setAuthMode('sign-up')}
                >
                    Sign Up
                </button>
            </div>

            <div class="auth-actions">
                <a class="btn btn-clerk btn-full" href="#/pricing">
                    View Plans & Billing
                </a>
            </div>

            {#if loading}
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>{authMode === 'sign-up' ? 'Loading sign-up...' : 'Loading sign-in...'}</p>
                </div>
            {/if}
            <div class="clerk-signin" bind:this={clerkNode}></div>

            <div class="auth-footer">
                <p>Secure authentication powered by Clerk.</p>
                <span class="auth-status">{loading ? 'Loading authentication...' : 'Ready'}</span>
            </div>
        </section>
    </div>
</div>

<style>
    .auth-screen {
        padding: 24px 0 40px;
    }

    .auth-shell {
        display: flex;
        flex-direction: column;
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

    .auth-mode-toggle {
        display: flex;
        gap: 8px;
        padding: 6px;
        background: #f4f4f7;
        border-radius: 12px;
    }

    .auth-mode-btn {
        flex: 1;
        border: 0;
        border-radius: 8px;
        padding: 10px 12px;
        font-weight: 600;
        color: var(--text-muted);
        background: transparent;
        cursor: pointer;
    }

    .auth-mode-btn.active {
        background: #ffffff;
        color: var(--text);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .clerk-signin {
        background: #fbfbff;
        border-radius: 18px;
        padding: 12px;
        border: 1px solid #ebe7ff;
        min-height: 360px;
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
