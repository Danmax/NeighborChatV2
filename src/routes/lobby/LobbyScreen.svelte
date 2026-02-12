<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { onlineUsersList, onlineContactsList, isAvailable } from '../../stores/presence.js';
    import { upcomingEvents } from '../../stores/events.js';
    import { celebrations, getCelebrationCategory } from '../../stores/celebrations.js';
    import { savedContacts } from '../../stores/contacts.js';
    import { setupPresenceChannel, updatePresenceStatus } from '../../services/realtime.service.js';
    import { fetchEvents } from '../../services/events.service.js';
    import { fetchCelebrations } from '../../services/celebrations.service.js';
    import { fetchContacts } from '../../services/contacts.service.js';
    import { fetchFavoriteMovies } from '../../services/profile.service.js';
    import { getCelebrationPseudoDate } from '../../lib/utils/celebrationDates.js';
    import OnlineCount from '../../components/users/OnlineCount.svelte';
    import FeatureCard from '../../components/home/FeatureCard.svelte';

    let favoriteMovies = [];
    let moviesLoading = false;
    let moviesLoadedFor = null;

    const quickActions = [
        { label: 'Share Kudos', icon: '🎉', route: '/celebrations' },
        { label: 'Plan Event', icon: '📅', route: '/events?create=1' },
        { label: 'Start 1:1 Chat', icon: '💬', route: '/find-match' },
        { label: 'Share Recipe', icon: '🥘', route: '/recipes' }
    ];

    $: publicUpcomingEvents = ($upcomingEvents || [])
        .filter((event) => (event.visibility === 'public' || event.visibility === undefined) && event.status !== 'draft')
        .slice(0, 3);

    $: recentCelebrations = ($celebrations || []).slice(0, 4);
    $: recentConnections = ($savedContacts || []).slice(0, 4);
    $: kudosCount = ($celebrations || []).filter((item) => (item.category || item.type || '').toLowerCase() === 'kudos').length;
    $: birthdayAnniversaryCount = ($celebrations || []).filter((item) => {
        const key = (item.category || item.type || '').toLowerCase();
        return key.includes('birthday') || key.includes('anniversary');
    }).length;

    $: featureCards = [
        {
            title: 'Celebrate Kudos',
            description: 'Highlight wins and gratitude moments with rich celebration posts.',
            icon: '🏆',
            cta: 'Open celebrations',
            route: '/celebrations',
            badge: kudosCount > 0 ? `${kudosCount} kudos posts` : 'Start now',
            accent: 'sunset'
        },
        {
            title: 'Event Manager',
            description: 'Create gatherings, track RSVPs, and keep event details in one place.',
            icon: '📅',
            cta: 'Manage events',
            route: '/events',
            badge: publicUpcomingEvents.length > 0 ? `${publicUpcomingEvents.length} upcoming` : '',
            accent: 'mint'
        },
        {
            title: '1 on 1 Chat',
            description: 'Find someone available now and jump into a direct conversation.',
            icon: '💬',
            cta: 'Find a match',
            route: '/find-match',
            badge: ($onlineContactsList || []).length > 0 ? `${($onlineContactsList || []).length} contacts online` : '',
            accent: 'sky'
        },
        {
            title: 'Share Recipes',
            description: 'Post your best dishes and discover what your community is cooking.',
            icon: '🥘',
            cta: 'Browse recipes',
            route: '/recipes',
            badge: '',
            accent: 'sunset'
        },
        {
            title: 'Your Favorite Movies',
            description: 'Show your movie tastes and spark conversations around favorites.',
            icon: '🎬',
            cta: 'Update favorites',
            route: '/profile',
            badge: favoriteMovies.length > 0 ? `${favoriteMovies.length} saved` : '',
            accent: 'rose'
        },
        {
            title: 'Music Celebration',
            description: 'Set your current track and celebrate moments with your soundtrack.',
            icon: '🎵',
            cta: 'Set your track',
            route: '/profile',
            badge: $currentUser?.spotify_track_url ? 'Track selected' : '',
            accent: 'mint'
        },
        {
            title: 'Game Management',
            description: 'Run games, score sessions, and manage teams and tournaments.',
            icon: '🎮',
            cta: 'Open games',
            route: '/games',
            badge: '',
            accent: 'sky'
        },
        {
            title: 'Birthdays and Anniversaries',
            description: 'Make milestone moments visible so nobody misses a special day.',
            icon: '🎂',
            cta: 'Celebrate milestones',
            route: '/celebrations',
            badge: birthdayAnniversaryCount > 0 ? `${birthdayAnniversaryCount} upcoming` : '',
            accent: 'rose'
        }
    ];

    onMount(() => {
        if ($isAuthenticated) {
            setupPresenceChannel();
            fetchEvents();
            fetchCelebrations();
            fetchContacts();
            loadFavoriteMovies();
        }
    });

    $: {
        const profileKey = $currentUser?.user_uuid || $currentUser?.user_id || null;
        if ($isAuthenticated && profileKey && moviesLoadedFor !== profileKey && !moviesLoading) {
            loadFavoriteMovies(profileKey);
        }
    }

    async function loadFavoriteMovies(profileKey = null) {
        const userKey = profileKey || $currentUser?.user_uuid || $currentUser?.user_id;
        if (!userKey) return;

        moviesLoading = true;
        try {
            favoriteMovies = await fetchFavoriteMovies(userKey);
            moviesLoadedFor = userKey;
        } catch (error) {
            console.error('Failed to load favorite movies:', error);
            favoriteMovies = [];
            moviesLoadedFor = userKey;
        } finally {
            moviesLoading = false;
        }
    }

    function toggleAvailability() {
        const newStatus = $isAvailable ? 'away' : 'available';
        updatePresenceStatus(newStatus);
    }

    function goTo(route) {
        push(route);
    }

    function formatEventDate(rawDate) {
        if (!rawDate) return 'Date TBD';
        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return 'Date TBD';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    function getCelebrationMeta(celebration) {
        const pseudoDate = getCelebrationPseudoDate(celebration.category || celebration.type, celebration.celebration_date);
        if (!pseudoDate) return 'Moment worth celebrating';
        return `${pseudoDate.primary} ${pseudoDate.secondary}`.trim();
    }
</script>

{#if $isAuthenticated}
    <div class="home-screen">
        <section class="hero-shell">
            <div class="hero-content">
                <p class="hero-kicker">Community Home</p>
                <h1>Welcome back, {$currentUser?.name || 'Neighbor'}.</h1>
                <p class="hero-subtitle">Celebrate achievements, run events, chat 1 on 1, and keep your community's stories in one place.</p>

                <div class="hero-actions">
                    <button class="btn btn-primary" on:click={() => goTo('/celebrations')}>🎉 Start celebrating</button>
                    <button class="btn btn-secondary" on:click={() => goTo('/messages')}>✉️ Open messages</button>
                </div>

                <div class="hero-stats">
                    <span>{($onlineUsersList || []).length} neighbors online</span>
                    <span>{publicUpcomingEvents.length} upcoming events</span>
                    <span>{recentCelebrations.length} recent celebrations</span>
                </div>
            </div>

            <div class="hero-side">
                <OnlineCount />
                <button class="availability-btn" class:available={$isAvailable} on:click={toggleAvailability}>
                    <span class="status-dot" class:online={$isAvailable}></span>
                    {$isAvailable ? 'Available for 1:1 Match' : 'Set as Available'}
                </button>
                <button class="btn btn-ghost" on:click={() => goTo('/find-match')}>🔍 Find a match now</button>
            </div>
        </section>

        <section class="section-block">
            <div class="section-header">
                <h2>Main Features</h2>
                <p>Everything you asked to spotlight, ready from one homepage.</p>
            </div>

            <div class="features-grid">
                {#each featureCards as card, index (card.title)}
                    <FeatureCard
                        title={card.title}
                        description={card.description}
                        icon={card.icon}
                        cta={card.cta}
                        route={card.route}
                        badge={card.badge}
                        accent={card.accent}
                        delay={index * 50}
                    />
                {/each}
            </div>
        </section>

        <section class="section-block">
            <div class="section-header">
                <h2>What's Happening Now</h2>
                <p>Quick live view of celebrations, events, and chat activity.</p>
            </div>

            <div class="live-grid">
                <article class="panel">
                    <div class="panel-head">
                        <h3>Celebrate Kudos</h3>
                        <a href="#/celebrations">See all</a>
                    </div>
                    {#if recentCelebrations.length === 0}
                        <p class="empty-text">No celebrations yet.</p>
                    {:else}
                        <div class="list-stack">
                            {#each recentCelebrations as celebration (celebration.id)}
                                {@const celebrationType = getCelebrationCategory(celebration.category || celebration.type)}
                                <button class="list-item" on:click={() => goTo(`/celebrations/${celebration.id}`)}>
                                    <span class="list-icon">{celebrationType.emoji}</span>
                                    <span class="list-copy">
                                        <strong>{celebration.title || celebrationType.label}</strong>
                                        <small>{getCelebrationMeta(celebration)}</small>
                                    </span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </article>

                <article class="panel">
                    <div class="panel-head">
                        <h3>Event Manager</h3>
                        <a href="#/events">See all</a>
                    </div>
                    {#if publicUpcomingEvents.length === 0}
                        <p class="empty-text">No upcoming events.</p>
                    {:else}
                        <div class="list-stack">
                            {#each publicUpcomingEvents as event (event.id)}
                                <button class="list-item" on:click={() => goTo(`/events/${event.id}`)}>
                                    <span class="list-icon">📍</span>
                                    <span class="list-copy">
                                        <strong>{event.title || 'Untitled event'}</strong>
                                        <small>{formatEventDate(event.event_date || event.start_time || event.starts_at)}</small>
                                    </span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </article>

                <article class="panel">
                    <div class="panel-head">
                        <h3>1 on 1 Chat</h3>
                        <a href="#/messages">Open inbox</a>
                    </div>
                    <div class="chat-pulse">
                        <div class="pulse-row">
                            <span class="pulse-dot"></span>
                            <span>{($onlineContactsList || []).length} contacts online right now</span>
                        </div>
                        <div class="pulse-row">
                            <span class="pulse-dot"></span>
                            <span>{recentConnections.length} recent connections available for follow-up</span>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-full" on:click={() => goTo('/find-match')}>Start a 1 on 1 chat</button>
                </article>
            </div>
        </section>

        <section class="section-block">
            <div class="section-header">
                <h2>Quick Actions</h2>
                <p>Fast paths to your most common tasks.</p>
            </div>
            <div class="quick-row">
                {#each quickActions as action (action.label)}
                    <a class="quick-action" href={`#${action.route}`}>
                        <span>{action.icon}</span>
                        <span>{action.label}</span>
                    </a>
                {/each}
            </div>
        </section>

        <section class="section-block">
            <div class="section-header">
                <h2>Your Personal Picks</h2>
                <p>Movie favorites and music celebration status from your profile.</p>
            </div>

            <div class="personal-grid">
                <article class="panel">
                    <div class="panel-head">
                        <h3>Your Favorite Movies</h3>
                        <a href="#/profile">Manage</a>
                    </div>
                    {#if moviesLoading}
                        <p class="empty-text">Loading favorites...</p>
                    {:else if favoriteMovies.length === 0}
                        <p class="empty-text">No favorite movies yet. Add them from profile.</p>
                    {:else}
                        <div class="movie-grid">
                            {#each favoriteMovies.slice(0, 4) as movie (movie.id)}
                                <div class="movie-card" title={movie.title}>
                                    {#if movie.poster_url}
                                        <img src={movie.poster_url} alt={movie.title} loading="lazy" />
                                    {:else}
                                        <div class="movie-fallback">🎬</div>
                                    {/if}
                                    <small>{movie.title}</small>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </article>

                <article class="panel">
                    <div class="panel-head">
                        <h3>Music Celebration</h3>
                        <a href="#/profile">Manage</a>
                    </div>
                    {#if $currentUser?.spotify_track_url}
                        <p class="music-link">{$currentUser.spotify_track_url}</p>
                        <a class="btn btn-secondary btn-full" href={$currentUser.spotify_track_url} target="_blank" rel="noopener noreferrer">Open current track</a>
                    {:else}
                        <p class="empty-text">No music track selected yet. Add one in profile.</p>
                        <a class="btn btn-secondary btn-full" href="#/profile">Set music celebration</a>
                    {/if}
                </article>
            </div>
        </section>
    </div>
{/if}

<style>
    .home-screen {
        display: grid;
        gap: 18px;
        padding-bottom: 28px;
    }

    .hero-shell {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 18px;
        padding: 24px;
        border-radius: 24px;
        background:
            radial-gradient(circle at 12% 16%, rgba(255, 188, 88, 0.22), transparent 45%),
            radial-gradient(circle at 92% 86%, rgba(83, 196, 159, 0.2), transparent 38%),
            linear-gradient(130deg, #f9fbff, #fff8ef);
        border: 1px solid #eadfd0;
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
    }

    .hero-kicker {
        margin: 0 0 6px;
        display: inline-flex;
        padding: 6px 11px;
        border-radius: 999px;
        background: #fff1d6;
        color: #9f4b00;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.4px;
    }

    h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 40px);
        line-height: 1.1;
    }

    .hero-subtitle {
        margin: 10px 0 0;
        color: var(--text-muted);
        max-width: 60ch;
        line-height: 1.5;
    }

    .hero-actions {
        margin-top: 20px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .hero-stats {
        margin-top: 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .hero-stats span {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid #ebdfcd;
        font-size: 12px;
        font-weight: 600;
        color: #69533a;
    }

    .hero-side {
        padding: 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid #eadfce;
        display: flex;
        flex-direction: column;
        gap: 14px;
        justify-content: center;
    }

    .availability-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid #d7d2c9;
        border-radius: 999px;
        background: #fff;
        color: var(--text);
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 180ms ease;
    }

    .availability-btn.available {
        border-color: #3d9d74;
        background: #edf9f3;
        color: #1e6a4f;
    }

    .status-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #9ca3af;
    }

    .status-dot.online {
        background: #2ca56f;
        box-shadow: 0 0 0 4px rgba(44, 165, 111, 0.15);
    }

    .section-block {
        background: #fff;
        border: 1px solid #eee6d8;
        border-radius: 20px;
        padding: 20px;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }

    .section-header {
        margin-bottom: 14px;
    }

    .section-header h2 {
        margin: 0;
        font-size: 22px;
    }

    .section-header p {
        margin: 6px 0 0;
        color: var(--text-muted);
        font-size: 14px;
    }

    .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
    }

    .live-grid,
    .personal-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 12px;
    }

    .panel {
        background: linear-gradient(135deg, #fff, #faf8f4);
        border: 1px solid #e9dfd0;
        border-radius: 14px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    }

    .panel-head h3 {
        margin: 0;
        font-size: 16px;
    }

    .panel-head a {
        color: #a14a00;
        text-decoration: none;
        font-size: 12px;
        font-weight: 700;
    }

    .list-stack {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .list-item {
        text-align: left;
        width: 100%;
        border: 1px solid #e9dece;
        background: #fff;
        border-radius: 12px;
        padding: 10px;
        display: flex;
        gap: 9px;
        cursor: pointer;
    }

    .list-icon {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        background: #fff6e7;
        flex-shrink: 0;
    }

    .list-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .list-copy strong,
    .list-copy small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .list-copy strong {
        font-size: 13px;
    }

    .list-copy small {
        color: var(--text-muted);
        font-size: 11px;
    }

    .chat-pulse {
        display: grid;
        gap: 8px;
        margin-bottom: 4px;
    }

    .pulse-row {
        display: flex;
        gap: 8px;
        align-items: center;
        font-size: 13px;
        color: var(--text);
    }

    .pulse-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #f97316;
        box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.45);
        animation: pulse 1.8s infinite;
    }

    .quick-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
    }

    .quick-action {
        text-decoration: none;
        color: var(--text);
        border: 1px solid #e8dece;
        border-radius: 12px;
        padding: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: linear-gradient(150deg, #fff, #fff7ec);
        font-weight: 700;
        font-size: 13px;
    }

    .movie-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }

    .movie-card {
        display: grid;
        gap: 6px;
    }

    .movie-card img,
    .movie-fallback {
        width: 100%;
        aspect-ratio: 2 / 3;
        border-radius: 10px;
        border: 1px solid #e5dccd;
        object-fit: cover;
    }

    .movie-fallback {
        display: grid;
        place-items: center;
        background: #faf5ea;
    }

    .movie-card small {
        font-size: 12px;
        color: var(--text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .music-link {
        margin: 0;
        padding: 10px;
        border-radius: 10px;
        background: #f8f7f3;
        border: 1px solid #e8e1d4;
        font-size: 12px;
        color: #475569;
        word-break: break-all;
    }

    .empty-text {
        margin: 0;
        color: var(--text-muted);
        font-size: 13px;
    }

    .btn {
        border: none;
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .btn:hover {
        transform: translateY(-1px);
    }

    .btn-primary {
        background: linear-gradient(135deg, #f97316, #c2410c);
        color: #fff;
        box-shadow: 0 10px 22px rgba(249, 115, 22, 0.25);
    }

    .btn-secondary {
        background: #fff6e7;
        color: #8f3a00;
        border: 1px solid #f0d7b3;
    }

    .btn-ghost {
        background: #fff;
        color: var(--text);
        border: 1px solid #d8d2c6;
    }

    .btn-full {
        width: 100%;
    }

    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.45);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(249, 115, 22, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
        }
    }

    @media (max-width: 960px) {
        .hero-shell {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 640px) {
        .home-screen {
            gap: 14px;
        }

        .hero-shell,
        .section-block {
            padding: 16px;
            border-radius: 16px;
        }

        .features-grid,
        .live-grid,
        .personal-grid {
            grid-template-columns: 1fr;
        }

        .quick-row {
            grid-template-columns: 1fr 1fr;
        }
    }
</style>
