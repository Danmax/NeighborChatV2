<script>
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated } from '../../stores/auth.js';
    import { showToast } from '../../stores/toasts.js';
    import {
        isPlatformAdmin,
        canManageEventAccess,
        fetchAppSettings,
        upsertAppSetting,
        fetchStatusOptions,
        deleteStatusOption,
        fetchInterestOptions,
        upsertInterestOption,
        deleteInterestOption,
        fetchEventManagerRequests,
        reviewEventManagerRequest,
        getUsageMetrics,
        getDatabaseStatus,
        fetchMyCommunityInstance,
        fetchManagedCommunityInstances,
        createCommunityInstance,
        updateMyCommunityInstanceSettings
    } from '../../services/admin.service.js';
    import { fetchAllFeedback, updateFeedbackStatus } from '../../services/feedback.service.js';

    let adminReady = false;
    let isAdminUser = false;
    let canManageAccess = false;
    let loading = true;
    let settings = {};
    let branding = { name: '', logo: '', tagline: '' };
    let aiSettings = { enabled: false, provider: 'openai', status: 'unset' };
    let statusOptions = [];
    let interestOptions = [];
    let requests = [];
    let feedback = [];
    let metrics = null;
    let dbStatus = null;
    let communityInstance = null;
    let managedCommunityInstances = [];
    let selectedCommunityInstanceId = '';
    let communityFeatureSettings = {
        enableGames: true,
        enableEvents: true,
        enableCelebrations: true,
        enableChat: true,
        enableAwards: true,
        enableSponsors: true,
        enableKnowledge: true,
        requireApproval: false,
        allowGuestAccess: true
    };
    let communityVisibility = true;
    let creatingCommunity = false;
    let newCommunity = {
        name: '',
        description: '',
        logo: '🏘️',
        instance_type: 'neighborhood',
        is_public: true
    };

    let newInterest = { id: '', label: '', emoji: '', sort_order: 0 };
    let feedbackResolutionNotes = {};

    onMount(async () => {
        if (!$isAuthenticated) {
            push('/auth');
            return;
        }

        try {
            isAdminUser = await isPlatformAdmin();
            canManageAccess = isAdminUser ? true : await canManageEventAccess();

            adminReady = isAdminUser || canManageAccess;
            if (!adminReady) {
                showToast('Admin access required.', 'error');
                push('/');
                return;
            }

            if (isAdminUser) {
                await loadAll();
            } else {
                requests = await fetchEventManagerRequests();
            }
        } catch (err) {
            showToast('Failed to load admin dashboard.', 'error');
        } finally {
            loading = false;
        }
    });

    async function loadAll() {
        const [settingsRows, statusRows, interestRows, requestRows, feedbackRows, metricsData, dbData, instanceData, managedInstances] = await Promise.all([
            fetchAppSettings(),
            fetchStatusOptions(),
            fetchInterestOptions(),
            fetchEventManagerRequests(),
            fetchAllFeedback(),
            getUsageMetrics(),
            getDatabaseStatus(),
            fetchMyCommunityInstance(),
            fetchManagedCommunityInstances()
        ]);

        settings = settingsRows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        branding = settings.branding || { name: '', logo: '', tagline: '' };
        aiSettings = settings.ai_settings || { enabled: false, provider: 'openai', status: 'unset' };
        statusOptions = statusRows || [];
        interestOptions = interestRows || [];
        requests = requestRows || [];
        feedback = feedbackRows || [];
        metrics = metricsData || null;
        dbStatus = dbData || null;
        managedCommunityInstances = managedInstances || [];

        // Prefer the current active membership instance; otherwise use first manageable instance.
        const defaultInstance = instanceData || managedCommunityInstances[0] || null;
        selectedCommunityInstanceId = defaultInstance?.id || '';
        communityInstance = defaultInstance;
        hydrateCommunitySettings(defaultInstance);
    }

    function hydrateCommunitySettings(instance) {
        const instanceSettings = instance?.settings || {};
        const enabledFeatures = new Set(instance?.enabled_features || []);
        communityVisibility = instance?.is_public ?? true;
        communityFeatureSettings = {
            enableGames: instanceSettings.enableGames ?? enabledFeatures.has('games') ?? true,
            enableEvents: instanceSettings.enableEvents ?? enabledFeatures.has('events') ?? true,
            enableCelebrations: enabledFeatures.has('celebrations'),
            enableChat: enabledFeatures.has('chat'),
            enableAwards: instanceSettings.enableAwards ?? enabledFeatures.has('awards') ?? true,
            enableSponsors: instanceSettings.enableSponsors ?? true,
            enableKnowledge: instanceSettings.enableKnowledge ?? true,
            requireApproval: instanceSettings.requireApproval ?? false,
            allowGuestAccess: instanceSettings.allowGuestAccess ?? true
        };
    }

    function selectCommunityInstance(instanceId) {
        selectedCommunityInstanceId = instanceId;
        communityInstance = managedCommunityInstances.find(i => i.id === instanceId) || null;
        hydrateCommunitySettings(communityInstance);
    }

    async function saveBranding() {
        try {
            await upsertAppSetting('branding', branding);
            showToast('Branding updated.', 'success');
        } catch (err) {
            showToast(`Failed to update branding: ${err.message}`, 'error');
        }
    }

    async function saveAiSettings() {
        try {
            await upsertAppSetting('ai_settings', aiSettings);
            showToast('AI settings updated.', 'success');
        } catch (err) {
            showToast(`Failed to update AI settings: ${err.message}`, 'error');
        }
    }

    async function saveCommunityInstanceSettings() {
        if (!communityInstance?.id) {
            showToast('No active community instance found.', 'error');
            return;
        }

        try {
            const settingsPayload = {
                ...(communityInstance.settings || {}),
                enableGames: !!communityFeatureSettings.enableGames,
                enableEvents: !!communityFeatureSettings.enableEvents,
                enableAwards: !!communityFeatureSettings.enableAwards,
                enableSponsors: !!communityFeatureSettings.enableSponsors,
                enableKnowledge: !!communityFeatureSettings.enableKnowledge,
                requireApproval: !!communityFeatureSettings.requireApproval,
                allowGuestAccess: !!communityFeatureSettings.allowGuestAccess
            };

            const enabledFeatures = [
                ...(communityFeatureSettings.enableGames ? ['games'] : []),
                ...(communityFeatureSettings.enableEvents ? ['events'] : []),
                ...(communityFeatureSettings.enableCelebrations ? ['celebrations'] : []),
                ...(communityFeatureSettings.enableChat ? ['chat'] : []),
                ...(communityFeatureSettings.enableAwards ? ['awards'] : [])
            ];

            communityInstance = await updateMyCommunityInstanceSettings({
                instance_id: communityInstance.id,
                is_public: !!communityVisibility,
                settings: settingsPayload,
                enabled_features: enabledFeatures
            });
            managedCommunityInstances = managedCommunityInstances.map(instance =>
                instance.id === communityInstance.id ? communityInstance : instance
            );
            showToast('Community instance settings updated.', 'success');
        } catch (err) {
            showToast(`Failed to update community settings: ${err.message}`, 'error');
        }
    }

    async function handleCreateCommunity() {
        if (!newCommunity.name?.trim()) {
            showToast('Community name is required.', 'error');
            return;
        }

        creatingCommunity = true;
        try {
            const created = await createCommunityInstance({
                name: newCommunity.name,
                description: newCommunity.description,
                logo: newCommunity.logo || '🏘️',
                instance_type: newCommunity.instance_type,
                is_public: !!newCommunity.is_public
            });

            managedCommunityInstances = [...managedCommunityInstances, created].sort((a, b) =>
                (a.name || '').localeCompare(b.name || '')
            );
            communityInstance = created;
            selectedCommunityInstanceId = created.id;
            hydrateCommunitySettings(created);

            newCommunity = {
                name: '',
                description: '',
                logo: '🏘️',
                instance_type: 'neighborhood',
                is_public: true
            };

            showToast(`Community created: ${created.name}`, 'success');
        } catch (err) {
            showToast(`Failed to create community: ${err.message}`, 'error');
        } finally {
            creatingCommunity = false;
        }
    }

    async function removeStatus(id) {
        try {
            await deleteStatusOption(id);
            statusOptions = await fetchStatusOptions();
        } catch (err) {
            showToast(`Failed to remove status: ${err.message}`, 'error');
        }
    }

    async function addInterestOption() {
        if (!newInterest.id.trim() || !newInterest.label.trim()) return;
        try {
            await upsertInterestOption({
                id: newInterest.id.trim(),
                label: newInterest.label.trim(),
                emoji: newInterest.emoji.trim() || null,
                sort_order: parseInt(newInterest.sort_order) || 0,
                active: true
            });
            newInterest = { id: '', label: '', emoji: '', sort_order: 0 };
            interestOptions = await fetchInterestOptions();
        } catch (err) {
            showToast(`Failed to add interest: ${err.message}`, 'error');
        }
    }

    async function removeInterest(id) {
        try {
            await deleteInterestOption(id);
            interestOptions = await fetchInterestOptions();
        } catch (err) {
            showToast(`Failed to remove interest: ${err.message}`, 'error');
        }
    }

    async function reviewRequest(requestId, status) {
        try {
            await reviewEventManagerRequest(requestId, status);
            requests = await fetchEventManagerRequests();
            showToast(`Request ${status}.`, 'success');
        } catch (err) {
            showToast(`Failed to update request: ${err.message}`, 'error');
        }
    }

    async function updateFeedback(id, status, resolutionNote = null) {
        try {
            await updateFeedbackStatus(id, status, resolutionNote);
            feedback = await fetchAllFeedback();
        } catch (err) {
            showToast(`Failed to update feedback: ${err.message}`, 'error');
        }
    }
