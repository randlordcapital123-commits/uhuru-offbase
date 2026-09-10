# Uhuru Digital Contact Base — Supabase setup

This app used to store contacts only in your browser (IndexedDB). It now
stores them in a real Supabase (Postgres) database, so your contacts sync
across every device/browser you open the app from, and survive clearing
browser data.

The UI, sales pipeline, dashboard and analytics are all unchanged — only
where the data lives has changed.

## 1. Create a Supabase project
1. Go to https://supabase.com and sign in (free tier is enough).
2. Click **New project**, pick an org, name, password and region.
3. Wait ~1–2 minutes for it to provision.

## 2. Create the `contacts` table
1. In your project, open **SQL Editor** (left sidebar).
2. Click **New query**.
3. Paste the entire contents of `supabase-schema.sql` (included in this
   folder) and click **Run**.
4. Confirm a `contacts` table now appears under **Table Editor**.

## 3. Get your API keys
1. Go to **Project Settings -> API**.
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`).
3. Copy the **anon / public** key (a long string) — NOT the `service_role`
   key, which must never be used in a browser app.

## 4. Connect the app
1. Open `app.js` in a text editor.
2. Near the top, find:
   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   ```
3. Replace both values with the ones from step 3.
4. Save the file.

## 5. Run it
Open `index.html` in a browser (double-click it, or host the folder
anywhere — Netlify, Vercel, GitHub Pages, or any static web host all
work, since this is still a plain HTML/CSS/JS app, just talking to
Supabase over the internet instead of using IndexedDB).

If the config is missing/incorrect you'll see:
`Database error: Supabase is not configured yet...`

## Notes on this migration
- **Same field names.** The database columns match the app's existing
  field names exactly (`business`, `phone`, `lastCalled`, `followUp`,
  `siteUrl`, etc.), including the camelCase ones — they're created as
  quoted identifiers in Postgres. This let the migration swap out only
  the data-access layer (6 functions in `app.js`: `openDB`, `all`,
  `put`, `update`, `del`, `clearDB`) without touching the 900+ lines of
  UI, dashboard, CSV/VCF/JSON import-export, or analytics logic.
- **Security (RLS).** The table has Row Level Security enabled with a
  permissive "allow all" policy for the `anon` key — appropriate for a
  single salesperson or small trusted team sharing one link/app. If you
  later add a login (Supabase Auth), tighten this policy to scope rows
  per user (see the comment in `supabase-schema.sql`).
- **CSV / VCF / JSON import & backup still work** the same as before —
  they now read from and write to Supabase instead of IndexedDB.
- **Multi-tab / multi-device:** since data now lives in one shared
  database, two people (or two tabs) editing at once will both write to
  the same table. There's no real-time push yet (each tab refreshes
  from the database after its own edits) — the schema includes a
  commented-out line to enable Supabase Realtime if you want live
  updates across open tabs later.
