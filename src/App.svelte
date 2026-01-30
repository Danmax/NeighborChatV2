<script>
    import { onMount, onDestroy } from 'svelte';
    import Router, { push, location } from 'svelte-spa-router';
    import { initSupabase } from './lib/supabase.js';
    import { checkExistingAuth, setupAuthListener } from './services/auth.service.js';
    import { isAuthenticated, currentUser } from './stores/auth.js';
    import { isLoading, setLoading, showTopMenu } from './stores/ui.js';
    import { currentTheme } from './stores/theme.js';
    import { unreadCount } from './stores/notifications.js';
    import { userStatus, isAvailable } from './stores/presence.js';
    import { setupInviteChannel, updatePresenceStatus } from './services/realtime.service.js';
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
    import CelebrationsScreen from './routes/celebrations/CelebrationsScreen.svelte';
    import ContactsScreen from './routes/contacts/ContactsScreen.svelte';
    import NotificationsScreen from './routes/notifications/NotificationsScreen.svelte';
    import OnboardingScreen from './routes/onboarding/OnboardingScreen.svelte';
    import ProfileScreen from './routes/profile/ProfileScreen.svelte';

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
        '/celebrations': CelebrationsScreen,
        '/contacts': ContactsScreen,
        '/notifications': NotificationsScreen,
        '/onboarding': OnboardingScreen,
        '/profile': ProfileScreen,
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

            // Set up auth state listener
            authSubscription = setupAuthListener(({ event, user }) => {
                console.log('Auth event:', event);
                if (event === 'SIGNED_IN' && user) {
                    setupInviteListener();
                }
            });

            ready = true;
            setLoading(false);

            // Show top menu and set up invite listener if authenticated
            if (user) {
                showTopMenu.set(true);
                setupInviteListener();
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
            inviteChannel.unsubscribe();
        }
    });

    function setupInviteListener() {
        inviteChannel = setupInviteChannel((invite) => {
            setPendingInvite(invite);
        });
    }

    function handleAcceptInvite(event) {
        const invite = event.detail;
        clearPendingInvite();
        if (invite?.from?.user_id) {
            push(`/chat/${invite.from.user_id}`);
        }
    }

    function handleDeclineInvite() {
        clearPendingInvite();
    }

    // Handle route conditions
    function conditionsFailed(event) {
        console.log('Route condition failed:', event.detail);
    }

    // Hide footer when in chat mode
    $: isInChatMode = $location?.startsWith('/chat') || $location === '/lobby-chat';
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
            <div class="top-user-menu visible">
                <div class="top-menu-left">
                    <a href="#/profile" class="top-menu-avatar" title="My Profile" style="background: {$currentUser?.avatar?.background || '#E8F5E9'};">
                        {$currentUser?.avatar?.emoji1 || '😊'}
                    </a>
                    <div class="status-selector">
                        <button
                            class="status-toggle"
                            on:click={() => showStatusMenu = !showStatusMenu}
                        >
                            <span class="status-dot" style="background: {getStatusInfo($userStatus).color}"></span>
                            <span class="status-label">{getStatusInfo($userStatus).label}</span>
                            <span class="status-arrow">{showStatusMenu ? '▲' : '▼'}</span>
                        </button>
                        {#if showStatusMenu}
                            <div class="status-menu">
                                {#each STATUS_OPTIONS as option}
                                    <button
                                        class="status-option"
                                        class:active={$userStatus === option.id}
                                        on:click={() => setStatus(option.id)}
                                    >
                                        <span class="status-dot" style="background: {option.color}"></span>
                                        <span>{option.label}</span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
                <div class="top-menu-right">
                    <a href="#/notifications" class="top-menu-btn notification-btn" title="Notifications">
                        🔔
                        {#if $unreadCount > 0}
                            <span class="notification-badge">{$unreadCount > 9 ? '9+' : $unreadCount}</span>
                        {/if}
                    </a>
                    <a href="#/profile" class="top-menu-btn" title="Settings">⚙️</a>
                </div>
            </div>
        {/if}

        <Router {routes} on:conditionsFailed={conditionsFailed} />
    </div>

    <!-- Footer Navigation (hidden in chat mode) -->
    {#if $isAuthenticated && !isInChatMode}
        <footer class="app-footer">
            <a href="#/" class="footer-btn active">
                <span class="footer-icon">🏠</span>
                <span class="footer-label">Home</span>
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
    .notification-btn {
        position: relative;
    }

    .notification-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        background: #F44336;
        color: white;
        font-size: 10px;
        font-weight: 700;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Status Selector Styles */
    .status-selector {
        position: relative;
    }

    .status-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: var(--cream, #F5F5DC);
        border: 1px solid var(--border, #E0E0E0);
        border-radius: 20px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
    }

    .status-toggle:hover {
        background: var(--cream-dark, #EAE0C8);
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .status-label {
        font-weight: 500;
        color: var(--text, #333);
    }

    .status-arrow {
        font-size: 8px;
        color: var(--text-light, #666);
        margin-left: 2px;
    }

    .status-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 4px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        z-index: 100;
        min-width: 140px;
    }

    .status-option {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 14px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 13px;
        color: var(--text, #333);
        transition: background 0.15s ease;
    }

    .status-option:hover {
        background: var(--cream, #F5F5DC);
    }

    .status-option.active {
        background: var(--primary-light, #E8F5E9);
        font-weight: 600;
    }
</style>