</script>

{#if loading}
    <div class="admin-loading">Loading admin dashboard...</div>
{:else if !adminReady}
    <div class="admin-loading">Admin access required.</div>
{:else}
    <div class="admin-page">
        <header class="admin-header">
            <h1>Admin Console</h1>
            <p>Manage platform settings and access.</p>
        </header>

        {#if isAdminUser}
        <section class="admin-grid">
            <div class="admin-card">
                <h2>Branding</h2>
                <div class="field-row">
                    <label>App Name</label>
                    <input type="text" bind:value={branding.name} />
                </div>
                <div class="field-row">
                    <label>Logo Emoji</label>
                    <input type="text" bind:value={branding.logo} maxlength="3" />
                </div>
                <div class="field-row">
                    <label>Tagline</label>
                    <input type="text" bind:value={branding.tagline} />
                </div>
                <button class="btn primary" on:click={saveBranding}>Save Branding</button>
            </div>

            <div class="admin-card">
                <h2>AI Integration</h2>
                <label class="toggle">
                    <input type="checkbox" bind:checked={aiSettings.enabled} />
                    <span>Enable AI features</span>
                </label>
                <div class="field-row">
                    <label>Provider</label>
                    <select bind:value={aiSettings.provider}>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="field-row">
                    <label>Key Status</label>
                    <input type="text" bind:value={aiSettings.status} placeholder="set in Supabase secrets" />
                </div>
                <button class="btn primary" on:click={saveAiSettings}>Save AI Settings</button>
            </div>

            <div class="admin-card">
                <h2>Community Instance</h2>
                {#if communityInstance}
                    <p class="muted">Managing: <strong>{communityInstance.name}</strong></p>
                    {#if managedCommunityInstances.length > 1}
                        <div class="field-row">
                            <label>Community</label>
                            <select
                                bind:value={selectedCommunityInstanceId}
                                on:change={(e) => selectCommunityInstance(e.target.value)}
                            >
                                {#each managedCommunityInstances as instance}
                                    <option value={instance.id}>{instance.name}</option>
                                {/each}
                            </select>
                        </div>
                    {/if}
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityVisibility} />
                        <span>Public community listing</span>
                    </label>
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityFeatureSettings.enableGames} />
                        <span>Enable Games</span>
                    </label>
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityFeatureSettings.enableEvents} />
                        <span>Enable Events</span>
                    </label>
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityFeatureSettings.enableCelebrations} />
                        <span>Enable Celebrations</span>
                    </label>
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityFeatureSettings.enableChat} />
                        <span>Enable Chat</span>
                    </label>
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityFeatureSettings.enableAwards} />
                        <span>Enable Awards</span>
                    </label>
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityFeatureSettings.enableSponsors} />
                        <span>Enable Sponsors</span>
                    </label>
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityFeatureSettings.enableKnowledge} />
                        <span>Enable Knowledge</span>
                    </label>
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityFeatureSettings.requireApproval} />
                        <span>Require Join Approval</span>
                    </label>
                    <label class="toggle">
                        <input type="checkbox" bind:checked={communityFeatureSettings.allowGuestAccess} />
                        <span>Allow Guest Access</span>
                    </label>
                    <button class="btn primary" on:click={saveCommunityInstanceSettings}>Save Community Settings</button>
                {:else}
                    <p class="empty">No active community instance found for your current membership.</p>
                {/if}
            </div>

            <div class="admin-card">
                <h2>Create Community</h2>
                <div class="field-row">
                    <label>Name</label>
                    <input type="text" bind:value={newCommunity.name} placeholder="My Community" />
                </div>
                <div class="field-row">
                    <label>Description</label>
                    <input type="text" bind:value={newCommunity.description} placeholder="What this community is about" />
                </div>
                <div class="community-create-grid">
                    <div class="field-row">
                        <label>Logo</label>
                        <input type="text" bind:value={newCommunity.logo} maxlength="3" />
                    </div>
                    <div class="field-row">
                        <label>Type</label>
                        <select bind:value={newCommunity.instance_type}>
                            <option value="neighborhood">Neighborhood</option>
                            <option value="office">Office</option>
                            <option value="campus">Campus</option>
                            <option value="club">Club</option>
                        </select>
                    </div>
                </div>
                <label class="toggle">
                    <input type="checkbox" bind:checked={newCommunity.is_public} />
                    <span>Public community listing</span>
                </label>
                <button class="btn primary" on:click={handleCreateCommunity} disabled={creatingCommunity}>
                    {creatingCommunity ? 'Creating...' : 'Create Community'}
                </button>
            </div>

            <div class="admin-card">
                <h2>Usage Metrics</h2>
                {#if metrics}
                    <div class="metric"><span>Users</span><strong>{metrics.users}</strong></div>
                    <div class="metric"><span>Events</span><strong>{metrics.events}</strong></div>
                    <div class="metric"><span>Celebrations</span><strong>{metrics.celebrations}</strong></div>
                    <div class="metric"><span>Messages</span><strong>{metrics.messages}</strong></div>
                    <div class="metric"><span>Feedback</span><strong>{metrics.feedback}</strong></div>
                    <div class="metric"><span>Storage Objects</span><strong>{metrics.storage_objects}</strong></div>
                {:else}
                    <p>No metrics available.</p>
                {/if}
            </div>

            <div class="admin-card">
                <h2>Database Status</h2>
                {#if dbStatus}
                    <div class="metric"><span>DB</span><strong>{dbStatus.database}</strong></div>
                    <div class="metric"><span>Size</span><strong>{Math.round(dbStatus.db_size_bytes / 1024 / 1024)} MB</strong></div>
                    <div class="metric"><span>Timestamp</span><strong>{new Date(dbStatus.timestamp).toLocaleString()}</strong></div>
                {:else}
                    <p>No database info.</p>
                {/if}
            </div>
        </section>
        {/if}

        <section class="admin-section">
            <h2>Event Manager Access Requests</h2>
            {#if requests.length === 0}
                <p class="empty">No requests.</p>
            {:else}
                <div class="table">
                    <div class="row header">
                        <span>User</span>
                        <span>Status</span>
                        <span>Reason</span>
                        <span>Actions</span>
                    </div>
                    {#each requests as req}
                        <div class="row">
                            <span>
                                {#if req.display_name && req.username}
                                    {req.display_name} (@{req.username})
                                {:else}
                                    {req.username || req.display_name || req.user_id}
                                {/if}
                            </span>
                            <span class="badge {req.status}">{req.status}</span>
                            <span>{req.reason || '—'}</span>
                            <span class="actions">
                                <button class="btn" on:click={() => reviewRequest(req.id, 'approved')} disabled={req.status !== 'pending'}>Approve</button>
                                <button class="btn danger" on:click={() => reviewRequest(req.id, 'rejected')} disabled={req.status !== 'pending'}>Reject</button>
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
        </section>

        {#if isAdminUser}
            <section class="admin-section">
                <h2>Status Options</h2>
                <div class="pill-list">
                    {#each statusOptions as option}
                        <div class="pill" style="border-color: {option.color}">
                            <span class="dot" style="background: {option.color}"></span>
                            {option.label}
                            <button class="x" on:click={() => removeStatus(option.id)}>✕</button>
                        </div>
                    {/each}
                </div>
            </section>

            <section class="admin-section">
                <h2>Interest Options</h2>
                <div class="inline-form">
                    <input placeholder="id" bind:value={newInterest.id} />
                    <input placeholder="label" bind:value={newInterest.label} />
                    <input placeholder="emoji" bind:value={newInterest.emoji} />
                    <input type="number" placeholder="order" bind:value={newInterest.sort_order} />
                    <button class="btn" on:click={addInterestOption}>Add</button>
                </div>
                <div class="pill-list">
                    {#each interestOptions as option}
                        <div class="pill">
                            <span class="emoji">{option.emoji}</span>
                            {option.label}
                            <button class="x" on:click={() => removeInterest(option.id)}>✕</button>
                        </div>
                    {/each}
                </div>
            </section>

            <section class="admin-section">
                <h2>Feedback Review</h2>
                {#if feedback.length === 0}
                    <p class="empty">No feedback yet.</p>
                {:else}
                    <div class="feedback-list">
                        {#each feedback as item}
                            <div class="feedback-card" class:resolved={item.status === 'resolved'}>
                                <div class="feedback-card-header">
                                    <span class="feedback-category">{item.category}</span>
                                    <span class="badge status-{item.status}">{item.status}</span>
                                </div>

                                <h3 class="feedback-title">{item.title || 'No title'}</h3>

                                <div class="feedback-meta">
                                    <span>👤 {item.username || 'Anonymous'}</span>
                                    <span>📅 {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>

                                <div class="feedback-message">
                                    <strong>Message:</strong>
                                    <p>{item.message || '(No message provided)'}</p>
                                </div>

                                {#if item.resolution_note}
                                    <div class="feedback-resolution">
                                        <strong>Resolution Note:</strong>
                                        <p>{item.resolution_note}</p>
                                    </div>
                                {/if}

                                <div class="feedback-actions">
                                    <div class="action-buttons">
                                        <button
                                            class="btn btn-secondary"
                                            on:click={() => updateFeedback(item.id, 'reviewing')}
                                            disabled={item.status === 'reviewing'}
                                        >
                                            🔍 Reviewing
                                        </button>
                                        <button
                                            class="btn btn-primary"
                                            on:click={() => updateFeedback(item.id, 'resolved', feedbackResolutionNotes[item.id])}
                                            disabled={item.status === 'resolved'}
                                        >
                                            ✅ Resolve
                                        </button>
                                        <button
                                            class="btn btn-outline"
                                            on:click={() => updateFeedback(item.id, 'pending')}
                                            disabled={item.status === 'pending'}
                                        >
                                            ⏸️ Reopen
                                        </button>
                                    </div>

                                    <div class="resolution-input">
                                        <label for="resolution-{item.id}">Add resolution note:</label>
                                        <textarea
                                            id="resolution-{item.id}"
                                            rows="2"
                                            placeholder="Describe how this was resolved..."
                                            bind:value={feedbackResolutionNotes[item.id]}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </section>
        {/if}
    </div>
{/if}

<style>
    .admin-page {
        padding: 24px 20px 120px;
        max-width: 1100px;
        margin: 0 auto;
        color: var(--text);
    }

    .admin-header h1 {
        font-size: 28px;
        margin-bottom: 6px;
    }

    .admin-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin: 20px 0 32px;
    }

    .admin-card {
        background: white;
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .admin-section {
        margin-bottom: 32px;
    }

    .field-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .community-create-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }

    input, select {
        padding: 8px 10px;
        border: 1px solid var(--cream-dark);
        border-radius: 8px;
        font-size: 14px;
    }

    .btn {
        background: var(--cream);
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-weight: 600;
    }

    .btn.primary {
        background: var(--primary);
        color: white;
    }

    .btn.danger {
        background: #fbeaea;
        color: #c0392b;
    }

    .metric {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid var(--cream-dark);
    }

    .table {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0,0,0,0.06);
    }

    .row {
        display: grid;
        grid-template-columns: 1.2fr 1.6fr 1fr 1.2fr;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--cream-dark);
        align-items: center;
    }

    /* Feedback Card Styles */
    .feedback-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .feedback-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        border: 1px solid var(--cream-dark);
    }

    .feedback-card.resolved {
        opacity: 0.7;
        background: #f9f9f9;
    }

    .feedback-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .feedback-category {
        background: var(--primary-light);
        color: var(--primary-dark);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
    }

    .feedback-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text);
        margin: 0 0 8px 0;
    }

    .feedback-meta {
        display: flex;
        gap: 16px;
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 16px;
    }

    .feedback-message {
        background: var(--cream);
        padding: 14px;
        border-radius: 8px;
        margin-bottom: 12px;
    }

    .feedback-message strong {
        display: block;
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 6px;
    }

    .feedback-message p {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        color: var(--text);
        white-space: pre-wrap;
    }

    .feedback-resolution {
        background: #e8f5e9;
        padding: 14px;
        border-radius: 8px;
        margin-bottom: 12px;
        border-left: 3px solid #4CAF50;
    }

    .feedback-resolution strong {
        display: block;
        font-size: 12px;
        color: #2E7D32;
        margin-bottom: 6px;
    }

    .feedback-resolution p {
        margin: 0;
        font-size: 14px;
        color: var(--text);
    }

    .feedback-actions {
        border-top: 1px solid var(--cream-dark);
        padding-top: 16px;
    }

    .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 12px;
    }

    .action-buttons .btn {
        font-size: 13px;
        padding: 8px 14px;
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-outline {
        background: white;
        border: 1px solid var(--cream-dark);
        color: var(--text-muted);
    }

    .action-buttons .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .resolution-input label {
        display: block;
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 6px;
    }

    .resolution-input textarea {
        width: 100%;
        min-height: 60px;
        resize: vertical;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: 8px;
        font-size: 13px;
    }

    .status-pending {
        background: #FFF3E0;
        color: #E65100;
    }

    .status-reviewing {
        background: #E3F2FD;
        color: #1565C0;
    }

    .status-resolved {
        background: #E8F5E9;
        color: #2E7D32;
    }

    .row.header {
        font-weight: 700;
        background: var(--cream);
    }

    .badge {
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        text-transform: capitalize;
        background: #f0f0f0;
    }

    .badge.approved,
    .badge.resolved {
        background: #e7f6ea;
        color: #2e7d32;
    }

    .badge.rejected {
        background: #fdecea;
        color: #c0392b;
    }

    .badge.pending,
    .badge.open,
    .badge.reviewing {
        background: #fff4d6;
        color: #b26a00;
    }

    .actions {
        display: flex;
        gap: 8px;
    }

    .inline-form {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
        gap: 8px;
        margin-bottom: 12px;
    }

    .pill-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--cream-dark);
        background: white;
    }

    .pill .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .pill .x {
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 12px;
    }

    .emoji {
        font-size: 14px;
    }

    .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
    }

    .empty {
        color: var(--text-muted);
    }

    .admin-loading {
        padding: 40px;
        text-align: center;
    }

    @media (max-width: 720px) {
        .row {
            grid-template-columns: 1fr;
        }

        .inline-form {
            grid-template-columns: 1fr;
        }

        .community-create-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
