import 'server-only'
import { db } from './db'
import { needsReview } from './seasons'
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
    parentNotes: async (itemIds) => {
      const { data } = await db().from('parent_notes').select('item_id, note').in('item_id', itemIds)
      return data ?? []
    },
    reviewed: async (ownerId) => {
      const { data } = await db().from('list_reviews').select('owner_id').eq('owner_id', ownerId).eq('year', year).maybeSingle()
      return Boolean(data)
    },
  }
}

export async function listFor(viewerId: string, ownerId: string): Promise<ListView> {
  return loadList(viewerId, ownerId, deps(await currentYear()))
}

export type OwnerCard = { id: string; name: string; isMe: boolean; openCount: number | null; itemCount: number; needsReview: boolean }

/**
 * The Home screen: a card per list owner. Your own card gets an item count only,
 * never an open count, and purchases on your own items are never fetched.
 */
export async function homeFor(viewerId: string): Promise<{ year: number; cards: OwnerCard[]; myGiftCount: number }> {
  const year = await currentYear()
  const [{ data: owners }, { data: items }, { data: reviews }] = await Promise.all([
    db().from('people').select('id, name').eq('is_owner', true).order('sort_order'),
    db().from('items').select(ITEM_COLUMNS).eq('year', year).is('deleted_at', null),
    db().from('list_reviews').select('owner_id').eq('year', year),
  ])
  const all = (items ?? []) as ItemRow[]
  const reviewed = new Set((reviews ?? []).map((r) => r.owner_id))

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
      // Shown on other people's cards only; your own review prompt is in My List.
      needsReview: !isMe && needsReview(theirs, reviewed.has(o.id)),
    }
  })

  const myGiftCount =
    claims.filter((c) => c.buyer_id === viewerId).length +
    splits.filter((s) => s.members.some((m) => m.id === viewerId)).length
  return { year, cards, myGiftCount }
}

/**
 * Who a parents' note points buyers to: the admins other than the list's
 * owner, e.g. "Jeremy & Jessica".
 */
export async function parentNames(ownerId: string): Promise<string> {
  const { data } = await db().from('people').select('id, name').eq('is_admin', true).order('sort_order')
  const names = (data ?? []).filter((p) => p.id !== ownerId).map((p) => p.name)
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0] ?? 'the parents'
}

