<script>
    import { createEventDispatcher } from 'svelte';
    import Avatar from './Avatar.svelte';
    import {
        generateRandomAvatar,
        AVATAR_EMOJIS,
        AVATAR_EMOJI2,
        AVATAR_EMOJI3,
        AVATAR_BACKGROUNDS,
        AVATAR_BORDERS,
        AVATAR_PATTERNS
    } from '../../lib/utils/avatar.js';

    export let avatar = {
        emoji1: '😊',
        emoji2: null,
        emoji3: null,
        background: '#E8F5E9',
        border: null,
        pattern: null
    };

    export let compact = false;

    const dispatch = createEventDispatcher();

    function selectEmoji(slot, emoji) {
        if (slot === 1) {
            avatar = { ...avatar, emoji1: emoji };
        } else if (slot === 2) {
            avatar = { ...avatar, emoji2: avatar.emoji2 === emoji ? null : emoji };
        } else if (slot === 3) {
            avatar = { ...avatar, emoji3: avatar.emoji3 === emoji ? null : emoji };
        }
        dispatch('change', avatar);
    }

    function selectBackground(color) {
        avatar = { ...avatar, background: color };
        dispatch('change', avatar);
    }

    function selectBorder(borderId) {
        avatar = { ...avatar, border: avatar.border === borderId ? null : borderId };
        dispatch('change', avatar);
    }

    function selectPattern(patternId) {
        avatar = { ...avatar, pattern: avatar.pattern === patternId ? null : patternId };
        dispatch('change', avatar);
    }

    function randomizeAvatar() {
        avatar = generateRandomAvatar();
        dispatch('change', avatar);
    }
</script>

<div class="avatar-creator" class:compact>
    <!-- Preview -->
    <div class="avatar-preview-container">
        <Avatar {avatar} size="xl" />
        <button class="btn btn-secondary randomize-btn" on:click={randomizeAvatar} title="Generate random avatar">
            🎲 Surprise Me!
        </button>
    </div>

    <!-- Emoji Selection -->
    <fieldset class="avatar-control-group">
        <legend class="control-legend">Main Emoji</legend>
        <div class="emoji-selector">
            {#each AVATAR_EMOJIS as emoji}
                <button
                    class="emoji-select-btn"
                    class:selected={avatar.emoji1 === emoji}
                    on:click={() => selectEmoji(1, emoji)}
                >
                    {emoji}
                </button>
            {/each}
        </div>
    </fieldset>

    {#if !compact}
        <!-- Secondary Emoji -->
        <fieldset class="avatar-control-group">
            <legend class="control-legend">Accessory (top-right)</legend>
            <div class="emoji-selector">
                <button
                    class="emoji-select-btn"
                    class:selected={!avatar.emoji2}
                    on:click={() => selectEmoji(2, null)}
                >
                    ✕
                </button>
                {#each AVATAR_EMOJI2 as emoji}
                    <button
                        class="emoji-select-btn"
                        class:selected={avatar.emoji2 === emoji}
                        on:click={() => selectEmoji(2, emoji)}
                    >
                        {emoji}
                    </button>
                {/each}
            </div>
        </fieldset>

        <!-- Third Emoji -->
        <fieldset class="avatar-control-group">
            <legend class="control-legend">Flair (bottom-left)</legend>
            <div class="emoji-selector">
                <button
                    class="emoji-select-btn"
                    class:selected={!avatar.emoji3}
                    on:click={() => selectEmoji(3, null)}
                >
                    ✕
                </button>
                {#each AVATAR_EMOJI3 as emoji}
                    <button
                        class="emoji-select-btn"
                        class:selected={avatar.emoji3 === emoji}
                        on:click={() => selectEmoji(3, emoji)}
                    >
                        {emoji}
                    </button>
                {/each}
            </div>
        </fieldset>
    {/if}

    <!-- Background Color -->
    <fieldset class="avatar-control-group">
        <legend class="control-legend">Background Color</legend>
        <div class="background-selector">
            {#each AVATAR_BACKGROUNDS as color}
                <button
                    class="bg-select-btn"
                    class:selected={avatar.background === color}
                    style="background: {color};"
                    on:click={() => selectBackground(color)}
                ></button>
            {/each}
        </div>
    </fieldset>

    {#if !compact}
        <!-- Border Style -->
        <fieldset class="avatar-control-group">
            <legend class="control-legend">Border Style</legend>
            <div class="border-selector">
                {#each AVATAR_BORDERS as border}
                    <button
                        class="border-select-btn"
                        class:selected={avatar.border === border.id || (!avatar.border && border.id === 'none')}
                        on:click={() => selectBorder(border.id === 'none' ? null : border.id)}
                    >
                        {border.label}
                    </button>
                {/each}
            </div>
        </fieldset>

        <!-- Pattern Style -->
        <fieldset class="avatar-control-group">
            <legend class="control-legend">Pattern</legend>
            <div class="pattern-selector">
                {#each AVATAR_PATTERNS as pattern}
                    <button
                        class="pattern-select-btn"
                        class:selected={avatar.pattern === pattern.id || (!avatar.pattern && pattern.id === 'none')}
                        on:click={() => selectPattern(pattern.id === 'none' ? null : pattern.id)}
                    >
                        {pattern.label}
                    </button>
                {/each}
            </div>
        </fieldset>
    {/if}
</div>

<style>
    .avatar-creator {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .avatar-creator.compact {
        gap: 12px;
    }

    .avatar-preview-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 20px;
    }

    .randomize-btn {
        font-size: 14px;
        padding: 8px 16px;
        white-space: nowrap;
    }

    .avatar-control-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border: 0;
        padding: 0;
        margin: 0;
        min-width: 0;
    }

    .control-legend {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-light);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
    }

    .emoji-selector {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .emoji-select-btn {
        width: 40px;
        height: 40px;
        border: 2px solid var(--cream-dark);
        border-radius: 8px;
        background: white;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .emoji-select-btn:hover {
        border-color: var(--primary-light);
        transform: scale(1.1);
    }

    .emoji-select-btn.selected {
        border-color: var(--primary);
        background: rgba(45, 90, 71, 0.1);
    }

    .background-selector {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .bg-select-btn {
        width: 40px;
        height: 40px;
        border: 3px solid transparent;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .bg-select-btn:hover {
        transform: scale(1.1);
    }

    .bg-select-btn.selected {
        border-color: var(--primary);
        box-shadow: 0 0 0 2px white, 0 0 0 4px var(--primary);
    }

    .border-selector,
    .pattern-selector {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .border-select-btn,
    .pattern-select-btn {
        padding: 8px 14px;
        border: 2px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        background: white;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .border-select-btn:hover,
    .pattern-select-btn:hover {
        border-color: var(--primary-light);
    }

    .border-select-btn.selected,
    .pattern-select-btn.selected {
        border-color: var(--primary);
        background: rgba(45, 90, 71, 0.1);
    }
</style>
