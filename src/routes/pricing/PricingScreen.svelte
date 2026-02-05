<script>
    import { onMount, onDestroy } from 'svelte';

    const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_c29jaWFsLWVzY2FyZ290LTAuY2xlcmsuYWNjb3VudHMuZGV2JA';
    const CLERK_SCRIPT_SRC = 'https://social-escargot-0.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js';

    let loading = true;
    let error = '';

    async function loadClerk() {
        if (window.Clerk) {
            return window.Clerk;
        }

        await new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${CLERK_SCRIPT_SRC}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('Failed to load Clerk')));
                return;
            }

            const script = document.createElement('script');
            script.src = CLERK_SCRIPT_SRC;
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';
            script.setAttribute('data-clerk-publishable-key', CLERK_PUBLISHABLE_KEY);
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Clerk'));
            document.head.appendChild(script);
        });

        return window.Clerk;
    }

    onMount(async () => {
        try {
            const clerk = await loadClerk();
            await clerk.load();
            clerk.mountPricingTable('#clerk-pricing');
        } catch (err) {
            error = err.message || 'Unable to load pricing table';
        } finally {
            loading = false;
        }
    });

    onDestroy(() => {
        if (window.Clerk?.unmountPricingTable) {
            window.Clerk.unmountPricingTable('#clerk-pricing');
        }
    });
</script>

<div class="pricing-screen">
    <div class="pricing-hero">
        <div class="hero-badge">Clerk Billing</div>
        <h1>Choose a plan that fits your community</h1>
        <p>Upgrade to unlock advanced events, games, and admin workflows.</p>
    </div>

    {#if loading}
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading pricing...</p>
        </div>
    {:else if error}
        <div class="error-state">{error}</div>
    {:else}
        <div id="clerk-pricing" class="pricing-table"></div>
    {/if}
</div>

<style>
    .pricing-screen {
        padding-bottom: 40px;
    }

    .pricing-hero {
        background: linear-gradient(135deg, #fff7e6, #f3efe3);
        border-radius: 24px;
        padding: 28px;
        margin-bottom: 20px;
        border: 1px solid #efe2c7;
    }

    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        background: #fff1d6;
        color: #a35c00;
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 12px;
    }

    .pricing-hero h1 {
        margin: 0 0 10px;
        font-size: 28px;
    }

    .pricing-hero p {
        margin: 0;
        color: var(--text-muted);
    }

    .pricing-table {
        background: white;
        border-radius: 20px;
        padding: 20px;
        border: 1px solid #eee;
        box-shadow: var(--shadow-sm);
    }

    .error-state {
        background: #ffebee;
        color: #c62828;
        padding: 12px 16px;
        border-radius: 12px;
    }
</style>
