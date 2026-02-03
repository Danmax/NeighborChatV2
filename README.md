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

---

For full setup and migrations, see `DOCUMENTATION.md`.
