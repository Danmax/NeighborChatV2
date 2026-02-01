<script>
    import { createEventDispatcher } from 'svelte';
    import { push } from 'svelte-spa-router';
    import Avatar from '../avatar/Avatar.svelte';
    import { getCelebrationCategory, REACTIONS } from '../../stores/celebrations.js';
    import { currentUser } from '../../stores/auth.js';

    export let celebration;
    export let interactive = true;
    export let clickable = true;
    export let showCommentsPreview = true;
    export let variant = 'default';

    const dispatch = createEventDispatcher();

    $: category = getCelebrationCategory(celebration.category);
    $: isOwn = celebration.user_id === $currentUser?.user_id || celebration.authorId === $currentUser?.user_id;
    $: reactionCounts = getReactionCounts(celebration.reactions);
    $: totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
    $: commentCount = celebration.comments?.length || 0;
    $: formattedTime = formatTime(celebration.created_at);
    $: mediaUrl = celebration.gif_url || celebration.image || celebration.image_url;
    $: authorId = celebration.authorId || celebration.user_id;

    function getReactionCounts(reactions = {}) {
        const counts = {};
        Object.entries(reactions).forEach(([emoji, users]) => {
            counts[emoji] = users.length;
        });
        return counts;
    }

    function hasUserReacted(emoji) {
        if (!$currentUser) return false;
        return celebration.reactions?.[emoji]?.includes($currentUser.user_id);
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    function handleReaction(emoji) {
        const hasReacted = hasUserReacted(emoji);
        dispatch('reaction', { celebration, emoji, remove: hasReacted });
    }

    function handleComment() {
        dispatch('comment', celebration);
    }

    function handleEdit() {
        dispatch('edit', celebration);
    }

    function handleOpen(event) {
        if (!clickable) return;
        if (event?.target?.closest('button, a, input, textarea')) {
            return;
        }
        dispatch('open', celebration);
    }

    function handleProfileClick(event) {
        event.stopPropagation();
        if (!authorId || isOwn) return;
        push(`/profile/view/${authorId}`);
    }

    let showReactions = false;

    function toggleReactions(event) {
        event.stopPropagation();
        showReactions = !showReactions;
    }

    function pickReaction(emoji, event) {
        event.stopPropagation();
        showReactions = false;
        handleReaction(emoji);
    }
</script>

<div class="celebration-card" class:clickable on:click={handleOpen}>
    <div class="card-header">
        <button class="user-info" type="button" on:click={handleProfileClick}>
            <Avatar avatar={celebration.user_avatar || celebration.author_avatar || celebration.avatar} size="md" />
            <div class="user-details">
                <span class="user-name">{isOwn ? 'You' : (celebration.user_name || celebration.authorName || 'Neighbor')}</span>
                <span class="post-time">{formattedTime}</span>
            </div>
        </button>
        <div class="category-badge" style="background: {category.emoji === '🎂' ? '#FFB74D' : 'var(--primary)'}">
            {category.emoji}
        </div>
    </div>

    <div class="card-content" class:hero={variant === 'hero'}>
        {#if variant === 'hero'}
            <div class="hero-media">
                {#if mediaUrl}
                    <img src={mediaUrl} alt="Celebration media" loading="lazy" />
                {:else}
                    <div class="hero-fallback"></div>
                {/if}
                <div class="hero-overlay">
                    <div class="hero-meta">
                        <span class="hero-emoji">{category.emoji}</span>
                        {#if celebration.title}
                            <span class="hero-title">{celebration.title}</span>
                        {/if}
                    </div>
                </div>
            </div>
            {#if celebration.message}
                <p class="celebration-message">{celebration.message}</p>
            {/if}
        {:else}
            {#if celebration.title}
                <h3 class="celebration-title">{celebration.title}</h3>
            {/if}

            {#if mediaUrl}
                <div class="celebration-image">
                    <img src={mediaUrl} alt="Celebration media" loading="lazy" />
                </div>
                {#if celebration.message}
                    <p class="celebration-message">{celebration.message}</p>
                {/if}
            {:else}
                {#if celebration.message}
                    <p class="celebration-message">{celebration.message}</p>
                {/if}
                {#if celebration.image}
                    <div class="celebration-image">
                        <img src={celebration.image} alt="Celebration" loading="lazy" />
                    </div>
                {/if}
            {/if}
        {/if}
    </div>

    <!-- Reactions Summary -->
    {#if totalReactions > 0}
        <div class="reactions-summary">
            {#each Object.entries(reactionCounts) as [emoji, count]}
                <span class="reaction-badge" class:active={hasUserReacted(emoji)}>
                    {emoji} {count}
                </span>
            {/each}
        </div>
    {/if}

    <!-- Action Buttons -->
    {#if interactive}
        <div class="card-actions">
            <div class="reaction-picker">
                <button class="reaction-toggle" on:click={toggleReactions}>
                    😊 React
                </button>
                {#if showReactions}
                    <div class="reaction-menu">
                        {#each REACTIONS as emoji}
                            <button
                                class="reaction-btn"
                                class:active={hasUserReacted(emoji)}
                                on:click={(event) => pickReaction(emoji, event)}
                                title={emoji}
                            >
                                {emoji}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="action-buttons">
                <button class="comment-btn" on:click={handleComment}>
                    💬 {commentCount > 0 ? commentCount : ''}
                </button>
                {#if isOwn}
                    <button class="edit-btn" on:click={handleEdit}>
                        ✏️ Edit
                    </button>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Comments Preview -->
    {#if interactive && showCommentsPreview && celebration.comments?.length > 0}
        <div class="comments-preview">
            {#each celebration.comments.slice(-2) as comment}
                <div class="comment-item">
                    <Avatar avatar={comment.user_avatar} size="sm" />
                    <div class="comment-content">
                        <span class="comment-author">{comment.user_name}</span>
                        {#if comment.gif_url}
                            <img class="comment-gif" src={comment.gif_url} alt="Reply GIF" loading="lazy" />
                        {/if}
                        {#if comment.message || comment.text}
                            <span class="comment-text">{comment.message || comment.text}</span>
                        {/if}
                    </div>
                </div>
            {/each}
            {#if celebration.comments.length > 2}
                <button class="view-all-comments" on:click={handleComment}>
                    View all {celebration.comments.length} comments
                </button>
            {/if}
        </div>
    {/if}
</div>

<style>
    .celebration-card {
        background: white;
        border-radius: var(--radius-md);
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .celebration-card.clickable {
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .celebration-card.clickable:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    }

    .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
    }

    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        background: none;
        border: none;
        padding: 0;
        text-align: left;
        cursor: pointer;
    }

    .user-details {
        display: flex;
        flex-direction: column;
    }

    .user-name {
        font-weight: 600;
        color: var(--text);
        font-size: 14px;
    }

    .post-time {
        font-size: 12px;
        color: var(--text-muted);
    }

    .category-badge {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
    }

    .card-content {
        padding: 0 16px 16px;
    }

    .celebration-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text);
        margin-bottom: 8px;
    }

    .celebration-message {
        font-size: 14px;
        color: var(--text-light);
        line-height: 1.5;
        white-space: pre-wrap;
    }

    .celebration-image {
        margin-top: 12px;
        border-radius: var(--radius-sm);
        overflow: hidden;
        background: #f5f5f5;
    }

    .celebration-image img {
        width: 100%;
        height: auto;
        max-height: 420px;
        display: block;
        object-fit: contain;
    }

    .reactions-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 16px 12px;
    }

    .reaction-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: var(--cream);
        border-radius: 100px;
        font-size: 12px;
    }

    .reaction-badge.active {
        background: var(--primary-light);
    }

    .card-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-top: 1px solid var(--cream-dark);
    }

    .reaction-picker {
        display: flex;
        gap: 4px;
        position: relative;
    }

    .reaction-toggle {
        padding: 8px 12px;
        border: none;
        background: var(--cream);
        border-radius: 20px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .reaction-toggle:hover {
        background: var(--cream-dark);
    }

    .reaction-menu {
        position: absolute;
        bottom: 44px;
        left: 0;
        display: flex;
        gap: 6px;
        padding: 8px;
        background: white;
        border-radius: 999px;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15);
        border: 1px solid var(--cream-dark);
        z-index: 10;
    }

    .reaction-btn {
        width: 36px;
        height: 36px;
        border: none;
        background: var(--cream);
        border-radius: 50%;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .reaction-btn:hover {
        background: var(--cream-dark);
        transform: scale(1.1);
    }

    .reaction-btn.active {
        background: var(--primary-light);
    }

    .comment-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 16px;
        border: none;
        background: var(--cream);
        border-radius: 20px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .comment-btn:hover {
        background: var(--cream-dark);
    }

    .action-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .edit-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        border: none;
        background: var(--cream);
        border-radius: 20px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .edit-btn:hover {
        background: var(--cream-dark);
    }

    .comments-preview {
        padding: 12px 16px;
        background: var(--cream);
        border-top: 1px solid var(--cream-dark);
    }

    .comment-item {
        display: flex;
        gap: 10px;
        margin-bottom: 8px;
    }

    .comment-item:last-of-type {
        margin-bottom: 0;
    }

    .comment-content {
        flex: 1;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .comment-author {
        font-weight: 600;
        color: var(--text);
        margin-right: 6px;
    }

    .comment-text {
        color: var(--text-light);
    }

    .comment-gif {
        width: 100%;
        max-height: 180px;
        border-radius: 8px;
        object-fit: cover;
    }

    .view-all-comments {
        display: block;
        width: 100%;
        margin-top: 8px;
        padding: 8px;
        border: none;
        background: none;
        color: var(--primary);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
    }

    .view-all-comments:hover {
        text-decoration: underline;
    }
</style>
<style>
    .card-content.hero {
        padding: 0 16px 16px;
    }

    .hero-media {
        position: relative;
        border-radius: var(--radius-sm);
        overflow: hidden;
        margin-bottom: 12px;
        background: #f5f5f5;
    }

    .hero-media img {
        width: 100%;
        display: block;
        height: 260px;
        object-fit: cover;
    }

    .hero-fallback {
        height: 200px;
        background: linear-gradient(135deg, #f5f5f5, #e9e9e9);
    }

    .hero-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%);
        display: flex;
        align-items: flex-end;
        padding: 14px;
    }

    .hero-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        color: white;
        font-weight: 600;
    }

    .hero-emoji {
        font-size: 20px;
    }

    .hero-title {
        font-size: 16px;
    }
</style>
