-- ============================================================================
-- UHURU DIGITAL SOLUTION — CONTACT BASE
-- Run this once in your Supabase project: SQL Editor → New query → Run
-- Project: https://ghvvqzabpntnlkmxzsvr.supabase.co
-- ============================================================================

create table if not exists public.contacts (
  id          serial primary key,
  number      integer,
  business    text not null,
  address     text not null,
  phone       text not null,
  website     text default '',
  created     timestamptz default now(),
  called      boolean default false,
  last_called timestamptz,
  notes       text default '',
  recall      boolean default false,
  lead        boolean default false,
  status      text default 'not-called',
  price       numeric default 0,
  paid        numeric default 0,
  follow_up   date,
  site_url    text default ''
);

-- Keep one row per phone number, mirroring the app's duplicate check.
create unique index if not exists contacts_phone_key on public.contacts (phone);

-- Row Level Security -----------------------------------------------------
-- The app uses your public "anon" key straight from the browser, with no
-- login screen. That means anyone who has the anon key (visible in the page
-- source) can read/write this table. That's fine for a small internal sales
-- tool, but it is NOT private data protection — do not put anything in here
-- you wouldn't want a competitor to see if the URL leaked.
--
-- If you later want this locked to your team only, add Supabase Auth and
-- swap the policies below for `using (auth.uid() is not null)` instead.
alter table public.contacts enable row level security;

drop policy if exists "anon full access" on public.contacts;
create policy "anon full access"
  on public.contacts
  for all
  to anon
  using (true)
  with check (true);

-- Realtime (optional) ------------------------------------------------------
-- Uncomment if you want changes made on one device to push to others live,
-- rather than only on refresh/reload.
-- alter publication supabase_realtime add table public.contacts;
