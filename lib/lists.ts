import 'server-only'
import { db } from './db'
import { isOpen, loadList, statusOf, type ClaimRow, type ItemRow, type ListDeps, type ListView, type SplitRow } from './listview'

// The real database behind lib/listview.ts. The rules are there; this file only fetches.

const ITEM_COLUMNS =
  'id, owner_id, name, link, size, color, notes, price, is_top_pick, is_cash, cash_for, multi_ok, photo_url, sort_order, carried_from_year, created_at'

export async function currentYear(): Promise<number> {
  const { data } = await db().from('seasons').select('year').order('year', { ascending: false }).limit(1).single()
  if (!data) throw new Error('No season set up. Has supabase/01-schema.sql been run?')
  return data.year
}

async function claimsFor(itemIds: string[]): Promise<ClaimRow[]> {
  if (!itemIds.length) return []
  const { data } = await db().from('claims').select('item_id, buyer_id').in('item_id', itemIds)
  return data ?? []
}

export async function splitsFor(itemIds: string[]): Promise<SplitRow[]> {
  if (!itemIds.length) return []
  const { data } = await db()
    .from('splits')
    .select('item_id, ordered_at, purchaser_id, split_members(person_id, amount, joined_at, people(name))')
    .in('item_id', itemIds)
  type Member = { person_id: string; amount: number | string; joined_at: string; people: { name: string } | null }
  return (data ?? []).map((s) => ({
    item_id: s.item_id,
    ordered_at: s.ordered_at,
    purchaser_id: s.purchaser_id,
    members: (s.split_members as unknown as Member[]).map((m) => ({
      id: m.person_id,
      name: m.people?.name ?? '',
      amount: Number(m.amount),
      joined_at: m.joined_at,
    })),
  }))
}

function deps(year: number): ListDeps {
  return {
    items: async (ownerId) => {
      const { data } = await db()
        .from('items')
        .select(ITEM_COLUMNS)
        .eq('owner_id', ownerId)
        .eq('year', year)
        .is('deleted_at', null)
      return (data ?? []) as ItemRow[]
    },
    claims: claimsFor,
    splits: splitsFor,
    reviewed: async (ownerId) => {
      const { data } = await db().from('list_reviews').select('owner_id').eq('owner_id', ownerId).eq('year', year).maybeSingle()
      return Boolean(data)
    },
  }
}

export async function listFor(viewerId: string, ownerId: string): Promise<ListView> {
  return loadList(viewerId, ownerId, deps(await currentYear()))
}

export type OwnerCard = { id: string; name: string; isMe: boolean; openCount: number | null; itemCount: number }

/**
 * The Home screen: a card per list owner. Your own card gets an item count only,
 * never an open count, and purchases on your own items are never fetched.
 */
export async function homeFor(viewerId: string): Promise<{ year: number; cards: OwnerCard[]; myGiftCount: number }> {
  const year = await currentYear()
  const [{ data: owners }, { data: items }] = await Promise.all([
    db().from('people').select('id, name').eq('is_owner', true).order('sort_order'),
    db().from('items').select(ITEM_COLUMNS).eq('year', year).is('deleted_at', null),
  ])
  const all = (items ?? []) as ItemRow[]

  // Purchase data only for OTHER people's items.
  const othersIds = all.filter((i) => i.owner_id !== viewerId).map((i) => i.id)
  const [claims, splits] = await Promise.all([claimsFor(othersIds), splitsFor(othersIds)])

  const cards = (owners ?? []).map((o) => {
    const theirs = all.filter((i) => i.owner_id === o.id)
    const isMe = o.id === viewerId
    return {
      id: o.id,
      name: o.name,
      isMe,
      itemCount: theirs.length,
      openCount: isMe ? null : theirs.filter((i) => isOpen(statusOf(i, viewerId, claims, splits))).length,
    }
  })

  const myGiftCount =
    claims.filter((c) => c.buyer_id === viewerId).length +
    splits.filter((s) => s.members.some((m) => m.id === viewerId)).length
  return { year, cards, myGiftCount }
}

export async function ownerName(ownerId: string): Promise<string | null> {
  const { data } = await db().from('people').select('name').eq('id', ownerId).eq('is_owner', true).maybeSingle()
  return data?.name ?? null
}
