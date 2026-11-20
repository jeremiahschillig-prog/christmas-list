'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { CANT, claimable, spokenFor } from '@/lib/claims'
import { db } from '@/lib/db'
import { formatPrice } from '@/lib/format'
import { currentPerson } from '@/lib/session'
import { parseAmount, purchaserAfterLeaving } from '@/lib/splits'

// Going in together. The list's owner can't take part (claimable refuses
// their own items) and is never sent a note: every note here goes to the
// other members of the group, and only to them.

export type SplitResult = { ok: true } | { ok: false; message: string }

const BAD_AMOUNT = 'Enter how much you would put in, like 50.'

async function me() {
  const person = await currentPerson()
  if (!person) redirect('/sign-in')
  return person
}

async function splitOf(itemId: string) {
  const { data } = await db()
    .from('splits')
    .select('id, item_id, purchaser_id, ordered_at, split_members(person_id, joined_at)')
    .eq('item_id', itemId)
    .maybeSingle()
  if (!data) return null
  const members = (data.split_members as { person_id: string; joined_at: string }[]).map((m) => ({
    id: m.person_id,
    joined_at: m.joined_at,
  }))
  return { ...data, members }
}

async function noteOthers(
  kind: 'split_joined' | 'split_left' | 'split_purchaser',
  itemId: string,
  actorId: string,
  memberIds: string[],
  details: object = {},
) {
  const to = memberIds.filter((id) => id !== actorId)
  if (!to.length) return
  await db().from('notifications').insert(
    to.map((recipient_id) => ({ recipient_id, kind, item_id: itemId, actor_id: actorId, details })),
  )
}

function done(): SplitResult {
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** "Willing to split": starts a group gift with you as its first member and purchaser. */
export async function startSplit(itemId: string, rawAmount: string): Promise<SplitResult> {
  const person = await me()
  const amount = parseAmount(rawAmount)
  if (!amount) return { ok: false, message: BAD_AMOUNT }

  const item = await claimable(itemId, person.id)
  if (!item || item.multi_ok) return { ok: false, message: CANT }
  if (await spokenFor(itemId)) {
    revalidatePath('/', 'layout')
    return { ok: false, message: 'Someone just got to this one first. The list has been updated.' }
  }

  const { data: split, error } = await db()
    .from('splits')
    .insert({ item_id: itemId, started_by: person.id, purchaser_id: person.id })
    .select('id')
    .single()
  // The one-split-per-item rule caught two people starting at once.
  if (error || !split) return { ok: false, message: 'Someone just got to this one first. Please refresh.' }

  await db().from('split_members').insert({ split_id: split.id, person_id: person.id, amount })
  return done()
}

/** Join a group gift, or change how much you're putting in. */
export async function joinSplit(itemId: string, rawAmount: string): Promise<SplitResult> {
  const person = await me()
  const amount = parseAmount(rawAmount)
  if (!amount) return { ok: false, message: BAD_AMOUNT }
  if (!(await claimable(itemId, person.id))) return { ok: false, message: CANT }

  const split = await splitOf(itemId)
  if (!split || split.ordered_at) return { ok: false, message: CANT }

  const already = split.members.some((m) => m.id === person.id)
  const { error } = await db()
    .from('split_members')
    .upsert({ split_id: split.id, person_id: person.id, amount }, { onConflict: 'split_id,person_id' })
  if (error) return { ok: false, message: CANT }

  if (!already) {
    await noteOthers('split_joined', itemId, person.id, split.members.map((m) => m.id), { amount: formatPrice(amount) })
  }
  return done()
}

/** Take your name off. The last person out ends the group gift and the item reopens. */
export async function leaveSplit(itemId: string): Promise<SplitResult> {
  const person = await me()
  const split = await splitOf(itemId)
  if (!split || split.ordered_at || !split.members.some((m) => m.id === person.id)) return { ok: false, message: CANT }

  const next = purchaserAfterLeaving(split.members, person.id, split.purchaser_id)
  if (next === null) {
    await db().from('splits').delete().eq('id', split.id)
    return done()
  }

  await db().from('split_members').delete().eq('split_id', split.id).eq('person_id', person.id)
  if (next !== split.purchaser_id) await db().from('splits').update({ purchaser_id: next }).eq('id', split.id)

  const others = split.members.map((m) => m.id).filter((id) => id !== person.id)
  await noteOthers('split_left', itemId, person.id, others, next !== split.purchaser_id ? { newPurchaser: next } : {})
  return done()
}

/** "I'll order it": any member can take over buying it. */
export async function takeOrdering(itemId: string): Promise<SplitResult> {
  const person = await me()
  const split = await splitOf(itemId)
  if (!split || split.ordered_at || !split.members.some((m) => m.id === person.id)) return { ok: false, message: CANT }
  if (split.purchaser_id === person.id) return done()

  await db().from('splits').update({ purchaser_id: person.id }).eq('id', split.id)
  await noteOthers('split_purchaser', itemId, person.id, split.members.map((m) => m.id))
  return done()
}

/** The purchaser marks it ordered (or un-marks it). Ordered = "Taken" to everyone else. */
export async function setOrdered(itemId: string, ordered: boolean): Promise<SplitResult> {
  const person = await me()
  const split = await splitOf(itemId)
  if (!split || split.purchaser_id !== person.id) return { ok: false, message: CANT }
  await db().from('splits').update({ ordered_at: ordered ? new Date().toISOString() : null }).eq('id', split.id)
  return done()
}
