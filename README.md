# Neighbor Chat — Summary

Neighbor Chat is a community platform for events, celebrations, contacts, and 1:1 chat. It includes an admin dashboard and AI‑assisted event drafting.

## Highlights
- Onboarding + public profiles
- Realtime 1:1 chat with invites
- Events (potluck, dev meetup, social, etc.)
- Celebrations / kudos board
- Contacts + direct messages
- Admin dashboard for branding, roles, feedback, metrics
- AI event draft (ChatGPT) for event managers

## Quick Start
```bash
npm install
npm run dev
```

## Admin Access
Set your user role to admin:
```sql
UPDATE public.user_profiles
SET role = 'admin'
WHERE user_id = '<your-auth-user-id>';
```

Admin route: `#/admin`

## AI Event Drafts
Uses `/api/ai-event-draft` (serverless) with ChatGPT. Requires:
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

AI drafts are always saved as **draft**.

## Env Vars (Minimum)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## Latest Updates (Feb 2026)

### Celebrations: Emoji Art Message Styling
- Added per-celebration message style options:
  - `message_bg_color`
  - `message_bg_pattern` (`none`, `dots`, `stripes`, `grid`, `sparkle`)
- Create/Edit forms now include color + pattern pickers with live preview.
- Styles are rendered in:
  - celebrations feed cards
  - celebration detail cards

Required migration:
```sql
-- run in Supabase SQL editor
-- file: migration_086_celebration_message_style.sql
ALTER TABLE public.celebrations
ADD COLUMN IF NOT EXISTS message_bg_color text DEFAULT '#FFF4D6';

ALTER TABLE public.celebrations
ADD COLUMN IF NOT EXISTS message_bg_pattern text DEFAULT 'none';
```

Example celebration payload:
```json
{
  "category": "birthday",
  "title": "Happy Birthday Alex",
  "message": "Wishing you an amazing year ahead 🎉",
  "message_bg_color": "#E8F2FF",
  "message_bg_pattern": "sparkle",
  "celebration_date": "2016-02-11"
}
```

### Celebrations: Birthday/Anniversary Pseudo Dates
- Birthday posts now show countdown labels (for example, `Birthday countdown: 12 days`).
- Anniversary posts now show ordinal year labels from source date (for example, `10th year anniversary` from `02/11/2016` in 2026).

### Spotify Song Search Preview
- Spotify `preview_url` is often unavailable in newer API flows.
- Added fallback preview behavior:
  - If `preview_url` exists: native audio control
  - If not: inline Spotify embed preview button
- Applied to:
  - Profile music search
  - Celebrations create/edit music search

### GIF Picker Improvements
- Fixed overlapping/stacking behavior in GIF selection.
- GIF tiles now:
  - use contained image previews
  - avoid hover scale overlap
  - have improved spacing and responsive columns

### Games UI Updates
- Combined `profile-setup-card` and `user-info` into one dashboard header card.
- Hid Games `Awards` tab for now.

### Navigation Update
- Removed `Pricing` from mega menu shortcuts.

### Data Binding Contracts

#### Games
| Flow | UI bindings | Service payload | DB table/columns |
|---|---|---|---|
| Game profile save | `src/routes/games/GamesScreen.svelte` (`gameProfileForm.*`, `handleSaveGameProfile`) | `saveMyGameProfile(...)` in `src/services/games.service.js` | `public.game_player_profiles` (`display_name`, `avatar`, `skill_level`, `favorite_game_types`, `bio`, `visibility`) |
| Template create/edit | `src/components/games/CreateGameTemplateModal.svelte` (`templateData`) + `handleSubmitTemplate` in `src/routes/games/GamesScreen.svelte` | `createGameTemplate(...)`, `updateGameTemplate(...)` in `src/services/games.service.js` | `public.game_templates` (`name`, `description`, `icon`, `game_type`, `category`, `min_players`, `max_players`, `estimated_duration_minutes`, `rules`, `config`) |
| Session scheduling | `src/routes/games/GamesScreen.svelte` (`sessionForm.*`, `handleScheduleSession`) | `createGameSession(...)` in `src/services/games.service.js` | `public.game_sessions` (`template_id`, `scheduled_start`, `team_mode`, `max_players`, `allow_self_join`, `registration_deadline`, `settings->heat_count`, `settings->championship_enabled`) |
| Player join/add | Buttons and modal flows in `src/routes/games/GamesScreen.svelte` | `joinGameSession(...)`, `addPlayerToSession(...)` in `src/services/games.service.js` | `public.game_players` (`session_id`, `membership_id`, `team_id`, `final_score`, `status`) |

#### Celebrations
| Flow | UI bindings | Service payload | DB table/columns |
|---|---|---|---|
| Create celebration | `src/routes/celebrations/CelebrationsScreen.svelte` (`message`, `messageBgColor`, `messageBgPattern`, `selectedGif`, `musicUrl`, `celebrationDate`, `handleCreate`) | `createCelebration(...)` in `src/services/celebrations.service.js` | `public.celebrations` (`type`, `honoree`, `message`, `gif_url`, `image_url`, `music_url`, `message_bg_color`, `message_bg_pattern`, `celebration_date`) |
| Edit celebration | `src/routes/celebrations/CelebrationDetailScreen.svelte` (`handleEditSave`) | `updateCelebrationInDb(...)` in `src/services/celebrations.service.js` | `public.celebrations` (same columns as above) |

#### Admin
| Flow | UI bindings | Service payload | DB table/columns |
|---|---|---|---|
| Community settings | `src/routes/admin/AdminScreen.svelte` (`communityVisibility`, `communityFeatureSettings.*`, `saveCommunityInstanceSettings`) | `updateMyCommunityInstanceSettings(...)` in `src/services/admin.service.js` | `public.community_instances` (`is_public`, `settings`, `enabled_features`) |
| Community creation | `src/routes/admin/AdminScreen.svelte` (`newCommunity.*`, `handleCreateCommunity`) | `createCommunityInstance(...)` in `src/services/admin.service.js` | `public.community_instances` + `public.instance_memberships` (admin membership row) |
| Feedback review | `src/routes/admin/AdminScreen.svelte` (`feedbackFilter`, `filteredFeedback`, status actions) | `updateFeedbackStatus(...)` in `src/services/feedback.service.js` | RPC `admin_update_feedback(p_id, p_status, p_resolution_note)` on `public.feedback` |

---

For full setup and migrations, see `DOCUMENTATION.md`.
