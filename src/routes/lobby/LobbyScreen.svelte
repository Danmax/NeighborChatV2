<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { onlineUsersList, onlineContactsList, isAvailable } from '../../stores/presence.js';
    import { upcomingEvents } from '../../stores/events.js';
    import { celebrations } from '../../stores/celebrations.js';
    import { savedContacts } from '../../stores/contacts.js';
    import { getCelebrationCategory } from '../../stores/celebrations.js';
    import {
        setupPresenceChannel,
        updatePresenceStatus
    } from '../../services/realtime.service.js';
    import { fetchEvents } from '../../services/events.service.js';
    import { fetchCelebrations } from '../../services/celebrations.service.js';
    import { fetchContacts } from '../../services/contacts.service.js';
    import { getCelebrationPseudoDate } from '../../lib/utils/celebrationDates.js';
    import { getCelebrationMessageStyle } from '../../lib/utils/celebrationStyle.js';
    import OnlineCount from '../../components/users/OnlineCount.svelte';
    import EventCard from '../../components/events/EventCard.svelte';
    import ContactList from '../../components/contacts/ContactList.svelte';

    // Auth routing handled centrally in App.svelte

    $: publicUpcomingEvents = ($upcomingEvents || [])
        .filter(e => (e.visibility === 'public' || e.visibility === undefined) && e.status !== 'draft')
        .slice(0, 3);

    $: recentCelebrations = ($celebrations || []);
    $: recentConnections = ($savedContacts || []).slice(0, 3);


    onMount(() => {
        if ($isAuthenticated) {
            setupPresenceChannel();
            fetchEvents();
            fetchCelebrations();
            fetchContacts();
        }
    });

    onDestroy(() => {
        // Presence is global; avoid tearing down on navigation
    });

    function toggleAvailability() {
        const newStatus = $isAvailable ? 'away' : 'available';
        updatePresenceStatus(newStatus);
    }

    function goToFindMatch() {
        push('/find-match');
    }

    function openMessageThread(event) {
        const contact = event.detail;
        if (contact?.user_id) {
            push(`/messages/${contact.user_id}`);
        }
    }
</script>

