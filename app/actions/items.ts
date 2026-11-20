'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { CANT, claimable, spokenFor } from '@/lib/claims'
import { db } from '@/lib/db'
import { currentPerson } from '@/lib/session'

export type ClaimResult = { ok: true } | { ok: false; message: string }

/** "I got this." */
export async function claimItem(itemId: string): Promise<ClaimResult> {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')

  const item = await claimable(itemId, me.id)
  if (!item) return { ok: false, message: CANT }

  if (!item.multi_ok && (await spokenFor(itemId))) {
    revalidatePath('/', 'layout')
    return { ok: false, message: 'Someone just got this one. The list has been updated.' }
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
