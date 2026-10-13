# GearGuide (Garagewiki)

Community car-repair library: manuals, common issues, exploded diagrams. React + Vite + Tailwind, backed by Supabase. Deploys to Vercel.

## 1. Supabase setup (one time)
1. Create a project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run. This creates the tables, row-level security, the vote function, and the public `uploads` storage bucket.
3. Authentication → Email Templates → **Confirm signup**: include `{{ .Token }}` in the body so users get the 6-digit code the Register page asks for.
4. Authentication → URL Configuration: set Site URL to your Vercel URL and add `http://localhost:5173/**` and `https://YOUR-DOMAIN/**` to Redirect URLs (needed for Google sign-in and password reset links).
5. (Optional) Authentication → Providers → Google: add your Google OAuth client ID/secret.

## 2. Run locally
```bash
cp .env.example .env.local   # fill in URL + anon key from Project Settings → API
npm install
npm run dev
```

## 3. Deploy to Vercel
Import the repo (or run `vercel`), add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, deploy. `vercel.json` already handles SPA routing.

## How it maps from Base44
| Base44 | Now |
|---|---|
| `db.entities.*` | `src/lib/db.js` → Supabase tables |
| `db.auth.*` | `src/lib/db.js` → Supabase Auth |
| `UploadPublicFile` | Supabase Storage bucket `uploads` |
| Public app settings gate | Removed; browsing is public, `/contribute` requires login |

## Behavior to know about
- Anyone can read. Signed-in users can add entries and troubleshooting steps and edit/delete their own. "Helpful" votes work for everyone (issues only).
- Entity schemas were inferred from the forms because the export had no schema files; check `supabase/schema.sql` against your Base44 data model.
- Your existing Base44 records are not in the export. Export them from the Base44 dashboard (CSV/JSON) and import into the matching tables (Supabase → Table Editor → Import).
