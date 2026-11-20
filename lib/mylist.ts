import 'server-only'
import { db } from './db'
import { currentYear } from './lists'
import { byPriority, type ItemRow } from './listview'
import { canEditList, type ListPerson } from './permissions'

// Data for the My List tab. Like an owner's own list view, it never fetches
// purchases: the edit screen shows no status, whoever is editing.

export type Editable = { id: string; name: string; isMe: boolean }

export type ItemForEdit = ItemRow & { photo_source: 'link' | 'upload' | null }

async function person(id: string): Promise<(ListPerson & { name: string }) | null> {
  const { data } = await db().from('people').select('id, name, is_owner, is_admin').eq('id', id).maybeSingle()
  return data
}

/** The lists this person may edit: their own first, then (for parents) the kids'. */
export async function editableLists(me: ListPerson): Promise<Editable[]> {
  const { data } = await db().from('people').select('id, name, is_owner, is_admin').eq('is_owner', true).order('sort_order')
  return (data ?? [])
    .filter((p) => canEditList(me, p))
    .map((p) => ({ id: p.id, name: p.name, isMe: p.id === me.id }))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe))
}

/** Throws unless `me` may edit `ownerId`'s list. Returns the owner. */
export async function assertCanEdit(me: ListPerson, ownerId: string) {
  const owner = await person(ownerId)
  if (!owner || !canEditList(me, owner)) throw new Error('not allowed')
  return owner
}

export async function itemsForEdit(ownerId: string): Promise<ItemForEdit[]> {
  const { data } = await db()
    .from('items')
    .select('id, owner_id, name, link, size, color, notes, price, is_top_pick, is_cash, cash_for, multi_ok, photo_url, photo_source, sort_order, carried_from_year, created_at')
    .eq('owner_id', ownerId)
    .eq('year', await currentYear())
    .is('deleted_at', null)
  return ((data ?? []) as ItemForEdit[]).sort(byPriority)
}

/** Everyone who has bought, or is going in on, an item. Used only to address change alerts. */
export async function buyersOf(itemId: string): Promise<string[]> {
  const [{ data: claims }, { data: splits }] = await Promise.all([
    db().from('claims').select('buyer_id').eq('item_id', itemId),
    db().from('splits').select('split_members(person_id)').eq('item_id', itemId),
  ])
  const ids = [
    ...(claims ?? []).map((c) => c.buyer_id),
    ...(splits ?? []).flatMap((s) => (s.split_members as { person_id: string }[]).map((m) => m.person_id)),
  ]
  return [...new Set(ids)]
}

export async function adminIds(): Promise<string[]> {
  const { data } = await db().from('people').select('id').eq('is_admin', true)
  return (data ?? []).map((p) => p.id)
}
