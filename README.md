# GearGuide (Garagewiki)

A community car-repair library. People browse and search **service manuals**, **common issues** (with a troubleshooting log), and **exploded diagrams**, and contribute their own. New submissions are held for admin review before they go public.

React + Vite + Tailwind on the front end, [Supabase](https://supabase.com) for the database, auth and file storage, deployed on [Vercel](https://vercel.com). Originally built in Base44 and rebuilt as a standalone app.

## Features

- **Browse and search** across all three entry types. Search matches make, model, year, title, category and detail text; every word must match.
- **Accounts:** email and password with a 6-digit emailed code, Google sign-in, and password reset.
- **Contribute** manuals (with cover image and PDF upload up to 50 MB), common issues (photos, severity, symptoms and fix) and exploded diagrams (image and parts list).
- **Troubleshooting log** on each issue, plus a "helpful" vote.
- **Edit and delete your own entries.** Editing an approved entry sends it back to review.
- **Review-first moderation:** new entries are `pending` and visible only to their author and admins. Admins approve or reject (with an optional note) from a review queue. "My entries" shows each submission's status.

## How it works

```
Browser (React SPA on Vercel)
   │  supabase-js, using the public anon key
   ▼
Supabase
   ├─ Auth      email + OTP, Google OAuth, password reset  (emails sent through Resend SMTP)
   ├─ Postgres  manuals · common_issues · exploded_diagrams · troubleshooting_steps · admins
   └─ Storage   public "uploads" bucket for images and PDFs
```

There is no custom server. **Row Level Security** in Postgres is the security boundary, not the UI:

| Who | Can do |
|---|---|
| Anyone | Read `approved` entries and all troubleshooting steps; vote "helpful" on approved issues |
| Signed-in user | Add entries (always saved as `pending`), upload files, edit or delete their own entries, add troubleshooting steps, read their own pending or rejected entries |
| Admin (row in `admins`) | Read everything, approve or reject, edit or delete any entry, delete any troubleshooting step |

A database trigger (`moderation_guard`) forces new rows to `pending` and resets an entry to `pending` when a non-admin edits it, so users cannot approve their own content by tampering with requests. Votes go through a `security definer` function that can only increment the counter on approved issues.

The app talks to Supabase through a small adapter, `src/lib/db.js`, which exposes `db.entities.*`, `db.auth.*` and `db.integrations.Core.UploadPublicFile`. Pages and forms use it rather than calling Supabase directly.

## Setup

### 1. Supabase

1. Create a project at supabase.com.
2. **SQL Editor → New query**, paste `supabase/schema.sql`, and run it. This creates the tables, policies, triggers, vote function, admin table and the `uploads` storage bucket (50 MB file limit; the free plan's maximum is 50 MB).
3. **Authentication → Providers → Email:** set **Email OTP Length** to `6`.
4. **Authentication → Email Templates → Confirm signup:** the body must contain `{{ .Token }}` (for example `<p>Your verification code is <strong>{{ .Token }}</strong></p>`). Custom SMTP has to be enabled before Supabase lets you edit templates.
5. **Authentication → URL Configuration:** set **Site URL** to your production URL and add `https://YOUR-DOMAIN/**` (and `http://localhost:5173/**` for local work) under **Redirect URLs**.
6. Copy the **Project URL** and the **publishable / anon key** from **Project Settings → API Keys**. Never use the `service_role` or secret key in this app.

### 2. Email (custom SMTP with Resend)

Supabase's built-in email is rate-limited and blocks template editing, so use your own SMTP.

1. In Resend, add and verify your sending domain (SPF, DKIM and an optional DMARC record in DNS).
2. Create an API key with **Sending access**.
3. In Supabase, **Authentication → SMTP**: host `smtp.resend.com`, port `465`, username `resend`, password = the API key, sender on your verified domain.

### 3. Google sign-in (optional)

1. In Google Cloud, configure the OAuth consent screen (External, scopes `openid`, `email`, `profile`) and publish it.
2. Create an **OAuth client ID** (Web application). Add your site URL under **Authorized JavaScript origins**, and `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` under **Authorized redirect URIs**.
3. In Supabase, **Authentication → Providers → Google**: enable it and paste the client ID and secret.

The redirect URI points at Supabase, so changing your site's domain later only means adding the new origin in Google.

### 4. Make yourself an admin

Sign in once on the site, then run this in the SQL Editor with your email:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'YOU@example.com'
on conflict do nothing;
```

An **Admin** link with a pending count then appears on the home page.

### 5. Run locally

```bash
cp .env.example .env.local     # add your Supabase URL and anon key
npm install
npm run dev                    # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

### 6. Deploy to Vercel

Import the repo, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, and deploy. `vercel.json` handles single-page-app routing. For a custom domain, add it under **Settings → Domains**, create the CNAME it asks for (DNS only if you use Cloudflare), then update Supabase's Site URL and Redirect URLs.

## Project layout

```
src/
  lib/          supabase.js (client) · db.js (data/auth/upload adapter) · AuthContext.jsx
  pages/        Home · Browse · Search · Detail · Contribute · Edit · MyEntries · Admin · auth pages
  components/   forms (Manual/Issue/Diagram), ResourceCard, ReviewControls, TroubleshootingLog, ui/ (shadcn)
supabase/
  schema.sql    complete schema for a fresh project
  migrations/   incremental changes, for upgrading an existing database
```

## Data model

`manuals`, `common_issues` and `exploded_diagrams` share: `id`, `created_date`, `created_by`, `title`, `make`, `model`, `year`, `category`, plus review fields (`status`, `review_note`, `reviewed_by`, `reviewed_at`). Each adds its own fields:

- **manuals:** `description`, `cover_image`, `manual_file`, `source`
- **common_issues:** `symptoms`, `solution`, `severity`, `images[]`, `helpful_votes`
- **exploded_diagrams:** `system`, `description`, `diagram_image`, `parts`

`troubleshooting_steps` (`parent_id`, `step`, `outcome`, `notes`) hangs off any entry; a trigger deletes them when their parent is deleted. `admins` holds the user IDs with moderation rights.

## Known limits

- Troubleshooting steps are not moderated (admins can delete them).
- Deleting an entry does not delete its uploaded files from storage.
- Editing an approved entry returns it to review, even for small fixes.
- The Supabase free tier pauses inactive projects and limits email volume and file size.

## Ideas for later

Email notifications on approval or rejection, an n8n workflow that suggests moderation decisions, per-step moderation, and cleaning up orphaned uploads.