{#if $isAuthenticated}
    <div class="home-screen">
        <div class="card hero-card">
            <div class="hero-header">
                <div>
                    <h2 class="card-title">Welcome, {$currentUser?.name || 'Neighbor'}!</h2>
                    <p class="hero-subtitle">Find real-time matches and stay connected.</p>
                </div>
                <OnlineCount />
            </div>

            <div class="availability-section">
                <button
                    class="availability-btn"
                    class:available={$isAvailable}
                    on:click={toggleAvailability}
                >
                    <span class="status-dot" class:online={$isAvailable}></span>
                    {$isAvailable ? 'Available for 1:1 Match' : 'Set as Available'}
                </button>
            </div>

            <div class="hero-actions">
                <button class="btn btn-primary btn-full" on:click={goToFindMatch}>
                    🔍 Find a Match Now
                </button>
                <div class="hero-stats">
                    <span>{($onlineUsersList || []).length} neighbors online</span>
                    <span>·</span>
                    <span>{($onlineContactsList || []).length} contacts online</span>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <span class="icon">🎉</span>
                        Celebrations
                    </h3>
                    <a href="#/celebrations" class="see-all-btn">See All</a>
                </div>

                {#if recentCelebrations.length > 0}
                    <div class="celebrations-preview">
                        {#each recentCelebrations as celebration (celebration.id)}
                            {@const pseudoDate = getCelebrationPseudoDate(
                                celebration.category || celebration.type,
                                celebration.celebration_date
                            )}
                            {@const celebrationType = getCelebrationCategory(celebration.category || celebration.type)}
                            {@const mediaSrc = celebration.gif_url || celebration.image || celebration.image_url}
                            {@const hasGif = !!celebration.gif_url}
                            <button
                                type="button"
                                class="celebration-feed-card"
                                on:click={() => push(`/celebrations/${celebration.id}`)}
                            >
                                <div class="feed-media" class:has-gif={hasGif}>
                                    {#if mediaSrc}
                                        <img
                                            src={mediaSrc}
                                            alt="Celebration media"
                                            loading="lazy"
                                            class:gif-media={hasGif}
                                        />
                                    {:else}
                                        <div
                                            class="media-fallback"
                                            style={getCelebrationMessageStyle(celebration.message_bg_color, celebration.message_bg_pattern)}
                                        >
                                            <span>{celebrationType.emoji}</span>
                                        </div>
                                    {/if}
                                    <div class="feed-type">
                                        <span class="feed-emoji">{celebrationType.emoji}</span>
                                        <span class="feed-type-label">{celebrationType.label}</span>
                                    </div>
                                </div>

                                <div class="feed-body">
                                    {#if celebration.title}
                                        <h3 class="feed-title">{celebration.title}</h3>
                                    {:else}
                                        <h3 class="feed-title">Kudos</h3>
                                    {/if}

                                    {#if pseudoDate}
                                        <div class="feed-pseudo-date">
                                            <span class="feed-pseudo-primary">{pseudoDate.primary}</span>
                                            <span class="feed-pseudo-secondary">{pseudoDate.secondary}</span>
                                        </div>
                                    {/if}

                                    {#if celebration.message}
                                        <p
                                            class="feed-message"
                                            style={getCelebrationMessageStyle(celebration.message_bg_color, celebration.message_bg_pattern)}
                                        >
                                            {celebration.message}
                                        </p>
                                    {/if}
                                </div>

                                <div class="feed-type-footer">
                                    <span class="feed-type-footer-icon">{celebrationType.emoji}</span>
                                    <span class="feed-type-footer-label">{celebrationType.label}</span>
                                </div>
                            </button>
                        {/each}
                    </div>
                {:else}
                    <div class="empty-state">
                        <div class="empty-state-icon">🎊</div>
                        <p class="empty-state-text">No celebrations yet</p>
                    </div>
                {/if}

                <a href="#/celebrations" class="btn btn-secondary btn-full" style="margin-top: 16px; text-decoration: none;">
                    ✨ Share Kudos
                </a>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <span class="icon">📅</span>
                        Upcoming Events
                    </h3>
                    <a href="#/events" class="see-all-btn">See All</a>
                </div>

                {#if publicUpcomingEvents.length > 0}
                    <div class="events-preview-list">
                        {#each publicUpcomingEvents as event (event.id)}
                            <EventCard {event} compact={true} on:click={() => push(`/events/${event.id}`)} />
                        {/each}
                    </div>
                {:else}
                    <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <p class="empty-state-text">No upcoming events</p>
                    </div>
                {/if}

                <a href="#/events?create=1" class="btn btn-secondary btn-full" style="margin-top: 16px; text-decoration: none;">
                    ➕ Create an Event
                </a>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <span class="icon">🤝</span>
                        Recent Connections
                    </h3>
                    <a href="#/contacts" class="see-all-btn">View Contacts</a>
                </div>

                <ContactList
                    contacts={recentConnections}
                    emptyMessage="No recent connections yet"
                    emptyIcon="👥"
                    showInterests={false}
                    compact={true}
                    menuMode="recent"
                    on:chat={openMessageThread}
                    on:click={openMessageThread}
                />

                <a href="#/messages" class="btn btn-secondary btn-full" style="margin-top: 16px; text-decoration: none;">
                    ✉️ Open Messages
                </a>
            </div>

        </div>
    </div>
{/if}

<style>
    .home-screen {
        padding-bottom: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .card {
        background: white;
        border-radius: var(--radius-md);
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .hero-card {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(255, 255, 255, 0.9));
        border: 1px solid rgba(76, 175, 80, 0.15);
    }

    .hero-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
    }

    .hero-subtitle {
        margin: 6px 0 0;
        color: var(--text-muted);
        font-size: 14px;
    }

    .availability-section {
        display: flex;
        justify-content: center;
        margin: 16px 0;
    }

    .availability-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 24px;
        border: 2px solid var(--cream-dark);
        border-radius: 100px;
        background: white;
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .availability-btn:hover {
        border-color: var(--primary-light);
    }

    .availability-btn.available {
        background: #E8F5E9;
        border-color: #4CAF50;
        color: #2E7D32;
    }

    .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #9E9E9E;
        transition: background 0.2s ease;
    }

    .status-dot.online {
        background: #4CAF50;
    }

    .hero-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .hero-stats {
        display: flex;
        justify-content: center;
        gap: 8px;
        font-size: 12px;
        color: var(--text-muted);
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .card-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 18px;
        font-weight: 700;
        color: var(--text);
        margin: 0;
    }

    .icon {
        font-size: 22px;
    }

    .see-all-btn {
        background: none;
        border: none;
        color: var(--primary);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
        text-decoration: none;
    }

    .see-all-btn:hover {
        color: var(--primary-dark);
    }

    .events-preview-list,
    .celebrations-preview {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .celebrations-preview {
        max-height: 560px;
        overflow-y: auto;
        padding-right: 4px;
    }

    .celebration-feed-card {
        background: white;
        border-radius: var(--radius-md);
        overflow: hidden;
        border: 1px solid var(--cream-dark);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        text-align: left;
        padding: 0;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        display: flex;
        flex-direction: column;
        width: 100%;
    }

    .celebration-feed-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
    }

    .feed-media {
        position: relative;
        background: #f4f4f4;
        overflow: hidden;
    }

    .feed-media img {
        width: 100%;
        display: block;
        background: #f4f4f4;
    }

    .feed-media:not(.has-gif) {
        aspect-ratio: 16 / 9;
    }

    .feed-media:not(.has-gif) img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .feed-media.has-gif {
        overflow: visible;
    }

    .feed-media img.gif-media {
        width: 100%;
        height: auto;
        max-height: none;
        object-fit: contain;
    }

    .media-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 42px;
        color: var(--text-muted);
        background: linear-gradient(135deg, #f5f5f5, #e9e9e9);
    }

    .feed-type {
        position: absolute;
        left: 12px;
        bottom: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 0, 0, 0.65);
        color: white;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
    }

    .feed-emoji {
        font-size: 14px;
    }

    .feed-body {
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .feed-title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--text);
    }

    .feed-message {
        margin: 0;
        font-size: 13px;
        color: var(--text-light);
        line-height: 1.5;
        border-radius: 10px;
        border: 1px solid var(--cream-dark);
        padding: 8px 10px;
        max-height: 3.6em;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    .feed-pseudo-date {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--cream-dark);
        background: var(--cream);
    }

    .feed-pseudo-primary {
        font-size: 12px;
        font-weight: 700;
        color: var(--text);
    }

    .feed-pseudo-secondary {
        font-size: 11px;
        color: var(--text-muted);
    }

    .feed-type-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid var(--cream-dark);
        background: var(--cream);
        color: var(--text);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
    }

    .feed-type-footer-icon {
        font-size: 15px;
        line-height: 1;
    }

    .feed-type-footer-label {
        line-height: 1;
    }

    .empty-state {
        text-align: center;
        padding: 30px 20px;
        color: var(--text-muted);
    }

    .empty-state-icon {
        font-size: 40px;
        margin-bottom: 12px;
    }

    .empty-state-text {
        font-size: 14px;
    }


    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-primary:hover {
        background: var(--primary-dark);
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-secondary:hover {
        background: var(--cream-dark);
    }

    .btn-full {
        width: 100%;
    }

    @media (max-width: 768px) {
        .celebrations-preview {
            max-height: 440px;
        }

        .feed-media:not(.has-gif) {
            aspect-ratio: 4 / 3;
        }
    }
</style>
