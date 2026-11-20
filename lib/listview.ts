import { summarize, type SplitInfo, type SplitMember } from './splits'

// What one person is allowed to see of one list.
//
// THE SURPRISE RULE LIVES HERE. When the viewer is the list's owner, the claims
// and splits are never even fetched: `loadList` returns before asking for them,
// and the items it returns carry no status field at all. There is nothing for
// the page, the network response, or a curious kid's dev tools to leak.
//
// The database calls come in as `deps`, so the tests can prove that rule by
// counting calls, and lib/lists.ts plugs in the real database.

export type ItemRow = {
  id: string
  owner_id: string
  name: string
  link: string | null
  size: string | null
  color: string | null
  notes: string | null
  price: number | string | null
  is_top_pick: boolean
  is_cash: boolean
  cash_for: string | null
  multi_ok: boolean
  photo_url: string | null
  sort_order: number
  carried_from_year: number | null
  created_at: string
}

export type ClaimRow = { item_id: string; buyer_id: string }
export type SplitRow = { item_id: string; ordered_at: string | null; purchaser_id: string; members: SplitMember[] }

/**
 * open      — anyone can tap "I got this". `boughtCount` > 0 only on "more than one
 *             is fine" items; `mine` = the viewer already bought one of those.
 * mine      — the viewer bought it ("You got this", with Undo), or is in a group
 *             gift that has been ordered (`split` set; no Undo).
 * taken     — someone else bought it, or a group gift the viewer isn't in was ordered.
 * together  — a group gift is being put together. Anyone but the owner can see
 *             who's in and for how much, so they can join.
 */
export type Status =
  | { kind: 'open'; boughtCount: number; mine: boolean }
  | { kind: 'mine'; split?: SplitInfo }
  | { kind: 'taken' }
  | { kind: 'together'; member: boolean; split: SplitInfo }

export type BuyerItem = ItemRow & { status: Status }

export type ListView =
  | { kind: 'own'; items: ItemRow[] }
  | { kind: 'buyer'; items: BuyerItem[]; needsReview: boolean }

export type ListDeps = {
  items: (ownerId: string) => Promise<ItemRow[]>
  claims: (itemIds: string[]) => Promise<ClaimRow[]>
  splits: (itemIds: string[]) => Promise<SplitRow[]>
  /** Has this owner marked their list reviewed for the current season? */
  reviewed: (ownerId: string) => Promise<boolean>
}

/** Top picks first, then the order the owner gave them. */
export function byPriority(a: ItemRow, b: ItemRow): number {
  if (a.is_top_pick !== b.is_top_pick) return a.is_top_pick ? -1 : 1
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return a.created_at.localeCompare(b.created_at)
}

export function statusOf(item: ItemRow, viewerId: string, claims: ClaimRow[], splits: SplitRow[]): Status {
  const mine = claims.filter((c) => c.item_id === item.id)
  const split = splits.find((s) => s.item_id === item.id)

  if (item.multi_ok) {
    return { kind: 'open', boughtCount: mine.length, mine: mine.some((c) => c.buyer_id === viewerId) }
  }
  if (mine.some((c) => c.buyer_id === viewerId)) return { kind: 'mine' }
  if (mine.length > 0) return { kind: 'taken' }
  if (split) {
    const member = split.members.some((m) => m.id === viewerId)
    const info = summarize(item.price, split.members, split.purchaser_id, Boolean(split.ordered_at))
    if (split.ordered_at) return member ? { kind: 'mine', split: info } : { kind: 'taken' }
    return { kind: 'together', member, split: info }
  }
  return { kind: 'open', boughtCount: 0, mine: false }
}

/** Still open from this buyer's point of view: something they could still get. */
export function isOpen(status: Status): boolean {
  return status.kind === 'open' && !status.mine
}

export async function loadList(viewerId: string, ownerId: string, deps: ListDeps): Promise<ListView> {
  const items = (await deps.items(ownerId)).sort(byPriority)

  // The owner's own list: return now, before any purchase data is fetched.
  if (viewerId === ownerId) return { kind: 'own', items }

  const ids = items.map((i) => i.id)
  const [claims, splits] = ids.length
    ? await Promise.all([deps.claims(ids), deps.splits(ids)])
    : [[], []]

  const withStatus = items.map((item) => ({ ...item, status: statusOf(item, viewerId, claims, splits) }))
  // Open ones first (top picks leading), then everything already spoken for.
  const open = withStatus.filter((i) => i.status.kind === 'open')
  const rest = withStatus.filter((i) => i.status.kind !== 'open')

  // A list that came forward from last year stays closed until its owner says
  // it's up to date. A brand-new list needs no review.
  const carried = items.some((i) => i.carried_from_year !== null)
  const needsReview = carried && !(await deps.reviewed(ownerId))

  return { kind: 'buyer', items: [...open, ...rest], needsReview }
}
