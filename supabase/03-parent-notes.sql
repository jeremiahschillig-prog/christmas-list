-- ============================================================
-- Parents' notes (Nov 2026)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once. It only adds; nothing is removed.
-- ============================================================
--
-- A note Jeremy or Jessica puts on an idea on a kid's list, such as
-- "We already bought this on sale. Reach out to us if you'd like to
-- give it." Everyone sees it in red EXCEPT the list's owner.
--
-- It lives in its own table rather than as a column on items, for the
-- same reason claims do: the owner's list is loaded from items, and the
-- app never reads this table when the owner is looking. Nothing to leak.

create table if not exists parent_notes (
  item_id    uuid primary key references items(id) on delete cascade,
  note       text not null check (char_length(note) between 1 and 300),
  set_by     uuid not null references people(id),
  updated_at timestamptz not null default now()
);

-- Same security model as every other table: no public access at all,
-- only the app's server (service_role).
alter table parent_notes enable row level security;
revoke all on table parent_notes from anon, authenticated;
grant all on table parent_notes to service_role;

-- What you should see after Run: one row, parent_notes.
select table_name from information_schema.tables where table_name = 'parent_notes';
