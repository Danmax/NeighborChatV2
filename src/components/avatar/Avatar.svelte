<script>
    import { getAvatarStyle, getAvatarClasses, getAvatarEmoji } from '../../lib/utils/avatar.js';

    export let avatar = null;
    export let size = 'md'; // sm, md, lg, xl
    export let showPresence = false;
    export let online = false;
    export let clickable = false;

    $: style = getAvatarStyle(avatar);
    $: classes = getAvatarClasses(avatar);
    $: emoji = getAvatarEmoji(avatar);
    $: emoji2 = avatar?.emoji2 || null;
    $: emoji3 = avatar?.emoji3 || null;

    const sizes = {
        sm: { width: '36px', height: '36px', fontSize: '18px' },
        md: { width: '48px', height: '48px', fontSize: '24px' },
        lg: { width: '80px', height: '80px', fontSize: '40px' },
        xl: { width: '100px', height: '100px', fontSize: '48px' }
    };

    $: sizeStyles = sizes[size] || sizes.md;
</script>

{#if clickable}
    <button
        type="button"
        class="avatar {classes}"
        class:clickable
        style="
            background: {style.background};
            width: {sizeStyles.width};
            height: {sizeStyles.height};
            font-size: {sizeStyles.fontSize};
            {style.border ? `border: ${style.border};` : ''}
            {style.backgroundImage ? `background-image: ${style.backgroundImage};` : ''}
            {style.backgroundSize ? `background-size: ${style.backgroundSize};` : ''}
        "
        on:click
        on:keypress
        aria-label="User avatar"
    >
        <span class="avatar-emoji">{emoji}</span>

        {#if emoji2}
            <span class="avatar-emoji-2">{emoji2}</span>
        {/if}

        {#if emoji3}
            <span class="avatar-emoji-3">{emoji3}</span>
        {/if}

        {#if showPresence}
            <span class="presence-indicator" class:online></span>
        {/if}
    </button>
{:else}
    <div
        class="avatar {classes}"
        style="
            background: {style.background};
            width: {sizeStyles.width};
            height: {sizeStyles.height};
            font-size: {sizeStyles.fontSize};
            {style.border ? `border: ${style.border};` : ''}
            {style.backgroundImage ? `background-image: ${style.backgroundImage};` : ''}
            {style.backgroundSize ? `background-size: ${style.backgroundSize};` : ''}
        "
        role="img"
        aria-label="User avatar"
    >
        <span class="avatar-emoji">{emoji}</span>

        {#if emoji2}
            <span class="avatar-emoji-2">{emoji2}</span>
        {/if}

        {#if emoji3}
            <span class="avatar-emoji-3">{emoji3}</span>
        {/if}

        {#if showPresence}
            <span class="presence-indicator" class:online></span>
        {/if}
    </div>
{/if}

<style>
    .avatar {
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        flex-shrink: 0;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        border: none;
        padding: 0;
    }

    .avatar.clickable {
        cursor: pointer;
    }

    .avatar.clickable:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .avatar-emoji {
        z-index: 1;
    }

    .avatar-emoji-2 {
        position: absolute;
        top: -5px;
        right: 5px;
        font-size: 0.5em;
    }

    .avatar-emoji-3 {
        position: absolute;
        bottom: -5px;
        left: 5px;
        font-size: 0.42em;
    }

    .presence-indicator {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #9E9E9E;
        border: 2px solid white;
    }

    .presence-indicator.online {
        background: #4CAF50;
    }

    /* Pattern classes */
    .avatar.pattern-dots {
        background-image: radial-gradient(circle, rgba(0, 0, 0, 0.1) 1px, transparent 1px) !important;
        background-size: 8px 8px !important;
    }

    .avatar.pattern-stripes {
        background-image: repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.05) 5px, rgba(0, 0, 0, 0.05) 10px) !important;
    }

    .avatar.pattern-grid {
        background-image: linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px) !important;
        background-size: 10px 10px !important;
    }

    .avatar.pattern-sparkle::after {
        content: '✨';
        position: absolute;
        top: -5px;
        right: -5px;
        font-size: 0.42em;
    }

    /* Border classes */
    .avatar.border-solid {
        border: 4px solid #2D5A47 !important;
    }

    .avatar.border-double {
        border: 6px double #E8A838 !important;
    }

    .avatar.border-dashed {
        border: 4px dashed #667eea !important;
    }

    .avatar.border-rainbow {
        border: 4px solid transparent !important;
        background-clip: padding-box;
    }

    .avatar.border-rainbow::before {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        background: linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3);
        border-radius: 50%;
        z-index: -1;
    }
</style>
