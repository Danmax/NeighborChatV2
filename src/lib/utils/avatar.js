// Avatar generation utilities

const EMOJIS = ['😊', '🌟', '🎨', '🚀', '🌈', '🎭', '🎪', '🎯', '🎲', '🎸', '🎹', '🎺', '🎻'];
const BACKGROUNDS = ['#E8F5E9', '#E3F2FD', '#FFF3E0', '#F3E5F5', '#FCE4EC', '#E0F2F1'];

/**
 * Generate a random avatar
 */
export function generateRandomAvatar() {
    return {
        emoji1: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        background: BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
    };
}

/**
 * Get avatar style object for rendering
 */
export function getAvatarStyle(avatar) {
    if (!avatar) {
        avatar = generateRandomAvatar();
    }

    const style = {
        background: avatar.background || '#E8F5E9'
    };

    // Handle patterns
    if (avatar.pattern === 'dots') {
        style.backgroundImage = 'radial-gradient(circle, rgba(0, 0, 0, 0.1) 1px, transparent 1px)';
        style.backgroundSize = '8px 8px';
    } else if (avatar.pattern === 'stripes') {
        style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0, 0, 0, 0.05) 5px, rgba(0, 0, 0, 0.05) 10px)';
    } else if (avatar.pattern === 'grid') {
        style.backgroundImage = 'linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)';
        style.backgroundSize = '10px 10px';
    }

    // Handle borders
    if (avatar.border === 'solid') {
        style.border = '4px solid #2D5A47';
    } else if (avatar.border === 'double') {
        style.border = '6px double #E8A838';
    } else if (avatar.border === 'dashed') {
        style.border = '4px dashed #667eea';
    }

    return style;
}

/**
 * Get CSS classes for avatar patterns
 */
export function getAvatarClasses(avatar) {
    const classes = [];

    if (avatar?.pattern) {
        classes.push(`pattern-${avatar.pattern}`);
    }

    if (avatar?.border) {
        classes.push(`border-${avatar.border}`);
    }

    return classes.join(' ');
}

/**
 * Get the main emoji from an avatar
 */
export function getAvatarEmoji(avatar) {
    return avatar?.emoji1 || '😊';
}

/**
 * Available emoji options for avatar creator
 */
export const AVATAR_EMOJIS = [
    '😊', '😎', '🤓', '🥳', '😄', '🤗', '🌟', '✨',
    '🎨', '🎭', '🎪', '🎯', '🎲', '🎸', '🌈', '🌸',
    '🍕', '☕', '🎮', '📚', '🏃', '🧘', '🎾', '⚽',
    '🐕', '🐱', '🦊', '🐻', '🦁', '🐼', '🦋', '🌺'
];

/**
 * Available background colors
 */
export const AVATAR_BACKGROUNDS = [
    '#E8F5E9', '#E3F2FD', '#FFF3E0', '#F3E5F5',
    '#FCE4EC', '#E0F2F1', '#FFF8E1', '#F1F8E9',
    '#E8EAF6', '#FFEBEE', '#E0F7FA', '#F9FBE7'
];

/**
 * Available border styles
 */
export const AVATAR_BORDERS = [
    { id: 'none', label: 'None' },
    { id: 'solid', label: '🟢 Solid' },
    { id: 'double', label: '🟡 Double' },
    { id: 'dashed', label: '🔵 Dashed' },
    { id: 'rainbow', label: '🌈 Rainbow' }
];

/**
 * Available pattern styles
 */
export const AVATAR_PATTERNS = [
    { id: 'none', label: 'None' },
    { id: 'dots', label: '⚫ Dots' },
    { id: 'stripes', label: '📏 Stripes' },
    { id: 'grid', label: '📐 Grid' },
    { id: 'sparkle', label: '✨ Sparkle' }
];
