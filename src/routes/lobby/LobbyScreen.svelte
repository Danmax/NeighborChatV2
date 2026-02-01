<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { onlineUsersList, onlineContactsList, isAvailable } from '../../stores/presence.js';
    import { upcomingEvents } from '../../stores/events.js';
    import { celebrations } from '../../stores/celebrations.js';
    import { savedContacts } from '../../stores/contacts.js';
    import {
        setupPresenceChannel,
        updatePresenceStatus,
        cleanupChannels
    } from '../../services/realtime.service.js';
    import { fetchEvents } from '../../services/events.service.js';
    import { fetchCelebrations } from '../../services/celebrations.service.js';
    import { fetchContacts } from '../../services/contacts.service.js';
    import OnlineCount from '../../components/users/OnlineCount.svelte';
    import EventCard from '../../components/events/EventCard.svelte';
    import CelebrationCard from '../../components/celebrations/CelebrationCard.svelte';
    import ContactList from '../../components/contacts/ContactList.svelte';

    // Auth routing handled centrally in App.svelte

    $: publicUpcomingEvents = ($upcomingEvents || [])
        .filter(e => e.visibility === 'public' || e.visibility === undefined)
        .slice(0, 3);

    $: recentCelebrations = ($celebrations || []).slice(0, 3);
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
        cleanupChannels();
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
                        <span class="icon">📅</span>
                        Upcoming Events
                    </h3>
                    <a href="#/events" class="see-all-btn">See All</a>
                </div>

                {#if publicUpcomingEvents.length > 0}
                    <div class="events-preview-list">
                        {#each publicUpcomingEvents as event (event.id)}
                            <EventCard {event} compact={true} />
                        {/each}
                    </div>
                {:else}
                    <div class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <p class="empty-state-text">No upcoming events</p>
                    </div>
                {/if}

                <a href="#/events" class="btn btn-secondary btn-full" style="margin-top: 16px; text-decoration: none;">
                    ➕ Create an Event
                </a>
            </div>

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
                            <CelebrationCard
                                {celebration}
                                interactive={false}
                                on:open={() => push(`/celebrations/${celebration.id}`)}
                            />
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
</style>
