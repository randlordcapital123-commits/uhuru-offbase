# Uhuru Digital Contact Base — Supabase edition

This version stores contacts in your Supabase project instead of the
browser's local IndexedDB. That means the data now syncs across every
device/browser that opens the page, instead of being stuck on one phone.

## 1. Create the table (one-time)

1. Open your Supabase project: https://supabase.com/dashboard/project/ghvvqzabpntnlkmxzsvr
2. Go to **SQL Editor → New query**.
3. Paste the contents of `supabase-schema.sql` (included in this folder) and click **Run**.

This creates a `contacts` table with the same fields the app already used
(business, address, phone, status, price, paid, follow-up date, live site
link, etc.), plus a security policy that lets the app's public key read and
write to it.

## 2. The app is already connected

`app.js` has your project URL and anon key filled in at the top:

```js
const SUPABASE_URL = "https://ghvvqzabpntnlkmxzsvr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

Just open `index.html` in a browser (or host the folder anywhere — Netlify,
Vercel, GitHub Pages, or your own server) and it will read/write straight
to Supabase. No build step needed.

## 3. What changed from the old version

- **Storage**: contacts now live in Supabase Postgres, not IndexedDB. The
  app requires an internet connection to load/save — it's no longer
  offline-first.
- **Everything else is identical**: same statuses (Not Called → Called →
  Agreed → Building → Website Live), same dashboard, CSV/VCF/JSON
  import-export, bulk paste, duplicate removal, follow-ups, and themes.
- **Duplicate numbers**: the database now also enforces "one row per phone
  number" at the table level (`contacts_phone_key`), matching what the app
  already checked in the browser.

## 4. Security note — please read

The app talks to Supabase using the **anon** public key, straight from the
browser, with no login. The SQL script grants that key full read/write
access to the `contacts` table. That's normal for a small internal tool,
but it means **anyone who gets hold of the page URL and views its source
can read and edit every contact** — there's no per-user login separating
your data from anyone else's.

If this contact base has sensitive client details and you want it locked to
your team only:
- Add Supabase Auth (email/password or magic link) to the app, and
- Replace the `using (true)` / `with check (true)` policy in
  `supabase-schema.sql` with `using (auth.uid() is not null)` so only
  signed-in users can read/write.

Happy to build that login step if you want it — just ask.

## 5. Multi-device live sync (optional)

Right now, each device pulls fresh data on load/refresh. If you want
changes on one phone to appear instantly on another without refreshing,
uncomment the last line in `supabase-schema.sql`
(`alter publication supabase_realtime add table public.contacts;`) and ask
to have the app wired up to Supabase Realtime subscriptions.
