<script>
    export let title = '';
    export let description = '';
    export let icon = '✨';
    export let cta = 'Open';
    export let route = '/';
    export let badge = '';
    export let accent = 'sunset';
    export let delay = 0;
</script>

<a
    class="feature-card"
    href={`#${route}`}
    style={`--delay:${delay}ms`}
    data-accent={accent}
>
    <div class="feature-head">
        <div class="feature-icon" aria-hidden="true">{icon}</div>
        {#if badge}
            <span class="feature-badge">{badge}</span>
        {/if}
    </div>

    <h3>{title}</h3>
    <p>{description}</p>

    <div class="feature-cta">{cta} <span aria-hidden="true">→</span></div>
</a>

<style>
    .feature-card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 180px;
        padding: 18px;
        border-radius: 18px;
        border: 1px solid #e7e2d7;
        text-decoration: none;
        color: var(--text);
        background: linear-gradient(140deg, #fff, #faf8f2);
        box-shadow: 0 10px 26px rgba(17, 24, 39, 0.08);
        transform: translateY(8px);
        opacity: 0;
        animation: card-enter 460ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        animation-delay: var(--delay);
        transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
    }

    .feature-card[data-accent='sunset'] {
        background: linear-gradient(150deg, #fff7ec, #ffffff 48%, #fdf4e8);
    }

    .feature-card[data-accent='mint'] {
        background: linear-gradient(150deg, #eefbf5, #ffffff 48%, #e8f8f0);
    }

    .feature-card[data-accent='sky'] {
        background: linear-gradient(150deg, #eef6ff, #ffffff 50%, #ebf3ff);
    }

    .feature-card[data-accent='rose'] {
        background: linear-gradient(150deg, #fff1f4, #ffffff 48%, #ffeef2);
    }

    .feature-card:hover {
        transform: translateY(-3px);
        border-color: #d7ccb4;
        box-shadow: 0 18px 32px rgba(17, 24, 39, 0.13);
    }

    .feature-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .feature-icon {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-size: 20px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(0, 0, 0, 0.06);
    }

    .feature-badge {
        display: inline-flex;
        padding: 5px 10px;
        border-radius: 999px;
        background: #111827;
        color: #f8fafc;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.2px;
    }

    h3 {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
    }

    p {
        margin: 0;
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1.45;
        flex: 1;
    }

    .feature-cta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        color: #8f3a00;
    }

    @keyframes card-enter {
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
</style>
