'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { ATTEMPTS_TO_LOAD, lockState } from '@/lib/lockout'
import { hashPin, isValidPin, verifyPin } from '@/lib/pin'
import { currentPerson, endSession, startSession } from '@/lib/session'

export type SignInResult =
  | { ok: true; next: '/' | '/welcome' }
  | { ok: false; reason: 'wrong'; triesLeft: number }
  | { ok: false; reason: 'locked'; until: string }
  | { ok: false; reason: 'error' }

async function recentAttempts(personId: string) {
  const { data } = await db()
    .from('pin_attempts')
    .select('succeeded, attempted_at')
    .eq('person_id', personId)
    .order('attempted_at', { ascending: false })
    .limit(ATTEMPTS_TO_LOAD)
  return data ?? []
}

export async function signIn(personId: string, pin: string): Promise<SignInResult> {
  if (!isValidPin(pin)) return { ok: false, reason: 'error' }

  const { data: person } = await db()
    .from('people')
    .select('id, pin_hash, pin_is_starter')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return { ok: false, reason: 'error' }

  // Checked BEFORE looking at the PIN, so a locked name can't be guessed at all.
  const before = lockState(await recentAttempts(personId), new Date())
  if (before.locked) return { ok: false, reason: 'locked', until: before.until.toISOString() }

  const right = await verifyPin(pin, person.pin_hash)
  await db().from('pin_attempts').insert({ person_id: personId, succeeded: right })

  if (!right) {
    const after = lockState(await recentAttempts(personId), new Date())
    return after.locked
      ? { ok: false, reason: 'locked', until: after.until.toISOString() }
      : { ok: false, reason: 'wrong', triesLeft: after.triesLeft }
  }

  await startSession(personId)
  return { ok: true, next: person.pin_is_starter ? '/welcome' : '/' }
}

/** First sign-in: keep the starter PIN an admin gave out. */
export async function keepStarterPin(): Promise<void> {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  await db().from('people').update({ pin_is_starter: false }).eq('id', me.id)
}

/** First sign-in (and later, from settings): choose your own PIN. */
export async function choosePin(pin: string): Promise<{ ok: boolean }> {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  if (!isValidPin(pin)) return { ok: false }
  const { error } = await db()
    .from('people')
    .update({ pin_hash: await hashPin(pin), pin_is_starter: false })
    .eq('id', me.id)
  return { ok: !error }
}

export async function signOut(): Promise<void> {
  await endSession()
  redirect('/sign-in')
}
