<script>
    import { push } from 'svelte-spa-router';
    import EventCard from '../../components/events/EventCard.svelte';
    import CelebrationCard from '../../components/celebrations/CelebrationCard.svelte';

    const demoEvent = {
        id: 'demo_event_devmeetup',
        title: 'Dev Meetup: Build Better Communities',
        type: 'dev-meetup',
        date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().split('T')[0],
        time: '18:30',
        location: 'Community Hub • Main Hall',
        description: 'A friendly dev meetup to share ideas, demos, and build together.',
        created_by: 'Neighbor Chat',
        created_by_id: 'demo',
        attendees: ['demo'],
        visibility: 'public',
        status: 'published',
        cover_image_url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
        event_data: {}
    };

    const demoCelebration = {
        id: 'demo_celebration_goodnews',
        category: 'good-news',
        user_name: 'Community Updates',
        authorName: 'Community Updates',
        author_avatar: { emoji1: '📰', background: '#FFF3E0' },
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        message: 'Good news! The community garden is opening next month.',
        gif_url: 'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif',
        reactions: {},
        comments: []
    };

    const demoMessages = [
        { id: 'm1', name: 'Jordan Lee', snippet: 'Thanks for the invite! See you there.', time: '2m ago' },
        { id: 'm2', name: 'Ava Patel', snippet: 'Can I bring dessert to the potluck?', time: '10m ago' },
        { id: 'm3', name: 'Sam Kim', snippet: 'The meetup deck is ready!', time: '1h ago' }
    ];

    const demoContacts = [
        { id: 'c1', name: 'Jordan Lee', status: 'online' },
        { id: 'c2', name: 'Ava Patel', status: 'away' },
        { id: 'c3', name: 'Sam Kim', status: 'offline' }
    ];

    function goToAuth() {
        push('/auth');
    }
</script>

<div class="demo-page">
    <section class="demo-hero">
        <div class="hero-copy">
            <h1>Explore Neighbor Chat</h1>
            <p>Try a guided, read‑only demo. Sign up to RSVP, chat, and post celebrations.</p>
            <div class="hero-actions">
                <button class="btn btn-primary" on:click={goToAuth}>Sign up free</button>
                <button class="btn btn-secondary" on:click={goToAuth}>Log in</button>
            </div>
        </div>
        <div class="hero-preview">
            <div class="preview-card">
                <h4>Good News</h4>
                <CelebrationCard celebration={demoCelebration} interactive={false} clickable={false} showCommentsPreview={false} />
            </div>
        </div>
    </section>

    <section class="demo-section">
        <div class="section-header">
            <h2>Upcoming Dev Meetup</h2>
            <p>See how events look before you join.</p>
        </div>
        <EventCard event={demoEvent} featured={true} on:click={() => {}} />
    </section>

    <section class="demo-section grid-3">
        <div class="demo-card">
            <h3>Messages Preview</h3>
            <div class="list">
                {#each demoMessages as msg}
                    <div class="list-item">
                        <div>
                            <strong>{msg.name}</strong>
                            <p>{msg.snippet}</p>
                        </div>
                        <span class="time">{msg.time}</span>
                    </div>
                {/each}
            </div>
        </div>

        <div class="demo-card">
            <h3>Contacts Preview</h3>
            <div class="list">
                {#each demoContacts as contact}
                    <div class="list-item">
                        <span class="status-dot {contact.status}"></span>
                        <strong>{contact.name}</strong>
                    </div>
                {/each}
            </div>
        </div>

        <div class="demo-card">
            <h3>AI Draft Preview</h3>
            <p>Prompt: “Family potluck next month, evening, bring‑a‑dish.”</p>
            <div class="ai-draft">
                <div><strong>Title:</strong> Spring Neighborhood Potluck</div>
                <div><strong>Type:</strong> Potluck</div>
                <div><strong>Date:</strong> Next Saturday</div>
                <div><strong>Items:</strong> Salad, Drinks, Dessert</div>
            </div>
            <button class="btn btn-secondary" on:click={goToAuth}>Generate your own</button>
        </div>
    </section>

    <section class="demo-section cta">
        <h2>Ready to join your neighbors?</h2>
        <p>Create an account to RSVP, chat, and celebrate together.</p>
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

    .demo-hero {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 24px;
        align-items: center;
        background: linear-gradient(135deg, #fffaf0, #f0f7ff);
        border-radius: 20px;
        padding: 24px;
        margin-bottom: 32px;
    }

    .hero-copy h1 {
        font-size: 30px;
        margin-bottom: 10px;
    }

    .hero-copy p {
        color: var(--text-muted);
        margin-bottom: 16px;
    }

    .hero-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }

    .preview-card {
        background: white;
        padding: 16px;
        border-radius: 16px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.08);
    }

    .preview-card h4 {
        margin-bottom: 12px;
    }

    .demo-section {
        margin-bottom: 32px;
    }

    .grid-3 {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
    }

    .demo-card {
        background: white;
        padding: 16px;
        border-radius: 16px;
        box-shadow: 0 10px 24px rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .list {
        display: grid;
        gap: 10px;
    }

    .list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: var(--text);
    }

    .list-item p {
        margin: 2px 0 0;
        color: var(--text-muted);
        font-size: 12px;
    }

    .time {
        font-size: 11px;
        color: var(--text-muted);
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #9e9e9e;
        margin-right: 6px;
    }

    .status-dot.online { background: #4CAF50; }
    .status-dot.away { background: #FFC107; }
    .status-dot.offline { background: #9E9E9E; }

    .ai-draft {
        background: var(--cream);
        padding: 10px;
        border-radius: 12px;
        font-size: 12px;
        display: grid;
        gap: 6px;
    }

    .section-header h2 {
        margin-bottom: 6px;
    }

    .section-header p {
        color: var(--text-muted);
    }

    .cta {
        background: var(--cream);
        padding: 24px;
        border-radius: 16px;
        text-align: center;
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
