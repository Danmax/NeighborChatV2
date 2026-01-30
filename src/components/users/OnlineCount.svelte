<script>
    import { onlineCount } from '../../stores/presence.js';
</script>

<div class="user-count">
    <span class="user-count-number">{$onlineCount}</span>
    <span class="user-count-label">
        {$onlineCount === 1 ? 'neighbor' : 'neighbors'} online
    </span>
</div>

<style>
    .user-count {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 16px;
        background: rgba(45, 90, 71, 0.05);
        border-radius: var(--radius-sm);
    }

    .user-count-number {
        font-family: 'Fraunces', serif;
        font-size: 28px;
        font-weight: 700;
        color: var(--primary);
    }

    .user-count-label {
        color: var(--text-light);
        font-size: 14px;
    }
</style>
