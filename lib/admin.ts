import 'server-only'
import { db } from './db'
import { detailLine } from './format'
import { currentYear, splitsFor } from './lists'
import { byPriority, type ItemRow } from './listview'
import { adminVisibleLists } from './adminrules'
import { summarize, type SplitInfo } from './splits'
import type { Person } from './session'

// The Admin tab's data. Every function takes the signed-in person and starts
// from adminVisibleLists, so an admin's own list is never even queried.

export type AdminItem = {
  id: string
  name: string
  detail: string
  photoUrl: string | null
  /** Names of everyone who tapped "I got this" (several on a "more than one" item). */
  buyers: string[]
  split: SplitInfo | null
  /** Removed from the list after it was bought; still needs wrapping. */
  removed: boolean
}

export type AdminList = { ownerId: string; ownerName: string; bought: AdminItem[]; notBought: AdminItem[] }

export type AdminNote = {
  id: string
  kind: 'item_changed' | 'item_removed'
  ownerName: string
  itemName: string
  actorName: string
  changes: { field: string; from: string | null; to: string | null }[]
  buyers: string[]
  createdAt: string
  unread: boolean
}

export type AdminPerson = {
  id: string
  name: string
  role: 'Admin' | 'List owner' | 'Family'
  isOwner: boolean
  hasStarterPin: boolean
  lastSeen: string | null
  giftCount: number
}

type ItemWithOwner = ItemRow & { year: number; deleted_at: string | null }

export async function adminLists(me: Person, year?: number): Promise<AdminList[]> {
  const { data: owners } = await db().from('people').select('id, name').eq('is_owner', true).order('sort_order')
  const visible = adminVisibleLists(me, owners ?? [])
  if (!visible.length) return []

  const { data } = await db()
    .from('items')
    .select('id, owner_id, name, link, size, color, notes, price, is_top_pick, is_cash, cash_for, multi_ok, photo_url, sort_order, carried_from_year, created_at, year, deleted_at')
    .in('owner_id', visible.map((o) => o.id))
    .eq('year', year ?? (await currentYear()))
  const items = ((data ?? []) as ItemWithOwner[]).sort(byPriority)
  const ids = items.map((i) => i.id)

  const [{ data: claims }, splits] = await Promise.all([
    ids.length
      ? db().from('claims').select('item_id, people(name)').in('item_id', ids).order('created_at')
      : Promise.resolve({ data: [] }),
    splitsFor(ids),
  ])
  type ClaimJoin = { item_id: string; people: { name: string } | null }

  return visible.map((owner) => {
    const theirs = items
      .filter((i) => i.owner_id === owner.id)
      .map((item): AdminItem => {
        const split = splits.find((s) => s.item_id === item.id)
        return {
          id: item.id,
          name: item.name,
          detail: item.is_cash ? item.cash_for || 'Cash gift' : detailLine(item),
          photoUrl: item.photo_url,
          buyers: ((claims ?? []) as unknown as ClaimJoin[]).filter((c) => c.item_id === item.id).map((c) => c.people?.name ?? '?'),
          split: split ? summarize(item.price, split.members, split.purchaser_id, Boolean(split.ordered_at)) : null,
          removed: Boolean(item.deleted_at),
        }
      })
    const isBought = (i: AdminItem) => i.buyers.length > 0 || i.split !== null
    return {
      ownerId: owner.id,
      ownerName: owner.name,
      bought: theirs.filter(isBought),
      // A removed item nobody bought needs no wrapping and isn't on the list any more.
      notBought: theirs.filter((i) => !isBought(i) && !i.removed),
    }
  })
}

/** Change and removal alerts addressed to this admin. Never about their own list (they're never sent one). */
export async function adminNotes(me: Person): Promise<AdminNote[]> {
  if (!me.is_admin) return []
  const { data } = await db()
    .from('notifications')
    .select('id, kind, details, created_at, read_at, item_id, actor:people!notifications_actor_id_fkey(name), item:items(name, owner:people!items_owner_id_fkey(name))')
    .eq('recipient_id', me.id)
    .in('kind', ['item_changed', 'item_removed'])
    .order('created_at', { ascending: false })
    .limit(40)
  type Row = {
    id: string; kind: AdminNote['kind']; details: { changes?: AdminNote['changes'] }; created_at: string; read_at: string | null; item_id: string
    actor: { name: string } | null; item: { name: string; owner: { name: string } | null } | null
  }
  const rows = (data ?? []) as unknown as Row[]
  const ids = [...new Set(rows.map((r) => r.item_id))]
  const { data: claims } = ids.length
    ? await db().from('claims').select('item_id, people(name)').in('item_id', ids)
    : { data: [] }
  const splits = await splitsFor(ids)
  type ClaimJoin = { item_id: string; people: { name: string } | null }

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    ownerName: r.item?.owner?.name ?? '',
    itemName: r.item?.name ?? 'an idea',
    actorName: r.actor?.name ?? 'Someone',
    changes: r.details.changes ?? [],
    buyers: [
      ...((claims ?? []) as unknown as ClaimJoin[]).filter((c) => c.item_id === r.item_id).map((c) => c.people?.name ?? '?'),
      ...(splits.find((s) => s.item_id === r.item_id)?.members.map((m) => m.name) ?? []),
    ],
    createdAt: r.created_at,
    unread: r.read_at === null,
  }))
}

export async function unreadAdminNotes(me: Person): Promise<number> {
  if (!me.is_admin) return 0
  const { count } = await db()
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('recipient_id', me.id)
    .in('kind', ['item_changed', 'item_removed'])
    .is('read_at', null)
    .limit(0)
  return count ?? 0
}

export async function adminPeople(me: Person): Promise<AdminPerson[]> {
  if (!me.is_admin) return []
  const [{ data: people }, { data: sessions }, { data: claims }, { data: members }] = await Promise.all([
    db().from('people').select('id, name, is_owner, is_admin, pin_is_starter, sort_order').order('sort_order').order('name'),
    db().from('sessions').select('person_id, last_seen_at').is('revoked_at', null),
    db().from('claims').select('buyer_id'),
    db().from('split_members').select('person_id'),
  ])
  return (people ?? []).map((p) => {
    const seen = (sessions ?? []).filter((s) => s.person_id === p.id).map((s) => s.last_seen_at).sort().at(-1) ?? null
    return {
      id: p.id,
      name: p.name,
      role: p.is_admin ? 'Admin' : p.is_owner ? 'List owner' : 'Family',
      isOwner: p.is_owner,
      hasStarterPin: p.pin_is_starter,
      lastSeen: seen,
      giftCount:
        (claims ?? []).filter((c) => c.buyer_id === p.id).length + (members ?? []).filter((m) => m.person_id === p.id).length,
    }
  })
}
