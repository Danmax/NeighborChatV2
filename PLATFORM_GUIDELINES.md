# Neighbor Chat Platform Guidelines

This document summarizes the platform features, configuration points, and safety practices for operating Neighbor Chat.

## 1) Core Experience
- **Onboarding & Profiles**
  - Google/OAuth sign‑in, profile creation, avatar + banner setup.
  - Public profile view with privacy flags (city/phone/birthday visibility).
  - Favorite movies collection (TMDB search + caching).

- **Community Home**
  - Real‑time 1:1 match portal.
  - Upcoming events, celebrations feed, recent connections.

- **Contacts & Messaging**
  - Save contacts from profile or chat.
  - Inbox messages (stored) + realtime 1:1 chat invites.
  - Message reactions with realtime updates.

## 2) Events System
- **Community Events**
  - Create/edit events with cover images, schedules, locations.
  - Event detail pages with hero cover, organizer info, RSVP.
  - Attendee list with approval/approval status.
  - Notifications to attendees/contacts.

- **Event Types**
  - Potluck, Dev Meetup, Social, Secret Santa, etc.
  - Draft → Published workflow.

- **Potluck Items**
  - Add items, claim items, unclaim/remove.
  - Optional recipe attachment per item.
  - Realtime updates on item changes.

- **Dev Meetup**
  - Speaker invites and proposals.
  - Agenda + organizer workflow.

- **Gift Exchange**
  - Wish list items, templates, matching (auto/manual).
  - Postcards, gifts, and favors messaging.

## 3) Celebrations (Kudos Board)
- Kudos feed with GIFs, images, and reactions.
- Celebration detail page with replies.
- @mentions for notifications.
- Archive rules after 7 days past celebration date.
- Admin/owner edit + archive.

## 4) Games (Feature‑Flagged)
- Game templates (Minute‑to‑Win‑It, Trivia, Bar Games, Skills Check).
- Create game sessions with heats/rounds + championship settings.
- Scoreboard, points, teams, prizes, and winners (template config).

## 5) Recipes
- Recipe create/edit/detail screens.
- Ingredients list editor with add/remove.
- AI‑assisted recipe drafts (admin/event manager only).
- Attach recipes to potluck items.

## 6) Admin / Platform Ops
- **Admin Dashboard**
  - Branding settings
  - AI settings toggle
  - Status + Interest option lists
  - Feedback review
  - Event manager approvals
  - Usage metrics

- **Role Management**
  - Admin + Event Manager access workflows
  - Approval requests managed by admin

## 7) AI Features
- **Event Drafts**
  - Create a draft event from prompt
  - Potluck items included if relevant

- **Recipe Drafts**
  - Fill recipe form from prompt
  - Restricted to admin/event managers

## 8) Storage & Media
- Event images (`event-images`)
- Celebration images (`celebration-images`)
- Profile banners (`profile-banners`)
- Avatars (`avatars`)

## 9) Security & Privacy
- **RLS Enabled** on all core tables.
- **Admin actions** secured through SECURITY DEFINER RPCs.
- **Service role keys** used only on server for AI and caching.
- **Client uploads** validated for image MIME + size.
- **PostgREST schema reload** after migrations that change RPC signatures.

## 10) Recommended Best Practices
- Keep AI endpoints rate‑limited per user.
- Avoid exposing service role endpoints without auth.
- Regularly audit RLS policies and RPC signatures.
- Use `NOTIFY pgrst, 'reload schema';` after new migrations.

---

If you need a deeper admin manual or onboarding docs for end‑users, we can expand this into a full documentation set.
