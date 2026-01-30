<script>
    import { loadingMessage } from '../stores/ui.js';
</script>

<div class="loading-screen">
    <div class="loading-content">
        <div class="logo">
            <div class="logo-icon">🏘️</div>
            <span class="logo-text">Neighbor Chat</span>
        </div>

        <div class="loading-animation">
            <div class="waiting-circles">
                <div class="waiting-circle">🏠</div>
                <div class="waiting-circle">💬</div>
            </div>
        </div>

        <p class="loading-text">{$loadingMessage}</p>

        <div class="spinner"></div>
    </div>
</div>

<style>
    .loading-screen {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--cream);
    }

    .loading-content {
        text-align: center;
        padding: 40px;
    }

    .logo {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 40px;
    }

    .logo-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow: var(--shadow-md);
    }

    .logo-text {
        font-family: 'Fraunces', serif;
        font-size: 28px;
        font-weight: 600;
        color: var(--primary);
    }

    .loading-animation {
        margin-bottom: 30px;
    }

    .waiting-circles {
        display: flex;
        justify-content: center;
        gap: 20px;
    }

    .waiting-circle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow: var(--shadow-md);
        animation: bounce 1.5s ease-in-out infinite;
    }

    .waiting-circle:nth-child(2) {
        animation-delay: 0.2s;
        background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
    }

    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-15px); }
    }

    .loading-text {
        color: var(--text-light);
        font-size: 16px;
        margin-bottom: 20px;
    }

    .spinner {
        width: 32px;
        height: 32px;
        margin: 0 auto;
        border: 3px solid var(--cream-dark);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
</style>
