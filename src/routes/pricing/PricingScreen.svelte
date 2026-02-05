<script>
    import { onMount, onDestroy, tick } from 'svelte';
    import { loadClerk } from '../../lib/clerk.js';

    let loading = true;
    let error = '';
    let pricingNode;

    onMount(async () => {
        try {
            const clerk = await loadClerk();
            await clerk.load();
            await tick();
            if (!pricingNode) {
                throw new Error('Pricing container not found');
            }
            clerk.mountPricingTable(pricingNode);
        } catch (err) {
            error = err.message || 'Unable to load pricing table';
        } finally {
            loading = false;
        }
    });

    onDestroy(() => {
        if (window.Clerk?.unmountPricingTable) {
            if (pricingNode) {
                window.Clerk.unmountPricingTable(pricingNode);
            }
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
    {/if}
    <div id="clerk-pricing" class="pricing-table" bind:this={pricingNode}></div>
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
