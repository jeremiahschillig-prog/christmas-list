-- ============================================================
-- Family Christmas List — seasons (step 8)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once. Changes no existing data.
-- ============================================================
--
-- Starting a new Christmas has to happen all at once: a half-finished start
-- (new season created, ideas only partly moved) would be a mess to untangle by
-- hand. So it's a database function, which either completes entirely or not
-- at all. lib/seasons.ts holds the same rules for the preview the admin sees
-- before pressing the button.

-- A fresh copy of a "more than one is fine" idea points back to the one it was
-- copied from, so an undo can tell copies (delete) from moved ideas (move back).
alter table items add column if not exists carried_from_item uuid references items(id) on delete set null;

create or replace function start_season(new_year int) returns json
language plpgsql
set search_path = public
as $$
declare
  old_year int;
  moved int;
  copied int;
  kept int;
begin
  select max(year) into old_year from seasons;
  if new_year is distinct from old_year + 1 then
    raise exception 'The next season must be %', old_year + 1;
  end if;

  insert into seasons (year) values (new_year);

  -- "More than one is fine" ideas someone bought: the bought one stays in last
  -- year; a fresh copy starts the new one.
  insert into items (owner_id, year, name, link, size, color, notes, price, is_top_pick, is_cash, cash_for,
                     multi_ok, photo_url, photo_source, sort_order, carried_from_year, carried_from_item, created_by)
  select i.owner_id, new_year, i.name, i.link, i.size, i.color, i.notes, i.price, i.is_top_pick, i.is_cash, i.cash_for,
         i.multi_ok, i.photo_url, i.photo_source, i.sort_order, old_year, i.id, i.created_by
  from items i
  where i.year = old_year and i.deleted_at is null and i.multi_ok
    and exists (select 1 from claims c where c.item_id = i.id);
  get diagnostics copied = row_count;

  -- Ideas nobody bought or went in on: move them to the new year.
  update items i
  set year = new_year, carried_from_year = old_year
  where i.year = old_year and i.deleted_at is null
    and not exists (select 1 from claims c where c.item_id = i.id)
    and not exists (select 1 from splits s where s.item_id = i.id);
  get diagnostics moved = row_count;

  select count(*) into kept from items where year = old_year and deleted_at is null;

  return json_build_object('year', new_year, 'moved', moved, 'copied', copied, 'kept', kept);
end;
$$;

-- Undoing a season start, for a button pressed by mistake. Only allowed while
-- nothing has happened in the new season yet: no new ideas and no purchases.
create or replace function undo_season(season_year int) returns json
language plpgsql
set search_path = public
as $$
declare
  latest int;
  moved_back int;
  removed int;
begin
  select max(year) into latest from seasons;
  if season_year is distinct from latest or (select count(*) from seasons) < 2 then
    raise exception 'Only the newest season can be undone';
  end if;
  if exists (select 1 from items where year = season_year and carried_from_year is null) then
    raise exception 'Ideas have been added to % since it started', season_year;
  end if;
  if exists (select 1 from claims c join items i on i.id = c.item_id where i.year = season_year)
     or exists (select 1 from splits s join items i on i.id = s.item_id where i.year = season_year) then
    raise exception 'Gifts have been marked in % since it started', season_year;
  end if;

  delete from items where year = season_year and carried_from_item is not null;
  get diagnostics removed = row_count;

  update items set year = season_year - 1, carried_from_year = null
  where year = season_year and carried_from_year = season_year - 1;
  get diagnostics moved_back = row_count;

  delete from list_reviews where year = season_year;
  delete from seasons where year = season_year;

  return json_build_object('year', season_year, 'moved_back', moved_back, 'removed', removed);
end;
$$;

-- Only the app's server may call these.
revoke all on function start_season(int) from public, anon, authenticated;
revoke all on function undo_season(int) from public, anon, authenticated;
grant execute on function start_season(int) to service_role;
grant execute on function undo_season(int) to service_role;

-- What you should see after Run: both functions listed.
select proname as function_name from pg_proc where proname in ('start_season', 'undo_season') order by proname;
