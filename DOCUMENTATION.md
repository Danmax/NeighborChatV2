# Neighbor Chat — Documentation

## Overview
Neighbor Chat is a community‑focused web app built with Svelte + Supabase. It supports onboarding, profiles, events, celebrations, contacts, messaging, realtime 1‑on‑1 chat, and an admin dashboard.

## Tech Stack
- **Frontend:** Svelte + Vite
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage)
- **Serverless:** Vercel API routes (`/api/*`)

## Local Development
```bash
npm install
npm run dev
```

## Environment Variables
Set these in Vercel (or `.env` locally if you add dotenv support):

### Required (App)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Required (AI Drafts)
- `SUPABASE_SERVICE_ROLE_KEY`  (server‑only)
- `OPENAI_API_KEY`

### Optional
- `OPENAI_MODEL` (default: `gpt-4o-mini`)

## Supabase Setup
### 1) Run SQL Migrations
Apply migrations in order (see repo root: `migration_*.sql`).

Notable recent migrations:
- `migration_031_admin_backend.sql` — admin roles + settings + options
- `migration_033_send_event_notification_text_ids.sql`
- `migration_034_send_event_notification_resolve_user_ids.sql`
- `migration_029_invite_speaker_by_email.sql`
- `migration_030_drop_uuid_invite_speaker.sql`
- `migration_032_drop_uuid_update_speaker_invite.sql`

### 2) Set Admin Role
To access `/admin`, update your role:
```sql
UPDATE public.user_profiles
SET role = 'admin'
WHERE user_id = '<your-auth-user-id>';
```

## Admin Dashboard
Route: `#/admin`

Admins can manage:
- Branding (name, logo, tagline)
- AI settings toggle
- Event manager access requests
- Status options (presence)
- Interests list
- Feedback review
- Usage metrics & DB status

Event managers can only review access requests.

## AI Event Drafts
AI drafts are generated via the Vercel API route:
- `POST /api/ai-event-draft`

Rules:
- **Admin or event_manager only**
- Always returns **draft** status
- Uses ChatGPT (`gpt-4o-mini` by default)
- Logs to `ai_generation_requests`

The event form has an “AI Draft” button for eligible users.

## Events
Event data is stored in `community_events` and `event_data` JSONB:
- Potluck items live in `event_data.items`
- RSVP data lives in `event_participants`

Event notifications are sent using:
- `send_event_notification(TEXT, TEXT, TEXT[])`

## Realtime & Presence
- Presence channel is initialized globally in `App.svelte`.
- Invite listeners are always active to receive chat requests on any page.

## Deployment (Vercel)
- Frontend deploys as static + API routes.
- Ensure env vars are set in the **Production** environment.
- Redeploy after env var changes.

## Common Troubleshooting
- **500 from /api/ai-event-draft** → missing server env vars (`SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY`).
- **Invite speaker ambiguity** → remove UUID overload migrations (`migration_030`, `migration_032`).
- **Event notifications error** → ensure `migration_034` is applied.

---

If you need a more formal API reference or architecture diagram, let me know and I’ll add it.
