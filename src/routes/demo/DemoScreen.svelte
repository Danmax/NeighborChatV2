<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
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
        user_name: 'Maya Torres',
        authorName: 'Maya Torres',
        author_avatar: { emoji1: '🌻', background: '#FFF8E1' },
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        message: 'Good news! The community garden is opening next month.',
        gif_url: 'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif',
        reactions: {},
        comments: []
    };

    const demoPotluckItems = ['Salad', 'Chips', 'Sparkling Water'];

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

    let showProfileModal = false;
    let showCelebrationModal = false;
    let demoProfile = null;

    function goToAuth() {
        push('/auth');
    }

    onMount(() => {
        if ($isAuthenticated) {
            push('/');
        }
    });

    function openProfile(contact) {
        demoProfile = contact;
        showProfileModal = true;
    }

    function openCelebration() {
        showCelebrationModal = true;
    }

    function closeModals() {
        showProfileModal = false;
        showCelebrationModal = false;
    }
</script>

<div class="demo-page">
    <section class="promo-hero">
        <div class="promo-copy">
            <span class="promo-pill">✨ Social Neighborhood Demo</span>
            <h1>Meet neighbors, plan meetups, and celebrate the good stuff.</h1>
            <p>Explore a lively preview of events, celebrations, chats, and AI‑assisted planning. Sign up to jump in.</p>
            <div class="hero-actions">
                <button class="btn btn-primary" on:click={goToAuth}>Start Free</button>
                <button class="btn btn-secondary" on:click={goToAuth}>Log in</button>
            </div>
        </div>
        <div class="promo-grid">
            <div class="promo-card tall">
                <h4>Good News</h4>
                <CelebrationCard
                    celebration={demoCelebration}
                    interactive={false}
                    clickable={true}
                    showCommentsPreview={false}
                    variant="hero"
                    on:open={openCelebration}
                />
                <button class="btn btn-secondary" on:click={openCelebration}>Open Celebration</button>
            </div>
            <div class="promo-card">
                <h4>Dev Meetup</h4>
                <EventCard event={demoEvent} featured={true} on:click={() => {}} />
            </div>
            <div class="promo-card">
                <h4>AI Draft Preview</h4>
                <p class="muted">Prompt: “Family potluck next month, evening, bring‑a‑dish.”</p>
                <div class="ai-draft">
                    <div><strong>Title:</strong> Spring Neighborhood Potluck</div>
                    <div><strong>Type:</strong> Potluck</div>
                    <div><strong>Date:</strong> Next Saturday</div>
                    <div><strong>Items:</strong> Salad, Drinks, Dessert</div>
                </div>
                <button class="btn btn-secondary" on:click={goToAuth}>Generate your own</button>
            </div>
            <div class="promo-card">
                <h4>Messages</h4>
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
            <div class="promo-card">
                <h4>Contacts</h4>
                <div class="list">
                    {#each demoContacts as contact}
                        <div class="list-item">
                            <span class="status-dot {contact.status}"></span>
                            <strong>{contact.name}</strong>
                            <button class="mini-btn" on:click={() => openProfile(contact)}>View</button>
                        </div>
                    {/each}
                </div>
            </div>
            <div class="promo-card">
                <h4>Potluck Items</h4>
                <p class="muted">Add items by typing and splitting with commas.</p>
                <div class="item-input">
                    <input type="text" value="Salad, Chips, Sparkling Water" readonly />
                    <button class="btn btn-secondary" on:click={goToAuth}>Add Items</button>
                </div>
                <div class="pill-list">
                    {#each demoPotluckItems as item}
                        <span class="pill">{item}</span>
                    {/each}
                </div>
            </div>
        </div>
    </section>

    <section class="promo-cta">
        <h2>Ready to join your neighbors?</h2>
        <p>Create an account to RSVP, chat, and celebrate together.</p>
        <button class="btn btn-primary" on:click={goToAuth}>Get Started</button>
    </section>
</div>

{#if showProfileModal}
    <div class="demo-modal" on:click|self={closeModals}>
        <div class="modal-card">
            <h3>Profile Preview</h3>
            <div class="profile-preview">
                <div class="avatar-circle">👋</div>
                <div>
                    <strong>{demoProfile?.name}</strong>
                    <p class="muted">Neighbor • Active this week</p>
                </div>
            </div>
            <p>“Happy to meet neighbors and join local events!”</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" on:click={closeModals}>Close</button>
                <button class="btn btn-primary" on:click={goToAuth}>Chat</button>
            </div>
        </div>
    </div>
{/if}

{#if showCelebrationModal}
    <div class="demo-modal" on:click|self={closeModals}>
        <div class="modal-card">
            <h3>Celebration Preview</h3>
            <CelebrationCard celebration={demoCelebration} interactive={false} clickable={false} showCommentsPreview={false} variant="hero" />
            <div class="reaction-bar">
                <span>❤️</span>
                <span>🎉</span>
                <span>👏</span>
                <span>✨</span>
                <button class="btn btn-secondary" on:click={goToAuth}>React</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .demo-page {
        padding: 24px 20px 120px;
        max-width: 1100px;
        margin: 0 auto;
        color: var(--text);
    }

    .promo-hero {
        background: radial-gradient(circle at top, #fff7ea 0%, #f2f7ff 55%, #ffffff 100%);
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);
        margin-bottom: 32px;
    }

    .promo-copy h1 {
        font-size: 32px;
        margin-bottom: 12px;
    }

    .promo-copy p {
        color: var(--text-muted);
        margin-bottom: 16px;
    }

    .promo-pill {
        display: inline-flex;
        padding: 6px 12px;
        background: #fff1d6;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 12px;
    }

    .hero-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }

    .promo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-top: 24px;
    }

    .promo-card {
        background: white;
        padding: 16px;
        border-radius: 16px;
        box-shadow: 0 10px 24px rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .promo-card.tall {
        grid-row: span 2;
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

    .mini-btn {
        border: none;
        background: var(--cream);
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
    }

    .item-input {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .item-input input {
        flex: 1;
        padding: 8px 10px;
        border: 1px solid var(--cream-dark);
        border-radius: 10px;
        font-size: 12px;
        background: #fafafa;
    }

    .pill-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
    }

    .pill {
        background: var(--cream);
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
    }

    .ai-draft {
        background: var(--cream);
        padding: 10px;
        border-radius: 12px;
        font-size: 12px;
        display: grid;
        gap: 6px;
    }

    .muted {
        color: var(--text-muted);
        font-size: 12px;
    }

    .promo-cta {
        background: var(--cream);
        padding: 24px;
        border-radius: 16px;
        text-align: center;
    }

    .demo-modal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1400;
        padding: 20px;
    }

    .modal-card {
        background: white;
        padding: 20px;
        border-radius: 16px;
        width: min(520px, 100%);
        display: grid;
        gap: 12px;
    }

    .profile-preview {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .avatar-circle {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: #fff0d9;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
    }

    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    .reaction-bar {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
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
