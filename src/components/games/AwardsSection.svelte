<script>
    import { onMount } from 'svelte';
    import {
        gameAwards,
        playerAwards,
        awardsLoading,
        awardsByCategory,
        AWARD_CATEGORIES,
        AWARD_RARITIES,
        getAwardRarityInfo
    } from '../../stores/games.js';
    import { fetchGameAwards, fetchPlayerAwards } from '../../services/games.service.js';

    export let membershipId = null; // null = current user
    export let compact = false;

    let activeCategory = 'all';
    let selectedAward = null;

    $: earnedAwardIds = new Set($playerAwards.map(pa => pa.awardId));
    $: earnedCount = earnedAwardIds.size;
    $: totalCount = $gameAwards.length;

    $: filteredAwards = activeCategory === 'all'
        ? $gameAwards
        : $gameAwards.filter(a => a.category === activeCategory);

    function isEarned(awardId) {
        return earnedAwardIds.has(awardId);
    }

    function getEarnedInfo(awardId) {
        return $playerAwards.find(pa => pa.awardId === awardId);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function handleAwardClick(award) {
        selectedAward = selectedAward?.id === award.id ? null : award;
    }

    onMount(async () => {
        await Promise.all([
            fetchGameAwards(),
            fetchPlayerAwards(membershipId)
        ]);
    });
</script>

<div class="awards-section" class:compact>
    <!-- Progress Header -->
    <div class="awards-header">
        <div class="progress-info">
            <span class="progress-text">{earnedCount} of {totalCount} awards earned</span>
            <div class="progress-bar">
                <div
                    class="progress-fill"
                    style="width: {totalCount > 0 ? (earnedCount / totalCount * 100) : 0}%"
                ></div>
            </div>
        </div>
    </div>

    <!-- Category Tabs -->
    {#if !compact}
        <div class="category-tabs">
            <button
                class="tab"
                class:active={activeCategory === 'all'}
                on:click={() => activeCategory = 'all'}
            >
                All
            </button>
            {#each AWARD_CATEGORIES as cat}
                <button
                    class="tab"
                    class:active={activeCategory === cat.id}
                    on:click={() => activeCategory = cat.id}
                >
                    {cat.icon} {cat.label}
                </button>
            {/each}
        </div>
    {/if}

    <!-- Awards Grid -->
    {#if $awardsLoading}
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading awards...</p>
        </div>
    {:else if filteredAwards.length === 0}
        <div class="empty-state">
            <span class="empty-icon">🎖️</span>
            <p>No awards available in this category</p>
        </div>
    {:else}
        <div class="awards-grid">
            {#each filteredAwards as award}
                {@const earned = isEarned(award.id)}
                {@const earnedInfo = earned ? getEarnedInfo(award.id) : null}
                {@const rarityInfo = getAwardRarityInfo(award.rarity)}
                <button
                    class="award-card"
                    class:earned
                    class:selected={selectedAward?.id === award.id}
                    style="--rarity-color: {rarityInfo.color}"
                    on:click={() => handleAwardClick(award)}
                >
                    <div class="award-icon" class:locked={!earned}>
                        {award.icon}
                        {#if !earned}
                            <span class="lock">🔒</span>
                        {/if}
                    </div>
                    <div class="award-name">{award.name}</div>
                    <div class="award-rarity">{rarityInfo.label}</div>
                    {#if earned && earnedInfo}
                        <div class="earned-badge">✓ Earned</div>
                    {/if}
                </button>
            {/each}
        </div>

        <!-- Selected Award Detail -->
        {#if selectedAward}
            {@const earned = isEarned(selectedAward.id)}
            {@const earnedInfo = earned ? getEarnedInfo(selectedAward.id) : null}
            {@const rarityInfo = getAwardRarityInfo(selectedAward.rarity)}
            <div class="award-detail" style="--rarity-color: {rarityInfo.color}">
                <div class="detail-header">
                    <span class="detail-icon">{selectedAward.icon}</span>
                    <div class="detail-title">
                        <h4>{selectedAward.name}</h4>
                        <span class="detail-rarity">{rarityInfo.label} • {selectedAward.pointsValue} pts</span>
                    </div>
                </div>
                <p class="detail-description">{selectedAward.description}</p>
                {#if earned && earnedInfo}
                    <div class="earned-info">
                        <span class="earned-date">Earned on {formatDate(earnedInfo.awardedAt)}</span>
                    </div>
                {:else if !selectedAward.isAutomatic}
                    <div class="unlock-hint">
                        <span>🎯 This award is granted manually by admins</span>
                    </div>
                {:else}
                    <div class="unlock-hint">
                        <span>🎯 Keep playing to unlock this award!</span>
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    .awards-section {
        padding: 0;
    }

    .awards-header {
        margin-bottom: 16px;
    }

    .progress-info {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .progress-text {
        font-size: 14px;
        font-weight: 600;
        color: #333;
    }

    .progress-bar {
        height: 8px;
        background: #f0f0f0;
        border-radius: 4px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4CAF50, #8BC34A);
        border-radius: 4px;
        transition: width 0.5s ease;
    }

    .category-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
    }

    .tab {
        padding: 6px 12px;
        border: none;
        border-radius: 16px;
        background: #f0f0f0;
        font-size: 12px;
        font-weight: 600;
        color: #666;
        cursor: pointer;
        transition: all 0.2s;
    }

    .tab:hover {
        background: #e0e0e0;
    }

    .tab.active {
        background: #4CAF50;
        color: white;
    }

    .loading-state,
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f0f0f0;
        border-top-color: #4CAF50;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 12px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .empty-icon {
        font-size: 48px;
        display: block;
        margin-bottom: 12px;
    }

    .awards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
    }

    .compact .awards-grid {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 8px;
    }

    .award-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px 12px;
        background: white;
        border: 2px solid #f0f0f0;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
    }

    .compact .award-card {
        padding: 12px 8px;
    }

    .award-card:hover {
        border-color: #ddd;
        transform: translateY(-2px);
    }

    .award-card.selected {
        border-color: var(--rarity-color);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .award-card.earned {
        background: linear-gradient(135deg, white 0%, color-mix(in srgb, var(--rarity-color) 8%, white) 100%);
        border-color: var(--rarity-color);
    }

    .award-card:not(.earned) {
        filter: grayscale(0.8);
        opacity: 0.7;
    }

    .award-card:not(.earned):hover {
        filter: grayscale(0.5);
        opacity: 0.85;
    }

    .award-icon {
        font-size: 32px;
        margin-bottom: 8px;
        position: relative;
    }

    .compact .award-icon {
        font-size: 24px;
        margin-bottom: 6px;
    }

    .award-icon.locked .lock {
        position: absolute;
        bottom: -4px;
        right: -8px;
        font-size: 14px;
    }

    .award-name {
        font-size: 12px;
        font-weight: 600;
        color: #333;
        text-align: center;
        line-height: 1.2;
        margin-bottom: 4px;
    }

    .compact .award-name {
        font-size: 11px;
    }

    .award-rarity {
        font-size: 10px;
        color: var(--rarity-color);
        font-weight: 600;
        text-transform: uppercase;
    }

    .earned-badge {
        position: absolute;
        top: 6px;
        right: 6px;
        font-size: 10px;
        background: #4CAF50;
        color: white;
        padding: 2px 6px;
        border-radius: 8px;
        font-weight: 600;
    }

    .award-detail {
        background: white;
        border: 2px solid var(--rarity-color);
        border-radius: 12px;
        padding: 16px;
    }

    .detail-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .detail-icon {
        font-size: 40px;
    }

    .detail-title h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: #333;
    }

    .detail-rarity {
        font-size: 12px;
        color: var(--rarity-color);
        font-weight: 600;
    }

    .detail-description {
        margin: 0 0 12px;
        font-size: 14px;
        color: #555;
        line-height: 1.4;
    }

    .earned-info {
        padding: 8px 12px;
        background: #e8f5e9;
        border-radius: 8px;
    }

    .earned-date {
        font-size: 13px;
        color: #2E7D32;
        font-weight: 500;
    }

    .unlock-hint {
        padding: 8px 12px;
        background: #f5f5f5;
        border-radius: 8px;
        font-size: 13px;
        color: #666;
    }
</style>
