-- ============================================================
-- Uhuru Digital Contact Base — Supabase schema
-- Run this ONCE in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)
-- ============================================================

create table if not exists public.contacts (
  id           bigint generated always as identity primary key,
  "number"     integer,                    -- display row number (recomputed by the app)
  business     text not null,
  address      text,
  phone        text not null,
  website      text default '',            -- their existing website, if any
  created      timestamptz default now(),
  called       boolean default false,
  "lastCalled" timestamptz,
  notes        text default '',
  recall       boolean default false,
  lead         boolean default false,
  status       text default 'not-called'
               check (status in ('not-called','called','agreed','building','live')),
  price        numeric default 0,          -- quote price (R)
  paid         numeric default 0,          -- amount paid (R)
  "followUp"   text default '',            -- 'YYYY-MM-DD' or '' (kept as text: app allows blank)
  "siteUrl"    text default ''             -- link to the site we built, once live
);

-- Helpful indexes
create index if not exists contacts_phone_idx  on public.contacts (phone);
create index if not exists contacts_status_idx on public.contacts (status);
create index if not exists contacts_number_idx on public.contacts ("number");

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.contacts enable row level security;

-- This app has no login screen — it talks to Supabase using the
-- public "anon" key, so by default anyone with that key (i.e. anyone
-- who has the app URL) can read/write. That's fine for a single
-- salesperson or a small trusted team.
--
-- If you later add Supabase Auth (a login), replace this policy with
-- one scoped to auth.uid(), e.g. a user_id column + `using (auth.uid() = user_id)`.
drop policy if exists "Allow all for anon" on public.contacts;
create policy "Allow all for anon"
  on public.contacts
  for all
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- Realtime (optional): lets multiple devices see live updates.
-- Uncomment if you want to wire up Supabase Realtime later.
-- ------------------------------------------------------------
-- alter publication supabase_realtime add table public.contacts;
