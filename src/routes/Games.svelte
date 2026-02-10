<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { 
        fetchGameTemplates, 
        fetchGameSessions, 
        fetchLeaderboard,
        getMyMembershipId
    } from '../services/games.service.js';

    let templates = [];
    let sessions = [];
    let myStats = null;
    let loading = true;
    let membershipId = null;

    onMount(async () => {
        loading = true;
        try {
            membershipId = await getMyMembershipId();
            const [tpls, sess, lb] = await Promise.all([
                fetchGameTemplates(),
                fetchGameSessions(),
                fetchLeaderboard({ limit: 1000 })
            ]);
            
            templates = tpls;
            sessions = sess.filter(s => s.status === 'active' || s.status === 'scheduled');
            
            if (membershipId && lb.individual) {
                myStats = lb.individual.find(p => p.membershipId === membershipId);
            }
        } catch (err) {
            console.error("Error loading games data:", err);
        } finally {
            loading = false;
        }
    });

    function handleStartSession(template) {
        // Navigate to session creation or handle logic
        // For now, we can redirect to the sessions tab or open a modal if implemented
        console.log("Starting session for:", template.name);
        // Example: push(`/games/create-session/${template.id}`);
        alert(`Starting a new session for ${template.name}`);
    }

    function joinSession(session) {
        console.log("Joining session:", session.id);
        // Example: push(`/games/session/${session.id}`);
        alert(`Joining session: ${session.name}`);
    }
</script>

<div class="games-page">
    <header class="page-header">
        <h1>Games</h1>
        <p>Play, compete, and track your stats.</p>
    </header>

    {#if loading}
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading games...</p>
        </div>
    {:else}
        <!-- User Profile / Stats -->
        <section class="stats-section">
            <h2>My Stats</h2>
            {#if myStats}
                <div class="stats-card">
                    <div class="stat">
                        <span class="label">Rank</span>
                        <span class="value">#{myStats.rank}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Points</span>
                        <span class="value">{myStats.totalScore}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Wins</span>
                        <span class="value">{myStats.gamesWon}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Win Rate</span>
                        <span class="value">{myStats.winRate}%</span>
                    </div>
                </div>
            {:else}
                <div class="empty-stats">
                    <p>Play your first game to see your stats here!</p>
                </div>
            {/if}
        </section>

        <!-- Active Sessions -->
        <section class="sessions-section">
            <h2>Active Sessions</h2>
            {#if sessions.length === 0}
                <p class="empty-text">No active sessions. Start one below!</p>
            {:else}
                <div class="sessions-list">
                    {#each sessions as session}
                        <div class="session-card">
                            <div class="session-info">
                                <h3>{session.name}</h3>
                                <span class="status-badge {session.status}">{session.status}</span>
                            </div>
                            <button class="btn-primary small" on:click={() => joinSession(session)}>Join</button>
                        </div>
                    {/each}
                </div>
            {/if}
        </section>

        <!-- Start a Game (Templates) -->
        <section class="templates-section">
            <h2>Start a Game</h2>
            <div class="templates-grid">
                {#each templates as template}
                    <div class="template-card">
                        <div class="template-icon">{template.icon}</div>
                        <h3>{template.name}</h3>
                        <p>{template.description || 'No description available.'}</p>
                        <button class="btn-secondary" on:click={() => handleStartSession(template)}>Play</button>
                    </div>
                {/each}
            </div>
        </section>
    {/if}
</div>

<style>
    .games-page { padding: 20px; max-width: 800px; margin: 0 auto; }
    .page-header { margin-bottom: 30px; text-align: center; }
    .page-header h1 { margin: 0; font-size: 2rem; }
    .page-header p { color: #666; margin-top: 5px; }

    section { margin-bottom: 40px; }
    h2 { font-size: 1.2rem; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }

    .stats-card { display: flex; justify-content: space-around; background: #f8f9fa; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .stat { display: flex; flex-direction: column; align-items: center; }
    .stat .label { font-size: 0.85rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat .value { font-size: 1.5rem; font-weight: bold; color: #333; margin-top: 5px; }
    .empty-stats { text-align: center; color: #888; font-style: italic; padding: 20px; background: #f8f9fa; border-radius: 12px; }

    .session-card { display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px; background: white; }
    .session-info h3 { margin: 0 0 5px 0; font-size: 1rem; }
    .status-badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; text-transform: capitalize; }
    .status-badge.active { background: #e6fffa; color: #006040; }
    .status-badge.scheduled { background: #fff8e1; color: #b7791f; }

    .templates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
    .template-card { border: 1px solid #eee; padding: 20px; border-radius: 12px; text-align: center; transition: transform 0.2s; background: white; }
    .template-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .template-icon { font-size: 2.5rem; margin-bottom: 15px; }
    .template-card h3 { margin: 0 0 10px 0; font-size: 1.1rem; }
    .template-card p { font-size: 0.9rem; color: #666; margin-bottom: 20px; min-height: 40px; }

    .btn-primary { background: #0070f3; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-secondary { background: white; color: #333; border: 1px solid #ddd; padding: 8px 16px; border-radius: 6px; cursor: pointer; width: 100%; }
    .btn-secondary:hover { background: #f5f5f5; }
    .empty-text { color: #888; font-style: italic; }
    .loading-state { text-align: center; padding: 40px; color: #666; }
</style>