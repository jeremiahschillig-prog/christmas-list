import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createHmac, randomBytes } from 'node:crypto'
import { db } from './db'

// "This phone remembers me."
//
// The cookie holds a random token. The database stores only an HMAC of it, keyed
// with SESSION_SECRET, so neither a copy of the sessions table nor the secret alone
// is enough to sign in as someone. The cookie is httpOnly (page scripts can't read
// it) and lasts 400 days, the longest a browser will keep one. Resetting someone's
// PIN revokes their sessions, which signs out every phone they used.

const COOKIE = 'family_list_session'
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60

export type Person = {
  id: string
  name: string
  is_owner: boolean
  is_admin: boolean
  pin_is_starter: boolean
}

function hashToken(token: string): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set (32+ characters)')
  return createHmac('sha256', secret).update(token).digest('base64url')
}

/** Signs this phone in as `personId`. Call only from a Server Function. */
export async function startSession(personId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const { error } = await db().from('sessions').insert({ person_id: personId, token_hash: hashToken(token) })
  if (error) throw new Error(`Could not start session: ${error.message}`)
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

/** Signs this phone out. Call only from a Server Function. */
export async function endSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) {
    await db().from('sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', hashToken(token))
  }
  jar.delete(COOKIE)
}

/**
 * Who is signed in on this phone, or null. Cached per request, so every server
 * component and function in one request shares one lookup.
 */
export const currentPerson = cache(async (): Promise<Person | null> => {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null

  const { data } = await db()
    .from('sessions')
    .select('id, last_seen_at, people!inner(id, name, is_owner, is_admin, pin_is_starter)')
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .maybeSingle()
  if (!data) return null

  // Note the visit at most once an hour; it's for the Admin tab, not for security.
  if (Date.now() - new Date(data.last_seen_at).getTime() > 60 * 60_000) {
    await db().from('sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id)
  }
  return data.people as unknown as Person
})
