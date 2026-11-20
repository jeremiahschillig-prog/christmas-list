import 'server-only'
import { db } from './db'
import { detailLine } from './format'
import { currentYear, splitsFor } from './lists'
import { summarize, type SplitInfo } from './splits'

// My Gifts: everything you've said you'll get, on every list, plus the notes
// that concern those gifts. A purchase is only ever shown to the person who
// made it (and, in step 7, to the admins), never to the list's owner.

export type Change = { field: string; from: string | null; to: string | null }

export type Gift = {
  itemId: string
  ownerId: string
  ownerName: string
  name: string
  detail: string
  link: string | null
  photoUrl: string | null
  /** bought = "I got this"; together = a group gift you're in. */
  kind: 'bought' | 'together'
  split: SplitInfo | null
  /** Set when the owner removed it after you'd bought it. */
  removedBy: string | null
  /** What changed after you bought it, newest note first. */
  changes: Change[]
}

export type Note = {
  id: string
  kind: 'item_changed' | 'item_removed' | 'split_joined' | 'split_left' | 'split_purchaser'
  itemName: string
  actorName: string
  details: Record<string, unknown>
  createdAt: string
  unread: boolean
}

type ItemJoin = {
  id: string
  owner_id: string
  name: string
  size: string | null
  color: string | null
  price: number | string | null
  link: string | null
  photo_url: string | null
  is_cash: boolean
  cash_for: string | null
  year: number
  deleted_at: string | null
  owner: { name: string } | null
  remover: { name: string } | null
}

const ITEM = 'id, owner_id, name, size, color, price, link, photo_url, is_cash, cash_for, year, deleted_at, owner:people!items_owner_id_fkey(name), remover:people!items_deleted_by_fkey(name)'

/** Ids of every item this person is buying, alone or together, this season. */
async function myGiftItemIds(personId: string): Promise<{ claimed: string[]; together: string[] }> {
  const [{ data: claims }, { data: memberships }] = await Promise.all([
    db().from('claims').select('item_id').eq('buyer_id', personId),
    db().from('split_members').select('splits(item_id)').eq('person_id', personId),
  ])
  return {
    claimed: (claims ?? []).map((c) => c.item_id),
    together: (memberships ?? []).map((m) => (m.splits as unknown as { item_id: string }).item_id),
  }
}

/** Notes that belong on My Gifts: group-gift activity, and changes to gifts you're buying. */
function notesQuery(personId: string, itemIds: string[]) {
  const kinds = '(split_joined,split_left,split_purchaser)'
  const filter = itemIds.length ? `kind.in.${kinds},item_id.in.(${itemIds.join(',')})` : `kind.in.${kinds}`
  return db().from('notifications').select('id, kind, details, created_at, read_at, item:items(name), actor:people!notifications_actor_id_fkey(name)')
    .eq('recipient_id', personId)
    .or(filter)
}

/** For the tab bar's badge. */
export async function unreadGiftNotes(personId: string): Promise<number> {
  const { claimed, together } = await myGiftItemIds(personId)
  const { data } = await notesQuery(personId, [...claimed, ...together]).is('read_at', null)
  return data?.length ?? 0
}

export async function giftsFor(personId: string): Promise<{ groups: { ownerName: string; ownerId: string; gifts: Gift[] }[]; notes: Note[]; count: number }> {
  const year = await currentYear()
  const { claimed, together } = await myGiftItemIds(personId)
  const ids = [...new Set([...claimed, ...together])]
  if (!ids.length) {
    const { data } = await notesQuery(personId, []).order('created_at', { ascending: false }).limit(30)
    return { groups: [], notes: toNotes(data), count: 0 }
  }

  const [{ data: items }, splits, { data: notes }] = await Promise.all([
    db().from('items').select(ITEM).in('id', ids).eq('year', year),
    splitsFor(together),
    notesQuery(personId, ids).order('created_at', { ascending: false }).limit(50),
  ])

  const changesByItem = new Map<string, Change[]>()
  const { data: changeNotes } = await db()
    .from('notifications')
    .select('item_id, details, created_at')
    .eq('recipient_id', personId)
    .eq('kind', 'item_changed')
    .in('item_id', ids)
    .order('created_at', { ascending: false })
  for (const n of changeNotes ?? []) {
    const list = changesByItem.get(n.item_id) ?? []
    list.push(...(((n.details as { changes?: Change[] }).changes) ?? []))
    changesByItem.set(n.item_id, list)
  }

  const gifts: Gift[] = ((items ?? []) as unknown as ItemJoin[]).map((item) => {
    const split = splits.find((s) => s.item_id === item.id)
    return {
      itemId: item.id,
      ownerId: item.owner_id,
      ownerName: item.owner?.name ?? '',
      name: item.name,
      detail: item.is_cash ? item.cash_for || 'Cash gift' : detailLine(item),
      link: item.link,
      photoUrl: item.photo_url,
      kind: split ? 'together' : 'bought',
      split: split ? summarize(item.price, split.members, split.purchaser_id, Boolean(split.ordered_at)) : null,
      removedBy: item.deleted_at ? item.remover?.name ?? 'the owner' : null,
      changes: changesByItem.get(item.id) ?? [],
    }
  })

  const groups = new Map<string, { ownerName: string; ownerId: string; gifts: Gift[] }>()
  for (const g of gifts) {
    const group = groups.get(g.ownerId) ?? { ownerName: g.ownerName, ownerId: g.ownerId, gifts: [] }
    group.gifts.push(g)
    groups.set(g.ownerId, group)
  }

  return {
    groups: [...groups.values()].sort((a, b) => a.ownerName.localeCompare(b.ownerName)),
    notes: toNotes(notes),
    count: gifts.length,
  }
}

function toNotes(rows: unknown[] | null): Note[] {
  type Row = { id: string; kind: Note['kind']; details: Record<string, unknown>; created_at: string; read_at: string | null; item: { name: string } | null; actor: { name: string } | null }
  return ((rows ?? []) as Row[]).map((n) => ({
    id: n.id,
    kind: n.kind,
    itemName: n.item?.name ?? 'an idea',
    actorName: n.actor?.name ?? 'Someone',
    details: n.details,
    createdAt: n.created_at,
    unread: n.read_at === null,
  }))
}

/** Marks these notes read; only ever the signed-in person's own. */
export async function markRead(personId: string, noteIds: string[]): Promise<void> {
  if (!noteIds.length) return
  await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', personId).in('id', noteIds).is('read_at', null)
}
