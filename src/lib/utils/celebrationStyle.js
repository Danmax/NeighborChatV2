export const CELEBRATION_MESSAGE_COLORS = [
    { id: 'sunshine', label: 'Sunshine', value: '#FFF4D6' },
    { id: 'mint', label: 'Mint', value: '#E8F8EE' },
    { id: 'sky', label: 'Sky', value: '#E8F2FF' },
    { id: 'blush', label: 'Blush', value: '#FFEAF1' },
    { id: 'lavender', label: 'Lavender', value: '#F3ECFF' },
    { id: 'peach', label: 'Peach', value: '#FFEEDF' }
];

export const CELEBRATION_MESSAGE_PATTERNS = [
    { id: 'none', label: 'None' },
    { id: 'dots', label: 'Dots' },
    { id: 'stripes', label: 'Stripes' },
    { id: 'grid', label: 'Grid' },
    { id: 'sparkle', label: 'Sparkle' }
];

const DEFAULT_COLOR = CELEBRATION_MESSAGE_COLORS[0].value;
const DEFAULT_PATTERN = 'none';

function normalizeColor(color) {
    if (!color) return DEFAULT_COLOR;
    const value = String(color).trim();
    return /^#([0-9a-fA-F]{6})$/.test(value) ? value : DEFAULT_COLOR;
}

function normalizePattern(pattern) {
    const value = String(pattern || '').trim().toLowerCase();
    return CELEBRATION_MESSAGE_PATTERNS.some(p => p.id === value) ? value : DEFAULT_PATTERN;
}

export function getCelebrationMessageStyle(color, pattern) {
    const safeColor = normalizeColor(color);
    const safePattern = normalizePattern(pattern);

    let style = `background-color: ${safeColor};`;

    if (safePattern === 'dots') {
        style += ' background-image: radial-gradient(rgba(255,255,255,0.38) 1px, transparent 1px); background-size: 14px 14px;';
    } else if (safePattern === 'stripes') {
        style += ' background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.24) 0, rgba(255,255,255,0.24) 8px, transparent 8px, transparent 16px);';
    } else if (safePattern === 'grid') {
        style += ' background-image: linear-gradient(rgba(255,255,255,0.26) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.26) 1px, transparent 1px); background-size: 16px 16px;';
    } else if (safePattern === 'sparkle') {
        style += ' background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.65) 0 1.5px, transparent 1.5px), radial-gradient(circle at 70% 45%, rgba(255,255,255,0.5) 0 1.5px, transparent 1.5px), radial-gradient(circle at 45% 70%, rgba(255,255,255,0.58) 0 1px, transparent 1px);';
    }

    return style;
}
