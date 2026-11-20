'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { canRemovePerson, cleanName } from '@/lib/adminrules'
import { db } from '@/lib/db'
import { hashPin, starterPin } from '@/lib/pin'
import { currentPerson } from '@/lib/session'

// People and PINs. Admins only: every action checks before doing anything.

export type PinResult = { ok: true; name: string; pin: string } | { ok: false; error: string }

async function admin() {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  if (!me.is_admin) redirect('/')
  return me
}

/** Adds a relative who can buy, with a starter PIN to pass on. */
export async function addPerson(rawName: string): Promise<PinResult> {
  await admin()
  const name = cleanName(rawName)
  if (!name) return { ok: false, error: 'Enter a name, up to 40 letters.' }

  const pin = starterPin()
  const { error } = await db()
    .from('people')
    .insert({ name, is_owner: false, is_admin: false, pin_hash: await hashPin(pin), pin_is_starter: true, sort_order: 20 })
  if (error) {
    return { ok: false, error: error.code === '23505' ? `There's already someone called ${name}. Add a last initial.` : 'That couldn’t be saved. Please try again.' }
  }
  revalidatePath('/', 'layout')
  return { ok: true, name, pin }
}

/**
 * A new starter PIN for someone who forgot theirs. Signs them out everywhere
 * and clears their wrong-guess count, so they can sign straight back in.
 */
export async function resetPin(personId: string): Promise<PinResult> {
  await admin()
  const { data: person } = await db().from('people').select('id, name').eq('id', personId).maybeSingle()
  if (!person) return { ok: false, error: 'That person couldn’t be found.' }

  const pin = starterPin()
  const { error } = await db()
    .from('people')
    .update({ pin_hash: await hashPin(pin), pin_is_starter: true })
    .eq('id', personId)
  if (error) return { ok: false, error: 'That couldn’t be saved. Please try again.' }

  await Promise.all([
    db().from('sessions').update({ revoked_at: new Date().toISOString() }).eq('person_id', personId).is('revoked_at', null),
    db().from('pin_attempts').delete().eq('person_id', personId),
  ])
  revalidatePath('/', 'layout')
  return { ok: true, name: person.name, pin }
}

/** Removes a relative, and with them any gifts they'd marked. List owners can't be removed. */
export async function removePerson(personId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await admin()
  if (personId === me.id) return { ok: false, error: "You can't remove yourself." }
  const { data: person } = await db().from('people').select('id, is_owner').eq('id', personId).maybeSingle()
  if (!person || !canRemovePerson(person)) return { ok: false, error: 'List owners can’t be removed.' }

  // Group gifts they ordered pass to the next member, as if they'd left.
  const { data: ordering } = await db().from('splits').select('id').eq('purchaser_id', personId)
  for (const split of ordering ?? []) {
    const { data: next } = await db()
      .from('split_members').select('person_id').eq('split_id', split.id).neq('person_id', personId)
      .order('joined_at').limit(1).maybeSingle()
    if (next) await db().from('splits').update({ purchaser_id: next.person_id }).eq('id', split.id)
    else await db().from('splits').delete().eq('id', split.id)
  }

  const { error } = await db().from('people').delete().eq('id', personId)
  if (error) return { ok: false, error: 'That couldn’t be done. Please try again.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function markAdminNotesRead(noteIds: string[]): Promise<void> {
  const me = await admin()
  if (!noteIds.length) return
  await db().from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', me.id).in('id', noteIds).is('read_at', null)
  revalidatePath('/', 'layout')
}
