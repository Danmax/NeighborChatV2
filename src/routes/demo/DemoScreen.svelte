<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';

    let potluckTitle = '';
    let eventType = 'potluck';
    let aiPrompt = '';
    let draft = null;
    let aiWarnings = [];
    let newItem = '';
    let items = ['Salad', 'Chips', 'Sparkling Water'];

    function goToAuth() {
        push('/auth');
    }

    onMount(() => {
        if ($isAuthenticated) {
            push('/');
        }
    });

    function buildPromptFromTitle(title) {
        const cleanTitle = title.trim();
        if (!cleanTitle) return '';
        return `Create a friendly neighborhood potluck event. Title: ${cleanTitle}. Include a short description, set type to ${eventType}, suggest 3 simple items, and choose a fun icon.`;
    }

    function generateDraft() {
        aiWarnings = [];
        aiPrompt = buildPromptFromTitle(potluckTitle);
        if (!aiPrompt) {
            aiWarnings = ['Please enter a title first.'];
            draft = null;
            return;
        }

        if (items.length === 0) {
            const titleLower = potluckTitle.toLowerCase();
            if (titleLower.includes('brunch')) {
                items = ['Pastries', 'Fruit Salad', 'Coffee'];
            } else if (titleLower.includes('bbq') || titleLower.includes('grill')) {
                items = ['Burgers', 'Chips', 'Lemonade'];
            } else if (titleLower.includes('holiday') || titleLower.includes('thanksgiving')) {
                items = ['Stuffing', 'Pumpkin Pie', 'Sparkling Cider'];
            } else {
                items = ['Salad', 'Chips', 'Sparkling Water'];
            }
        }

        draft = {
            title: potluckTitle.trim(),
            description: `Join us for ${potluckTitle.trim()} — share food, stories, and good vibes with neighbors.`,
            type: eventType,
            icon: '🍲',
            items
        };
    }

    function addItem() {
        const value = newItem.trim();
        if (!value) return;
        items = [...items, value];
        newItem = '';
    }

    function removeItem(item) {
        items = items.filter(i => i !== item);
    }
</script>

<div class="demo-page">
    <section class="promo-hero">
        <div class="promo-copy">
            <span class="promo-pill">🍲 Potluck Demo</span>
            <h1>Create a neighborhood potluck in seconds.</h1>
            <p>Type a title and we’ll generate a friendly event template with items and details. Sign up to save and invite neighbors.</p>
            <div class="hero-actions">
                <button class="btn btn-primary" on:click={goToAuth}>Start Free</button>
                <button class="btn btn-secondary" on:click={goToAuth}>Log in</button>
            </div>
        </div>
        <div class="promo-grid single">
            <div class="promo-card wide">
                <h4>Potluck Builder Demo</h4>
                <div class="builder-grid">
                    <div class="builder-panel">
                        <label>Title</label>
                        <input
                            class="demo-input"
                            type="text"
                            placeholder="e.g., Spring Block Potluck"
                            bind:value={potluckTitle}
                        />
                        <label>Type</label>
                        <select class="demo-input" bind:value={eventType}>
                            <option value="potluck">Potluck</option>
                            <option value="social">Social</option>
                            <option value="meetup">Meetup</option>
                        </select>
                        <label>Add Item</label>
                        <div class="item-row">
                            <input class="demo-input" type="text" bind:value={newItem} placeholder="e.g., Dessert" />
                            <button class="btn btn-secondary" on:click={addItem}>Add</button>
                        </div>
                        <div class="pill-list">
                            {#each items as item}
                                <span class="pill">
                                    {item}
                                    <button class="pill-x" on:click={() => removeItem(item)}>✕</button>
                                </span>
                            {/each}
                        </div>
                        {#if aiWarnings.length > 0}
                            <div class="warning">
                                {#each aiWarnings as warning}
                                    <span>⚠️ {warning}</span>
                                {/each}
                            </div>
                        {/if}
                        <button class="btn btn-primary" on:click={generateDraft}>Generate Template</button>
                    </div>
                    <div class="builder-panel">
                        <h4>AI Prompt</h4>
                        <div class="ai-draft">{aiPrompt || 'Your AI prompt will appear here.'}</div>
                        <h4>Template Preview</h4>
                        {#if draft}
                            <div class="template-preview">
                                <div class="template-row"><strong>Title:</strong> {draft.title}</div>
                                <div class="template-row"><strong>Description:</strong> {draft.description}</div>
                                <div class="template-row"><strong>Type:</strong> {draft.type}</div>
                                <div class="template-row"><strong>Icon:</strong> {draft.icon}</div>
                                <div class="template-row"><strong>Items:</strong> {draft.items.join(', ')}</div>
                            </div>
                        {:else}
                            <p class="muted">Generate a template to preview details.</p>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="promo-cta">
        <h2>Ready to invite neighbors?</h2>
        <p>Create an account to save the potluck, add items, and send invites.</p>
        <button class="btn btn-primary" on:click={goToAuth}>Get Started</button>
    </section>
</div>

<style>
    .demo-page {
        padding: 24px 20px 120px;
        max-width: 1100px;
        margin: 0 auto;
        color: var(--text);
    }

    .promo-hero {
        background: radial-gradient(circle at top, #fff7ea 0%, #f2f7ff 55%, #ffffff 100%);
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);
        margin-bottom: 32px;
    }

    .promo-copy h1 {
        font-size: 32px;
        margin-bottom: 12px;
    }

    .promo-copy p {
        color: var(--text-muted);
        margin-bottom: 16px;
    }

    .promo-pill {
        display: inline-flex;
        padding: 6px 12px;
        background: #fff1d6;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 12px;
    }

    .hero-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }

    .promo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-top: 24px;
    }

    .promo-grid.single {
        grid-template-columns: 1fr;
    }

    .promo-card {
        background: white;
        padding: 16px;
        border-radius: 16px;
        box-shadow: 0 10px 24px rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .demo-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        font-size: 14px;
    }

    .ai-draft {
        background: var(--cream);
        padding: 10px;
        border-radius: 12px;
        font-size: 12px;
        display: grid;
        gap: 6px;
    }

    .muted {
        color: var(--text-muted);
        font-size: 12px;
    }

    .promo-cta {
        background: var(--cream);
        padding: 24px;
        border-radius: 16px;
        text-align: center;
    }

    .template-preview {
        background: #fffdf6;
        border: 1px dashed #f1d7a6;
        padding: 12px;
        border-radius: 12px;
        display: grid;
        gap: 8px;
        font-size: 13px;
    }

    .template-row {
        display: grid;
        grid-template-columns: 90px 1fr;
        gap: 6px;
        align-items: start;
    }

    .warning {
        background: #fff4d6;
        padding: 8px 10px;
        border-radius: 10px;
        font-size: 12px;
        display: grid;
        gap: 4px;
    }

    .pill-x {
        border: none;
        background: transparent;
        font-size: 10px;
        cursor: pointer;
        margin-left: 6px;
    }

    .btn {
        padding: 12px 22px;
        border: none;
        border-radius: 999px;
        font-weight: 600;
        cursor: pointer;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-secondary {
        background: white;
        border: 1px solid var(--cream-dark);
        color: var(--text);
    }
</style>
    .promo-card.wide {
        grid-column: 1 / -1;
    }

    .builder-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
    }

    .builder-panel {
        display: grid;
        gap: 10px;
    }

    .item-row {
        display: flex;
        gap: 8px;
        align-items: center;
    }
