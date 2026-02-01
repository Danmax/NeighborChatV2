<script>
    import { onMount, onDestroy } from 'svelte';
    import { slide, fly } from 'svelte/transition';
    import Router, { push, location } from 'svelte-spa-router';
    import { initSupabase } from './lib/supabase.js';
    import { checkExistingAuth, setupAuthListener } from './services/auth.service.js';
    import { isAuthenticated, currentUser } from './stores/auth.js';
    import { isLoading, setLoading, showTopMenu, authInitialized } from './stores/ui.js';
    import { currentTheme } from './stores/theme.js';
    import { unreadCount } from './stores/notifications.js';
    import { userStatus, isAvailable } from './stores/presence.js';
    import { setupInviteChannel, updatePresenceStatus, sendInviteResponse, cleanupInviteChannel } from './services/realtime.service.js';
    import { setPendingInvite, pendingInvite, clearPendingInvite } from './stores/chat.js';

    // Status options
    const STATUS_OPTIONS = [
        { id: 'available', label: 'Online', color: '#4CAF50' },
        { id: 'away', label: 'Away', color: '#FFC107' },
        { id: 'busy', label: 'Busy', color: '#F44336' },
        { id: 'meeting', label: 'In Meeting', color: '#9C27B0' },
        { id: 'offline', label: 'Offline', color: '#9E9E9E' }
    ];

    let showStatusMenu = false;
    let showSidebar = true;

    function getStatusInfo(status) {
        return STATUS_OPTIONS.find(s => s.id === status) || STATUS_OPTIONS[4];
    }

    function setStatus(status) {
        updatePresenceStatus(status);
        showStatusMenu = false;
    }

    // Import route components
    import LoadingScreen from './routes/LoadingScreen.svelte';
    import AuthScreen from './routes/auth/AuthScreen.svelte';
    import LobbyScreen from './routes/lobby/LobbyScreen.svelte';
    import FindMatchScreen from './routes/lobby/FindMatchScreen.svelte';
    import LobbyChatScreen from './routes/lobby/LobbyChatScreen.svelte';
    import ChatScreen from './routes/chat/ChatScreen.svelte';
    import EventsScreen from './routes/events/EventsScreen.svelte';
    import EventDetailScreen from './routes/events/EventDetailScreen.svelte';
    import CelebrationsScreen from './routes/celebrations/CelebrationsScreen.svelte';
    import CelebrationDetailScreen from './routes/celebrations/CelebrationDetailScreen.svelte';
    import ContactsScreen from './routes/contacts/ContactsScreen.svelte';
    import NotificationsScreen from './routes/notifications/NotificationsScreen.svelte';
    import MessagesScreen from './routes/messages/MessagesScreen.svelte';
    import ThreadScreen from './routes/messages/ThreadScreen.svelte';
    import OnboardingScreen from './routes/onboarding/OnboardingScreen.svelte';
    import ProfileScreen from './routes/profile/ProfileScreen.svelte';
    import PublicProfileScreen from './routes/profile/PublicProfileScreen.svelte';

    // Import UI components
    import InviteModal from './components/ui/InviteModal.svelte';
    import ToastContainer from './components/ui/ToastContainer.svelte';

    // Route definitions
    const routes = {
        '/': LobbyScreen,
        '/auth': AuthScreen,
        '/lobby': LobbyScreen,
        '/find-match': FindMatchScreen,
        '/lobby-chat': LobbyChatScreen,
        '/chat/:id': ChatScreen,
        '/events': EventsScreen,
        '/events/:id': EventDetailScreen,
        '/celebrations': CelebrationsScreen,
        '/celebrations/:id': CelebrationDetailScreen,
        '/contacts': ContactsScreen,
        '/notifications': NotificationsScreen,
        '/messages': MessagesScreen,
        '/messages/:id': ThreadScreen,
        '/onboarding': OnboardingScreen,
        '/profile': ProfileScreen,
        '/profile/view/:userId': PublicProfileScreen,
        '*': LobbyScreen // Fallback
    };

    let ready = false;
    let authSubscription = null;
    let inviteChannel = null;

    onMount(async () => {
        try {
            setLoading(true, 'Initializing...');

            // Initialize Supabase
            await initSupabase();

            // Check for existing auth
            const user = await checkExistingAuth();

            // Signal that initial auth check is complete
            authInitialized.set(true);
            console.log('🔐 Auth initialization complete');

            // Set up auth state listener with onboarding routing
            authSubscription = setupAuthListener(({ event, user, shouldOnboard }) => {
                console.log('Auth event:', event);

                if (event === 'SIGNED_IN' && user) {
                    setupInviteListener();

                    if (shouldOnboard) {
                        console.log('New user detected - redirecting to onboarding');
                        showTopMenu.set(false);
                        push('/onboarding');
                    } else {
                        console.log('Returning user - showing lobby');
                        showTopMenu.set(true);
                        // Only navigate if currently on auth screen
                        if ($location === '/auth') {
                            push('/');
                        }
                    }
                }
            });

            ready = true;
            setLoading(false);

            // Check if onboarding needed for existing session
            if (user) {
                if (user.isNewUser || !user.onboardingCompleted) {
                    console.log('Existing session needs onboarding');
                    showTopMenu.set(false);
                    push('/onboarding');
                } else {
                    showTopMenu.set(true);
                    setupInviteListener();
                }
            }

        } catch (error) {
            console.error('App initialization failed:', error);
            setLoading(false);
            ready = true;
        }
    });

    onDestroy(() => {
        if (authSubscription) {
            authSubscription.unsubscribe();
        }
        if (inviteChannel) {
            cleanupInviteChannel();
        }
    });

    function setupInviteListener() {
        inviteChannel = setupInviteChannel((invite) => {
            setPendingInvite(invite);
        });
    }

    async function handleAcceptInvite(event) {
        const invite = event.detail;

        // Send accept response back to sender
        if (invite?.responseChannel && invite?.from) {
            try {
                await sendInviteResponse(invite.responseChannel, true, invite.from);
            } catch (err) {
                console.error('Failed to send accept response:', err);
            }
        }

        clearPendingInvite();

        if (invite?.from?.user_id) {
            push(`/chat/${invite.from.user_id}`);
        }
    }

    async function handleDeclineInvite(event) {
        const invite = event?.detail || $pendingInvite;

        // Send decline response back to sender
        if (invite?.responseChannel && invite?.from) {
            try {
                await sendInviteResponse(invite.responseChannel, false, invite.from);
            } catch (err) {
                console.error('Failed to send decline response:', err);
            }
        }

        clearPendingInvite();
    }

    // Handle route conditions
    function conditionsFailed(event) {
        console.log('Route condition failed:', event.detail);
    }

    // Hide footer when in chat mode
    $: isInChatMode = $location?.startsWith('/chat') || $location === '/lobby-chat' || $location?.startsWith('/messages/');
    $: if (isInChatMode) {
        showSidebar = false;
    } else {
        showSidebar = true;
    }

    // Enforce onboarding before access
    $: if ($isAuthenticated && $currentUser && !$currentUser.onboardingCompleted && $location !== '/onboarding') {
        showTopMenu.set(false);
        push('/onboarding');
    }
