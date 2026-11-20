import 'server-only'
import { db } from './db'
import { currentYear } from './lists'

// Shared by "I got this" and going in together.

// Shown for anything the person can't do, including an owner trying to buy from
// their own list. One message for every refusal, so a refusal never hints at
// whether the item was already bought.
export const CANT = "That couldn't be done. Please refresh and try again."

/**
 * The item, if this person may buy it: this season's, not removed, not on their
 * own list, and (if it came forward from last year) the list has been reviewed.
 */
export async function claimable(itemId: string, buyerId: string) {
  const year = await currentYear()
  const { data: item } = await db()
    .from('items')
    .select('id, owner_id, name, price, multi_ok, carried_from_year, year, deleted_at')
    .eq('id', itemId)
    .maybeSingle()
  // Your own list is off limits before anything else is looked at.
  if (!item || item.owner_id === buyerId || item.deleted_at || item.year !== year) return null

  if (item.carried_from_year !== null) {
    const { data: review } = await db()
      .from('list_reviews').select('owner_id').eq('owner_id', item.owner_id).eq('year', year).maybeSingle()
    if (!review) return null
  }
  return item
}

/** Has anyone bought this, or started going in on it? */
export async function spokenFor(itemId: string): Promise<boolean> {
  const [{ count: claims }, { count: splits }] = await Promise.all([
    db().from('claims').select('*', { count: 'exact' }).eq('item_id', itemId).limit(0),
    db().from('splits').select('*', { count: 'exact' }).eq('item_id', itemId).limit(0),
  ])
  return (claims ?? 0) > 0 || (splits ?? 0) > 0
}
