<script>
    import { onMount, onDestroy } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { isAuthenticated, currentUser } from '../../stores/auth.js';
    import { events, getEventStatus, getCapacityInfo } from '../../stores/events.js';
    import { savedContacts } from '../../stores/contacts.js';
    import {
        fetchEventById,
        updateEventInDb,
        uploadEventImage,
        rsvpToEvent,
        rsvpToEventV2,
        getActiveMembershipId,
        addEventItemV2,
        removeEventItem,
        claimEventItemV2,
        unclaimEventItem,
        sendEventNotification,
        fetchEventParticipants,
        fetchEventParticipantsDetailed,
        subscribeToEvent,
        approveRsvp,
        rejectRsvp,
        checkInParticipant,
        getMeetingLink,
        updateSpeakerInvite,
        inviteSpeaker,
        inviteSpeakerByEmail
    } from '../../services/events.service.js';
    import { fetchContacts } from '../../services/contacts.service.js';
    import { createSpeaker, fetchSpeakers } from '../../services/speakers.service.js';
    import EventForm from '../../components/events/EventForm.svelte';
    import Avatar from '../../components/avatar/Avatar.svelte';
    import PotluckItemsSection from '../../components/events/PotluckItemsSection.svelte';
    import DevMeetupAgenda from '../../components/events/DevMeetupAgenda.svelte';
    import RSVPModal from '../../components/events/RSVPModal.svelte';
    import EventParticipantsModal from '../../components/events/EventParticipantsModal.svelte';
    import InviteSpeakerModal from '../../components/events/InviteSpeakerModal.svelte';
    import SubmitTalkModal from '../../components/events/SubmitTalkModal.svelte';
    import { showToast } from '../../stores/toasts.js';
    import MessageList from '../../components/chat/MessageList.svelte';
    import MessageInput from '../../components/chat/MessageInput.svelte';
    import GiphyPicker from '../../components/chat/GiphyPicker.svelte';
    import {
        fetchEventChatMessages,
        sendEventChatMessage,
        subscribeToEventChat
    } from '../../services/eventChat.service.js';

    export let params = {};

    let eventData = null;
    let loading = true;
    let isEditing = false;
    let isOwner = false;
    let participants = [];
    let loadingParticipants = false;
    let subscription = null;

    let newItemName = '';
    let notifyMessage = '';
    let notifyTarget = 'attendees';
    let sendingNotify = false;
    let joining = false;
    let activeMembershipId = null;

    // New state
    let showRsvpModal = false;
    let showParticipantsModal = false;
    let rsvpLoading = false;
    let meetingLink = null;
    let eventChatMessages = [];
    let eventChatLoading = false;
    let eventChatSubscription = null;
    let showEventGifPicker = false;
    let showHeroModal = false;

    // Speaker functionality state
    let showInviteSpeakerModal = false;
    let showSubmitTalkModal = false;
    let inviteSpeakerLoading = false;
    let submitTalkLoading = false;

    $: eventId = params?.id;
    $: {
        const fromStore = $events.find(item => item.id === eventId);
        if (fromStore) {
            eventData = fromStore;
        }
    }
    $: isOwner = eventData?.created_by === $currentUser?.user_id;
    $: isAttending = eventData?.isAttending ?? (activeMembershipId ? eventData?.attendees?.includes(activeMembershipId) : eventData?.attendees?.includes($currentUser?.user_id));
    $: items = eventData?.items || [];
    $: eventStatus = getEventStatus(eventData?.status);
    $: capacityInfo = getCapacityInfo(eventData);
    $: myRsvpStatus = eventData?.myRsvpStatus || (isAttending ? 'going' : null);
    $: isPotluck = eventData?.type === 'potluck';
    $: isDevMeetup = eventData?.type === 'dev-meetup';
    $: isDraft = eventData?.status === 'draft';
    $: isClosed = eventData?.status === 'closed';
    $: canChat = isOwner || !!myRsvpStatus;

    onMount(async () => {
        if (!$isAuthenticated || !eventId) return;

        const existing = $events.find(item => item.id === eventId);
        if (existing) {
            eventData = existing;
            loading = false;
        }

        try {
            const fetched = await fetchEventById(eventId);
            eventData = fetched;
        } catch (err) {
            if (!existing) {
                showToast('Unable to load event.', 'error');
            }
        } finally {
            loading = false;
        }

        fetchContacts();
        loadParticipants();
        getActiveMembershipId().then(id => activeMembershipId = id);

        subscription = subscribeToEvent(eventId, (updated) => {
            if (updated) {
                eventData = updated;
            }
        });

        loadEventChat();
        eventChatSubscription = await subscribeToEventChat(eventId, (message) => {
            eventChatMessages = [...eventChatMessages, message];
        });
    });

    onDestroy(() => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
        }
        if (eventChatSubscription && typeof eventChatSubscription.unsubscribe === 'function') {
            eventChatSubscription.unsubscribe();
        }
    });

    async function loadEventChat() {
        if (!eventId) return;
        eventChatLoading = true;
        try {
            eventChatMessages = await fetchEventChatMessages(eventId);
        } catch (err) {
            eventChatMessages = [];
        } finally {
            eventChatLoading = false;
        }
    }

    async function handleSendEventChatMessage(event) {
        const { message, isGif } = event.detail;
        if (!message.trim()) return;
        try {
            const sent = await sendEventChatMessage(eventId, message.trim(), isGif);
            if (sent) {
                eventChatMessages = [...eventChatMessages, sent];
            }
        } catch (err) {
            showToast(`Failed to send message: ${err.message}`, 'error');
        }
    }

    async function handleEventGifSelect(event) {
        const gif = event.detail;
        const caption = gif.message ? gif.message.trim() : '';
        try {
            const sent = await sendEventChatMessage(eventId, caption, true, gif.url);
            if (sent) {
                eventChatMessages = [...eventChatMessages, sent];
            }
        } catch (err) {
            showToast(`Failed to send GIF: ${err.message}`, 'error');
        } finally {
            showEventGifPicker = false;
        }
    }

    async function loadParticipants() {
        if (!eventId) return;
        loadingParticipants = true;
        try {
            participants = await fetchEventParticipantsDetailed(eventId);
        } catch (err) {
            participants = [];
        } finally {
            loadingParticipants = false;
        }
    }

    async function loadMeetingLink() {
        if (!eventId || !isDevMeetup) return;
        try {
            const result = await getMeetingLink(eventId);
            meetingLink = result?.meeting_link || null;
        } catch (err) {
            meetingLink = null;
        }
    }


    async function handleUpdateEvent(event) {
        try {
            const payload = { ...event.detail };
            if (payload.cover_image_file) {
                payload.cover_image_url = await uploadEventImage(payload.cover_image_file);
            }
            delete payload.cover_image_file;

            const updated = await updateEventInDb(eventData.id, payload);
            eventData = updated;
            isEditing = false;
            showToast('Event updated!', 'success');
        } catch (err) {
            showToast(`Failed to update event: ${err.message}`, 'error');
        }
    }

    async function handleRsvp() {
        if (!eventData) return;
        try {
            joining = true;
            const updated = await rsvpToEvent(eventData.id, !isAttending);
            if (updated) {
                eventData = updated;
            }
        } catch (err) {
            showToast('Unable to join event. Please try again.', 'error');
        } finally {
            joining = false;
        }
    }

    async function handleRemoveItem(itemId) {
        try {
            const updatedItems = await removeEventItem(eventData.id, itemId);
            eventData = { ...eventData, items: updatedItems || [] };
            showToast('Item removed.', 'success');
        } catch (err) {
            showToast(`Failed to remove: ${err.message}`, 'error');
        }
    }

    async function handleSendNotification() {
        if (!notifyMessage.trim()) {
            showToast('Enter a message to send.', 'error');
            return;
        }
        sendingNotify = true;
        try {
            let targets = null;
            if (notifyTarget === 'contacts') {
                targets = ($savedContacts || []).map(c => c.user_id).filter(Boolean);
            }
            await sendEventNotification(eventData.id, notifyMessage.trim(), targets);
            notifyMessage = '';
            showToast('Notification sent.', 'success');
        } catch (err) {
            showToast(`Failed to send: ${err.message}`, 'error');
        } finally {
            sendingNotify = false;
        }
    }

    // Enhanced RSVP handler
    async function handleRsvpSubmit(event) {
        const { rsvpStatus, guestCount, notes } = event.detail;
        rsvpLoading = true;
        try {
            await rsvpToEventV2(eventId, { rsvpStatus, guestCount, notes });
            eventData = await fetchEventById(eventId);
            loadParticipants();
            if (isDevMeetup) loadMeetingLink();
            showRsvpModal = false;
            showToast('RSVP updated!', 'success');
        } catch (err) {
            showToast(`Failed to update RSVP: ${err.message}`, 'error');
        } finally {
            rsvpLoading = false;
        }
    }

    // Participant management (organizer)
    async function handleApproveParticipant(event) {
        try {
            await approveRsvp(eventId, event.detail.participantId);
            loadParticipants();
            showToast('RSVP approved!', 'success');
        } catch (err) {
            showToast(`Failed to approve: ${err.message}`, 'error');
        }
    }

    async function handleRejectParticipant(event) {
        try {
            await rejectRsvp(eventId, event.detail.participantId);
            loadParticipants();
            showToast('RSVP rejected.', 'success');
        } catch (err) {
            showToast(`Failed to reject: ${err.message}`, 'error');
        }
    }

    async function handleCheckIn(event) {
        try {
            await checkInParticipant(eventId, event.detail.participantId);
            loadParticipants();
            showToast('Checked in!', 'success');
        } catch (err) {
            showToast(`Failed to check in: ${err.message}`, 'error');
        }
    }

    // Potluck item handlers
    async function handleAddPotluckItem(event) {
        const { name, category, slots } = event.detail;
        try {
            await addEventItemV2(eventId, {
                name,
                category,
                neededQty: 1,
                slots,
                allowRecipe: true
            });
            eventData = await fetchEventById(eventId);
            showToast('Item added!', 'success');
        } catch (err) {
            showToast(`Failed to add item: ${err.message}`, 'error');
        }
    }

    async function handleClaimPotluckItem(event) {
        const { itemId, quantity } = event.detail;
        try {
            await claimEventItemV2(eventId, itemId, quantity);
            eventData = await fetchEventById(eventId);
            showToast('Item claimed!', 'success');
        } catch (err) {
            showToast(`Failed to claim: ${err.message}`, 'error');
        }
    }

    async function handleUnclaimPotluckItem(event) {
        const { itemId, claimId } = event.detail;
        try {
            await unclaimEventItem(eventId, itemId, claimId);
            eventData = await fetchEventById(eventId);
            showToast('Claim removed.', 'success');
        } catch (err) {
            showToast(`Failed to unclaim: ${err.message}`, 'error');
        }
    }

    async function handleRemovePotluckItem(event) {
        const { itemId } = event.detail;
        try {
            await removeEventItem(eventId, itemId);
            eventData = await fetchEventById(eventId);
            showToast('Item removed.', 'success');
        } catch (err) {
            showToast(`Failed to remove: ${err.message}`, 'error');
        }
    }

    // Speaker invite handlers
    async function handleUpdateSpeakerInvite(event) {
        const { inviteId, status } = event.detail;
        try {
            await updateSpeakerInvite(eventId, inviteId, status);
            eventData = await fetchEventById(eventId);
            showToast(`Speaker invite ${status}.`, 'success');
        } catch (err) {
            showToast(`Failed to update invite: ${err.message}`, 'error');
        }
    }

    // Invite speaker handler (organizers)
    async function handleInviteSpeaker(event) {
        const { mode, speakerId, speakerName, speakerEmail, contactName, talkTitle, talkAbstract, duration } = event.detail;
        inviteSpeakerLoading = true;
        try {
            if (mode === 'email') {
                await inviteSpeakerByEmail(eventId, {
                    email: speakerEmail,
                    name: speakerName,
                    talkTitle,
                    talkAbstract,
                    durationMinutes: duration
                });
            } else if (mode === 'contact') {
                const newSpeaker = await createSpeaker({
                    name: contactName || 'Speaker',
                    title: null,
                    company: null,
                    bio: null,
                    headshot_url: null,
                    email: null,
                    social_links: {},
                    is_public: true
                });
                await inviteSpeaker(eventId, newSpeaker.id, {
                    talkTitle,
                    talkAbstract,
                    durationMinutes: duration
                });
            } else {
                await inviteSpeaker(eventId, speakerId, {
                    talkTitle,
                    talkAbstract,
                    durationMinutes: duration
                });
            }
            eventData = await fetchEventById(eventId);
            showInviteSpeakerModal = false;
            showToast('Speaker invited!', 'success');
        } catch (err) {
            showToast(`Failed to invite speaker: ${err.message}`, 'error');
        } finally {
            inviteSpeakerLoading = false;
        }
    }

    // Submit talk proposal handler (attendees)
    async function handleSubmitTalk(event) {
        const { speakerProfile, talkTitle, talkAbstract, duration } = event.detail;
        submitTalkLoading = true;
        try {
            // Create speaker profile if provided
            let speakerId = speakerProfile.id; // Use existing if available
            if (!speakerId) {
                const newSpeaker = await createSpeaker(speakerProfile);
                speakerId = newSpeaker.id;
            }

            // Submit talk proposal
            await inviteSpeaker(eventId, speakerId, {
                talkTitle,
                talkAbstract,
                durationMinutes: duration
            });
            eventData = await fetchEventById(eventId);
            showSubmitTalkModal = false;
            showToast('Talk proposal submitted!', 'success');
        } catch (err) {
            showToast(`Failed to submit proposal: ${err.message}`, 'error');
        } finally {
            submitTalkLoading = false;
        }
    }

    function handleOpenInviteSpeaker() {
        showInviteSpeakerModal = true;
    }

    function handleOpenSubmitTalk() {
        showSubmitTalkModal = true;
    }

    function formatEventDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function formatEventTime(timeStr) {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(hours, 10), parseInt(minutes || '0', 10));
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        }).toLowerCase();
    }

    function openHeroModal() {
        if (!eventData?.cover_image_url) return;
        showHeroModal = true;
    }

    function closeHeroModal() {
        showHeroModal = false;
    }

    function shareEvent() {
        if (!eventData) return;
        const url = `${window.location.origin}/#/events/${eventData.id}`;
        const title = eventData.title || 'Community Event';
        const text = eventData.description ? eventData.description.slice(0, 140) : 'Join me for this event!';
        if (navigator.share) {
            navigator.share({ title, text, url }).catch(() => {});
        } else {
            navigator.clipboard?.writeText(url);
            showToast('Event link copied!', 'success');
        }
    }

    function downloadCalendarInvite() {
        if (!eventData?.date) return;
        const startDate = new Date(eventData.date);
        if (eventData.time) {
            const [h, m] = eventData.time.split(':');
            startDate.setHours(parseInt(h, 10), parseInt(m || '0', 10), 0, 0);
        }
        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
        const pad = (n) => String(n).padStart(2, '0');
        const toIcs = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
        const uid = `${eventData.id}@neighbor-chat`;
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Neighbor Chat//EN',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${toIcs(new Date())}`,
            `DTSTART:${toIcs(startDate)}`,
            `DTEND:${toIcs(endDate)}`,
            `SUMMARY:${eventData.title || 'Community Event'}`,
            eventData.location ? `LOCATION:${eventData.location}` : '',
            eventData.description ? `DESCRIPTION:${eventData.description.replace(/\n/g, '\\n')}` : '',
            'END:VEVENT',
            'END:VCALENDAR'
        ].filter(Boolean).join('\n');
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${(eventData.title || 'event').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.ics`;
        link.click();
        URL.revokeObjectURL(link.href);
    }
</script>

{#if $isAuthenticated}
    <div class="event-detail">
        <div class="detail-header">
            <button class="back-btn" on:click={() => push('/events')}>← Back</button>
            <h2 class="card-title">Event Details</h2>
            {#if isOwner}
                <button class="btn btn-secondary btn-small" on:click={() => isEditing = !isEditing}>
                    {isEditing ? 'Close Edit' : 'Edit'}
                </button>
            {/if}
        </div>

        {#if loading}
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading event...</p>
            </div>
        {:else if eventData}
            <div class="event-hero">
                {#if eventData.cover_image_url}
                    <button class="event-hero-button" type="button" aria-label="Event cover">
                        <img class="event-hero-image" src={eventData.cover_image_url} alt="Event cover" />
                    </button>
                {:else}
                    <div class="event-hero-placeholder"></div>
                {/if}
                <div class="event-hero-overlay">
                    <button class="event-hero-zoom" type="button" on:click={openHeroModal} aria-label="Open event image">
                        🔍
                    </button>
                    <div class="event-hero-content">
                        {#if isDraft}
                            <span class="status-badge draft">Draft</span>
                        {:else if isClosed}
                            <span class="status-badge closed">Closed</span>
                        {/if}
                        {#if capacityInfo.hasCapacity}
                            <span class="capacity-badge" class:full={capacityInfo.isFull}>
                                {capacityInfo.spotsTaken}/{capacityInfo.spotsTotal} spots
                            </span>
                        {/if}
                        <h3 class="event-title">{eventData.title}</h3>
                        <div class="event-meta">
                            <span>📅 {formatEventDate(eventData.date)}</span>
                            {#if eventData.time}
                                <span>🕐 {formatEventTime(eventData.time)}</span>
                            {/if}
                            {#if eventData.location}
                                <span>📍 {eventData.location}</span>
                            {/if}
                        </div>
                <button class="event-host" type="button" on:click|stopPropagation={() => !isOwner && eventData.created_by && push(`/profile/view/${eventData.created_by}`)}>
                    <Avatar avatar={eventData.creator_avatar} size="sm" />
                    <span>Organizer: {isOwner ? 'You' : eventData.creator_name}</span>
                </button>
                    </div>
                    <div class="event-actions" on:click|stopPropagation>
                        {#if myRsvpStatus}
                            <span class="rsvp-status-badge" class:going={myRsvpStatus === 'going'} class:maybe={myRsvpStatus === 'maybe'} class:not-going={myRsvpStatus === 'not_going'}>
                                {myRsvpStatus === 'going' ? 'Going' : myRsvpStatus === 'maybe' ? 'Maybe' : 'Not Going'}
                            </span>
                        {/if}
                        {#if !isClosed}
                            <button class="btn btn-primary" on:click={() => showRsvpModal = true} disabled={joining}>
                                {myRsvpStatus ? 'Update RSVP' : 'RSVP'}
                            </button>
                        {/if}
                        <button class="btn btn-secondary" on:click={() => showParticipantsModal = true}>
                            View Attendees ({participants.length})
                        </button>
                        <button class="btn btn-secondary" on:click={shareEvent}>
                            🔗 Share
                        </button>
                        <button class="btn btn-secondary" on:click={downloadCalendarInvite}>
                            📅 Add to Calendar
                        </button>
                    </div>
                </div>
            </div>

            {#if eventData.description}
                <div class="card">
                    <h3 class="card-title">About this event</h3>
                    <p class="event-description">{eventData.description}</p>
                </div>
            {/if}

            {#if isEditing}
                <div class="card">
                    <h3 class="card-title">Edit Event</h3>
                    <EventForm
                        event={eventData}
                        loading={false}
                        on:submit={handleUpdateEvent}
                        on:cancel={() => isEditing = false}
                    />
                </div>
            {/if}

            <div class="card">
                <h3 class="card-title">Attendees</h3>
                {#if loadingParticipants}
                    <p>Loading attendees...</p>
                {:else if participants.length === 0}
                    <p class="empty-text">No attendees yet.</p>
                {:else}
                    <div class="attendee-list">
                        {#each participants as participant (participant.membership_id || participant.user_id)}
                            <div class="attendee-item">
                                <Avatar avatar={participant.profile?.avatar} size="sm" />
                                <div class="attendee-info">
                                    <span class="attendee-name">
                                        {participant.profile?.display_name || participant.profile?.username || 'Neighbor'}
                                    </span>
                                    {#if participant.profile?.username}
                                        <span class="attendee-username">@{participant.profile.username}</span>
                                    {/if}
                                    {#if participant.rsvp_status && participant.rsvp_status !== 'going'}
                                        <span class="attendee-rsvp-badge" class:maybe={participant.rsvp_status === 'maybe'}>
                                            {participant.rsvp_status === 'maybe' ? 'Maybe' : ''}
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="card event-chat-card">
                <h3 class="card-title">Event Chat</h3>
                {#if !canChat}
                    <p class="empty-text">RSVP to join the event chat.</p>
                {:else if eventChatLoading}
                    <p>Loading chat...</p>
                {:else}
                    <div class="event-chat-body">
                        <MessageList messages={eventChatMessages} autoScroll={true} />
                    </div>
                    <GiphyPicker
                        show={showEventGifPicker}
                        on:select={handleEventGifSelect}
                        on:close={() => showEventGifPicker = false}
                    />
                    <MessageInput
                        placeholder="Message the event attendees..."
                        on:send={handleSendEventChatMessage}
                        on:openGif={() => showEventGifPicker = !showEventGifPicker}
                    />
                {/if}
            </div>

            <!-- Potluck Items Section -->
            {#if isPotluck}
                <PotluckItemsSection
                    event={eventData}
                    {isOwner}
                    on:addItem={handleAddPotluckItem}
                    on:claim={handleClaimPotluckItem}
                    on:unclaim={handleUnclaimPotluckItem}
                    on:removeItem={handleRemovePotluckItem}
                />
            {/if}

            <!-- Dev Meetup Agenda Section -->
            {#if isDevMeetup}
                <DevMeetupAgenda
                    event={eventData}
                    {isOwner}
                    isAttending={myRsvpStatus === 'going'}
                    {meetingLink}
                    on:updateInvite={handleUpdateSpeakerInvite}
                    on:inviteSpeaker={handleOpenInviteSpeaker}
                    on:submitTalk={handleOpenSubmitTalk}
                />
            {/if}

            {#if eventData.attachments?.length}
                <div class="card">
                    <h3 class="card-title">Attachments</h3>
                    <ul class="attachments-list">
                        {#each eventData.attachments as attachment}
                            <li>
                                <a href={attachment} target="_blank" rel="noreferrer">{attachment}</a>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}

            {#if isOwner}
                <div class="card">
                    <h3 class="card-title">Notify Community</h3>
                    <textarea
                        rows="3"
                        placeholder="Send an update to attendees or contacts..."
                        bind:value={notifyMessage}
                    ></textarea>
                    <div class="notify-actions">
                        <select bind:value={notifyTarget}>
                            <option value="attendees">Attendees</option>
                            <option value="contacts">Contacts</option>
                        </select>
                        <button class="btn btn-primary btn-small" on:click={handleSendNotification} disabled={sendingNotify}>
                            {sendingNotify ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </div>
            {/if}
        {:else}
            <div class="empty-state">Event not found.</div>
        {/if}
    </div>

    <!-- RSVP Modal -->
    <RSVPModal
        show={showRsvpModal}
        event={eventData}
        currentStatus={myRsvpStatus}
        loading={rsvpLoading}
        on:close={() => showRsvpModal = false}
        on:submit={handleRsvpSubmit}
    />

    <!-- Participants Modal -->
    <EventParticipantsModal
        show={showParticipantsModal}
        event={eventData}
        {participants}
        loading={loadingParticipants}
        on:close={() => showParticipantsModal = false}
        on:approve={handleApproveParticipant}
        on:reject={handleRejectParticipant}
        on:checkin={handleCheckIn}
    />

    <!-- Invite Speaker Modal -->
    <InviteSpeakerModal
        show={showInviteSpeakerModal}
        event={eventData}
        loading={inviteSpeakerLoading}
        on:close={() => showInviteSpeakerModal = false}
        on:submit={handleInviteSpeaker}
    />

    <!-- Submit Talk Modal -->
    <SubmitTalkModal
        show={showSubmitTalkModal}
        event={eventData}
        currentUserId={$currentUser?.user_id}
        loading={submitTalkLoading}
        on:close={() => showSubmitTalkModal = false}
        on:submit={handleSubmitTalk}
    />

    {#if showHeroModal && eventData?.cover_image_url}
        <div class="image-modal" role="dialog" aria-modal="true" on:click={closeHeroModal}>
            <div class="image-modal-content" on:click|stopPropagation>
                <button class="image-modal-close" type="button" on:click={closeHeroModal} aria-label="Close image">✕</button>
                <img src={eventData.cover_image_url} alt="Event full cover" />
            </div>
        </div>
    {/if}
{/if}

<style>
    .event-detail {
        padding-bottom: 20px;
    }

    .detail-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .back-btn {
        background: none;
        border: none;
        color: var(--primary);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        padding: 8px 0;
    }

    .card {
        background: white;
        border-radius: var(--radius-md);
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .event-chat-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .event-chat-body {
        height: 260px;
        border: 1px solid var(--cream-dark);
        border-radius: 12px;
        overflow: hidden;
        background: white;
        display: flex;
        flex-direction: column;
    }

    :global(.event-chat-body .message-list) {
        padding: 12px;
    }

    .event-hero {
        position: relative;
        border-radius: var(--radius-md);
        overflow: hidden;
        margin-bottom: 16px;
        background: #f5f5f5;
        min-height: 220px;
    }

    .event-hero-button {
        display: block;
        padding: 0;
        border: none;
        width: 100%;
        background: transparent;
        cursor: pointer;
        position: relative;
    }

    .event-hero-image {
        width: 100%;
        height: 320px;
        object-fit: cover;
        display: block;
    }

    .event-hero-zoom {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.55);
        color: white;
        font-size: 16px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        z-index: 3;
    }

    .event-hero-placeholder {
        width: 100%;
        height: 240px;
        background: linear-gradient(135deg, #f5f5f5, #e9e9e9);
    }

    .event-hero-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.65) 100%);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 20px;
        gap: 12px;
    }

    .event-hero-content {
        color: white;
    }

    .event-title {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 8px;
    }

    .event-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
    }

    .event-description {
        margin-top: 6px;
        font-size: 14px;
        color: var(--text);
    }

    .event-host {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        font-size: 13px;
        color: #1b2b22;
        background: rgba(255, 255, 255, 0.85);
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.6);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
    }

    .event-actions {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .attendee-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
    }

    .attendee-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        padding: 8px 10px;
        border-radius: var(--radius-sm);
        transition: background 0.2s ease;
    }

    .attendee-item:hover {
        background: var(--cream);
    }

    .attendee-name {
        opacity: 1;
        max-width: 160px;
        overflow: hidden;
        white-space: nowrap;
    }

    .item-form {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    }

    .item-form input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
    }

    .items-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .item-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--cream);
        border-radius: var(--radius-sm);
    }

    .item-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .item-name {
        font-weight: 600;
    }

    .item-status {
        font-size: 12px;
        color: var(--text-muted);
    }

    .item-claimer {
        font-size: 12px;
        color: var(--text);
    }

    .item-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }

    .assign-select {
        padding: 6px 10px;
        border: 1px solid var(--cream-dark);
        border-radius: 999px;
        background: white;
        font-size: 12px;
    }

    .notify-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 12px;
    }

    .attachments-list {
        margin: 0;
        padding-left: 16px;
        display: grid;
        gap: 6px;
        font-size: 13px;
    }

    textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--cream-dark);
        border-radius: var(--radius-sm);
        font-family: inherit;
    }

    .btn {
        padding: 10px 16px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background: var(--primary);
        color: white;
    }

    .btn-secondary {
        background: var(--cream);
        color: var(--text);
    }

    .btn-claim {
        background: #E8F5E9;
        color: #2E7D32;
    }

    .btn-claim:hover {
        background: #C8E6C9;
    }

    .btn-remove {
        background: #FFEBEE;
        color: #C62828;
    }

    .btn-remove:hover {
        background: #FFCDD2;
    }

    .btn-small {
        padding: 8px 12px;
        font-size: 12px;
    }

    .loading-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
    }

    .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--cream-dark);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .empty-text,
    .empty-state {
        color: var(--text-muted);
        font-size: 13px;
    }

    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
    }

    .status-badge.draft {
        background: rgba(158, 158, 158, 0.9);
        color: white;
    }

    .status-badge.closed {
        background: rgba(244, 67, 54, 0.9);
        color: white;
    }

    .capacity-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.9);
        color: var(--text);
        margin-left: 8px;
        margin-bottom: 8px;
    }

    .capacity-badge.full {
        background: rgba(244, 67, 54, 0.9);
        color: white;
    }

    .rsvp-status-badge {
        display: inline-block;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
    }

    .rsvp-status-badge.going {
        background: #E8F5E9;
        color: #2E7D32;
    }

    .rsvp-status-badge.maybe {
        background: #FFF8E1;
        color: #F57F17;
    }

    .rsvp-status-badge.not-going {
        background: #FFEBEE;
        color: #C62828;
    }

    .attendee-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .attendee-username {
        font-size: 12px;
        color: var(--text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .attendee-rsvp-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        width: fit-content;
    }

    .attendee-rsvp-badge.maybe {
        background: #FFF8E1;
        color: #F57F17;
    }

    .image-modal {
        position: fixed;
        inset: 0;
        background: rgba(10, 10, 20, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        z-index: 60;
    }

    .image-modal-content {
        position: relative;
        max-width: 980px;
        width: 100%;
        max-height: 90vh;
        background: #111;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .image-modal-content img {
        width: 100%;
        height: auto;
        max-height: 90vh;
        object-fit: contain;
        display: block;
    }

    .image-modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
        color: #111;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
    }
</style>