</script>

{#if $isLoading || !ready}
    <LoadingScreen />
{:else}
    <div class="app-container">
        <header class="header">
            <a href="#/" class="logo">
                <div class="logo-icon">🏘️</div>
                <span class="logo-text">Neighbor Chat</span>
            </a>
            <p class="tagline">Connect with neighbors, one chat at a time</p>
        </header>

        {#if $isAuthenticated && $showTopMenu}
            <nav class="top-nav" transition:slide={{ duration: 200 }}>
                <div class="nav-left">
                    <a href="#/profile" class="avatar-link" title="My Profile">
                        <div class="avatar-wrapper" style="background: {$currentUser?.avatar?.background || '#E8F5E9'};">
                            <span class="avatar-emoji">{$currentUser?.avatar?.emoji1 || '😊'}</span>
                        </div>
                        <span class="user-name">{$currentUser?.name || 'User'}</span>
                    </a>
                </div>

                <div class="nav-center">
                    <div class="status-pill" class:open={showStatusMenu}>
                        <button class="status-trigger" on:click={() => showStatusMenu = !showStatusMenu}>
                            <span class="status-indicator" style="--status-color: {getStatusInfo($userStatus).color}"></span>
                            <span class="status-text">{getStatusInfo($userStatus).label}</span>
                            <svg class="chevron" class:rotated={showStatusMenu} viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                            </svg>
                        </button>

                        {#if showStatusMenu}
                            <div class="status-dropdown" transition:fly={{ y: -10, duration: 150 }}>
                                {#each STATUS_OPTIONS as option}
                                    <button
                                        class="status-item"
                                        class:active={$userStatus === option.id}
                                        on:click={() => setStatus(option.id)}
                                    >
                                        <span class="status-indicator" style="--status-color: {option.color}"></span>
                                        <span class="status-name">{option.label}</span>
                                        {#if $userStatus === option.id}
                                            <span class="check-icon">✓</span>
                                        {/if}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="nav-right">
                    <a href="#/notifications" class="nav-icon-btn" class:has-badge={$unreadCount > 0} title="Notifications">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        {#if $unreadCount > 0}
                            <span class="badge">{$unreadCount > 9 ? '9+' : $unreadCount}</span>
                        {/if}
                    </a>
                    <a href="#/profile" class="nav-icon-btn" title="Settings">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                    </a>
                </div>
            </nav>
        {/if}

        <Router {routes} on:conditionsFailed={conditionsFailed} />
    </div>

    <!-- Footer Navigation (hidden in chat mode) -->
    {#if $isAuthenticated}
        <footer class="app-footer" class:collapsed={isInChatMode && !showSidebar}>
            <a href="#/" class="footer-btn active">
                <span class="footer-icon">🏠</span>
                <span class="footer-label">Home</span>
            </a>
            <a href="#/messages" class="footer-btn">
                <span class="footer-icon">✉️</span>
                <span class="footer-label">Messages</span>
            </a>
            <a href="#/events" class="footer-btn">
                <span class="footer-icon">📅</span>
                <span class="footer-label">Events</span>
            </a>
            <a href="#/celebrations" class="footer-btn">
                <span class="footer-icon">🎉</span>
                <span class="footer-label">Celebrate</span>
            </a>
            <a href="#/contacts" class="footer-btn">
                <span class="footer-icon">👥</span>
                <span class="footer-label">Contacts</span>
            </a>
            <a href="#/profile" class="footer-btn">
                <span class="footer-icon">👤</span>
                <span class="footer-label">Profile</span>
            </a>
        </footer>
        {#if isInChatMode}
            <button class="sidebar-toggle" on:click={() => showSidebar = !showSidebar} title="Toggle menu">
                {showSidebar ? '⮞' : '⮜'}
            </button>
        {/if}
    {/if}

    <!-- Chat Invite Modal -->
    <InviteModal
        show={$pendingInvite !== null}
        invite={$pendingInvite}
        on:accept={handleAcceptInvite}
        on:decline={handleDeclineInvite}
    />

    <!-- Toast Notifications -->
    <ToastContainer />
{/if}

<style>
    /* Modern Top Navigation - Glassmorphism */
    .top-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        position: sticky;
        top: 0;
        z-index: 100;
        border-radius: var(--radius-md, 16px);
        margin: 0 0 16px;
        box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.06));
    }

    .nav-left, .nav-right {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .nav-center {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
    }

    /* Avatar Link */
    .avatar-link {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        padding: 4px 12px 4px 4px;
        border-radius: 24px;
        transition: background 0.2s ease;
    }

    .avatar-link:hover {
        background: rgba(0, 0, 0, 0.04);
    }

    .avatar-wrapper {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .user-name {
        font-weight: 600;
        font-size: 14px;
        color: var(--text);
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Status Pill */
    .status-pill {
        position: relative;
    }

    .status-trigger {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 24px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        color: var(--text);
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .status-trigger:hover {
        background: var(--cream);
        border-color: rgba(0, 0, 0, 0.12);
    }

    .status-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--status-color);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
    }

    .status-text {
        color: var(--text);
    }

    .chevron {
        color: var(--text-muted);
        transition: transform 0.2s ease;
    }

    .chevron.rotated {
        transform: rotate(180deg);
    }

    /* Status Dropdown */
    .status-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        min-width: 160px;
        padding: 6px;
        z-index: 200;
    }

    .status-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        color: var(--text);
        transition: background 0.15s ease;
    }

    .status-item:hover {
        background: var(--cream);
    }

    .status-item.active {
        background: var(--primary-light, #E8F5E9);
        font-weight: 600;
    }

    .status-name {
        flex: 1;
    }

    .check-icon {
        color: var(--primary);
        font-weight: bold;
    }

    /* Navigation Icon Buttons */
    .nav-icon-btn {
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        color: var(--text-muted);
        transition: all 0.2s ease;
        text-decoration: none;
    }

    .nav-icon-btn:hover {
        background: var(--cream);
        color: var(--text);
    }

    .nav-icon-btn svg {
        width: 22px;
        height: 22px;
    }

    /* Notification Badge */
    .badge {
        position: absolute;
        top: 2px;
        right: 2px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        background: #F44336;
        color: white;
        font-size: 10px;
        font-weight: 700;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Responsive adjustments */
    @media (max-width: 480px) {
        .user-name {
            display: none;
        }

        .nav-center {
            position: static;
            transform: none;
        }

        .status-text {
            display: none;
        }

        .status-trigger {
            padding: 8px 10px;
        }
    }
</style>
