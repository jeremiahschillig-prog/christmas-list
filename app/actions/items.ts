'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { currentYear } from '@/lib/lists'
import { currentPerson } from '@/lib/session'

export type ClaimResult = { ok: true } | { ok: false; message: string }

// Shown for anything the person can't do, including an owner trying to claim
// their own item. One message for every refusal, so a refusal never hints at
// whether the item was already bought.
const CANT = "That couldn't be done. Please refresh and try again."

async function claimable(itemId: string, buyerId: string) {
  const year = await currentYear()
  const { data: item } = await db()
    .from('items')
    .select('id, owner_id, multi_ok, carried_from_year, year, deleted_at')
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

/** "I got this." */
export async function claimItem(itemId: string): Promise<ClaimResult> {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')

  const item = await claimable(itemId, me.id)
  if (!item) return { ok: false, message: CANT }

  if (!item.multi_ok) {
    const [{ count: claimCount }, { count: splitCount }] = await Promise.all([
      db().from('claims').select('*', { count: 'exact' }).eq('item_id', itemId).limit(0),
      db().from('splits').select('*', { count: 'exact' }).eq('item_id', itemId).limit(0),
    ])
    if ((claimCount ?? 0) > 0 || (splitCount ?? 0) > 0) {
      revalidatePath('/', 'layout')
      return { ok: false, message: 'Someone just got this one. The list has been updated.' }
    }
  }

  const { error } = await db().from('claims').insert({ item_id: itemId, buyer_id: me.id })
  // A duplicate means this person already has it, which is what they wanted.
  if (error && error.code !== '23505') return { ok: false, message: CANT }

  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Undo "I got this". Only ever removes your own claim. */
export async function unclaimItem(itemId: string): Promise<ClaimResult> {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  const { error } = await db().from('claims').delete().eq('item_id', itemId).eq('buyer_id', me.id)
  if (error) return { ok: false, message: CANT }
  revalidatePath('/', 'layout')
  return { ok: true }
}
