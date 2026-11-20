-- ============================================================
-- Family Christmas List — database schema
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run while we're building: it drops and rebuilds
-- everything. (Once the family is using it, changes go in new
-- numbered files instead, the same way the meal planner does.)
-- ============================================================
--
-- THE SECURITY MODEL, in one paragraph. Row-level security is
-- switched on for every table below and NO policies are added.
-- That means the public keys can read and write nothing at all.
-- Only the app's server routes, holding the secret key, can
-- touch the data, and they are where the surprise rule is
-- enforced: "never tell a list owner the status of their own
-- list." A curious kid with browser dev tools finds nothing,
-- because the browser never talks to the database.

drop table if exists notifications cascade;
drop table if exists split_members cascade;
drop table if exists splits cascade;
drop table if exists claims cascade;
drop table if exists items cascade;
drop table if exists list_reviews cascade;
drop table if exists seasons cascade;
drop table if exists pin_attempts cascade;
drop table if exists sessions cascade;
drop table if exists people cascade;

-- --- People ------------------------------------------------
-- Everyone who can sign in: the four list owners and every
-- relative who buys. Owners have a list; admins (Jeremy and
-- Jessica) see who bought what on every list but their own.
create table people (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  is_owner        boolean not null default false,
  is_admin        boolean not null default false,
  -- Hashed with scrypt by the app ("scrypt$salt$hash"). The PIN
  -- itself is never stored.
  pin_hash        text not null,
  -- True while the person still has the starter PIN an admin gave
  -- them. Sign-in offers to change it; an admin reset sets it again.
  pin_is_starter  boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  -- Only owners can be admins.
  check (not is_admin or is_owner)
);

-- --- Sessions ("this phone remembers me") -------------------
-- The cookie holds a random token; only its SHA-256 is stored, so
-- a copy of this table can't be used to sign in. Resetting
-- someone's PIN revokes their sessions.
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,
  person_id     uuid not null references people(id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz
);
create index sessions_person on sessions(person_id);

-- --- PIN attempts --------------------------------------------
-- A 4-digit PIN has only 10,000 possibilities, and the link goes
-- around the family. Wrong guesses are counted so the app can make
-- someone wait after a few misses.
create table pin_attempts (
  id            bigint generated always as identity primary key,
  person_id     uuid not null references people(id) on delete cascade,
  succeeded     boolean not null,
  attempted_at  timestamptz not null default now()
);
create index pin_attempts_recent on pin_attempts(person_id, attempted_at desc);

-- --- Seasons ---------------------------------------------------
-- One row per Christmas. The newest year is the current season.
create table seasons (
  year        int primary key,
  started_at  timestamptz not null default now()
);

-- When a list carries over, buyers see "Not reviewed for 2027
-- yet" and "I got this" is off until the owner taps "My list is
-- up to date", which writes a row here.
create table list_reviews (
  owner_id     uuid not null references people(id) on delete cascade,
  year         int  not null references seasons(year) on delete cascade,
  reviewed_at  timestamptz not null default now(),
  primary key (owner_id, year)
);

-- --- Items -----------------------------------------------------
create table items (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references people(id) on delete cascade,
  year               int  not null references seasons(year),
  name               text not null,
  link               text,
  size               text,
  color              text,
  notes              text,
  price              numeric(10,2),
  is_top_pick        boolean not null default false,
  -- A request for money: no link needed, "what it's for" instead.
  is_cash            boolean not null default false,
  cash_for           text,
  -- "More than one is fine": stays open after a purchase and shows
  -- "N bought so far".
  multi_ok           boolean not null default false,
  photo_url          text,
  -- 'link' = pulled from the item's link, 'upload' = the owner
  -- chose it. A pulled photo is replaced when the link changes; an
  -- uploaded one is kept.
  photo_source       text check (photo_source in ('link','upload')),
  sort_order         int not null default 0,
  -- Set when the item came forward from last year's list ("From
  -- last year" tag).
  carried_from_year  int,
  created_by         uuid references people(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_by         uuid references people(id) on delete set null,
  updated_at         timestamptz not null default now(),
  -- Deleting never removes the row. The owner stops seeing it; if
  -- it was already bought, the buyer and admins still see "Removed
  -- by Ellie: you already bought this."
  deleted_at         timestamptz,
  deleted_by         uuid references people(id) on delete set null
);
create index items_list on items(owner_id, year) where deleted_at is null;

-- --- Claims ("I got this") ------------------------------------
-- One row per purchase. A normal item takes one; a "more than one
-- is fine" item can take several, one per buyer. Undo deletes the row.
create table claims (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references items(id) on delete cascade,
  buyer_id    uuid not null references people(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (item_id, buyer_id)
);
create index claims_buyer on claims(buyer_id);

-- --- Going in together ----------------------------------------
-- A split is started by someone willing to share an item. Others
-- join with an amount. The purchaser starts as whoever started it;
-- any member can take over with "I'll order it". Once it's
-- ordered, the item shows "Taken" to everyone else.
create table splits (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references items(id) on delete cascade,
  started_by    uuid not null references people(id) on delete cascade,
  purchaser_id  uuid not null references people(id) on delete cascade,
  ordered_at    timestamptz,
  created_at    timestamptz not null default now()
);
-- One split per item at a time.
create unique index splits_one_per_item on splits(item_id);

create table split_members (
  split_id   uuid not null references splits(id) on delete cascade,
  person_id  uuid not null references people(id) on delete cascade,
  amount     numeric(10,2) not null check (amount > 0),
  joined_at  timestamptz not null default now(),
  primary key (split_id, person_id)
);

-- --- Notifications --------------------------------------------
-- In-app only. One row per recipient, written when the event
-- happens:
--   item_changed / item_removed: an owner changed or deleted
--     something already bought. Goes to the buyers and to each
--     admin who is not the owner. NEVER to the owner.
--   split_joined / split_left / split_purchaser: going-in-together
--     activity, to the other members.
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references people(id) on delete cascade,
  kind          text not null check (kind in
                  ('item_changed','item_removed','split_joined','split_left','split_purchaser')),
  item_id       uuid references items(id) on delete cascade,
  actor_id      uuid references people(id) on delete set null,
  -- e.g. {"changes":[{"field":"color","from":"Black","to":"Navy"}]}
  --  or  {"amount":50}
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);
create index notifications_inbox on notifications(recipient_id, created_at desc);

-- --- Lock the doors -----------------------------------------
do $$
declare t text;
begin
  foreach t in array array['people','sessions','pin_attempts','seasons','list_reviews',
                           'items','claims','splits','split_members','notifications']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
    -- The app's server key acts as service_role. Newer Supabase projects
    -- no longer grant it access to new tables automatically (found Nov 20:
    -- "permission denied for table people"), so it's granted explicitly.
    execute format('grant all on table %I to service_role', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;

-- The first season.
insert into seasons (year) values (2026);

-- What you should see after Run: every table with rls_on = true.
select tablename, rowsecurity as rls_on
from pg_tables
where schemaname = 'public'
order by tablename;
