'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { currentYear } from '@/lib/lists'
import { assertCanEdit } from '@/lib/mylist'
import { currentPerson } from '@/lib/session'

export type SeasonResult = { ok: true; message: string } | { ok: false; error: string }

async function admin() {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  if (!me.is_admin) redirect('/')
  return me
}

/** Starts next Christmas: the database moves everything in one step (supabase/02-seasons.sql). */
export async function startSeason(): Promise<SeasonResult> {
  await admin()
  const next = (await currentYear()) + 1
  const { data, error } = await db().rpc('start_season', { new_year: next })
  if (error) return { ok: false, error: error.message.includes('function') ? 'The season setup hasn’t been installed yet (supabase/02-seasons.sql).' : error.message }
  const r = data as { year: number; moved: number; copied: number; kept: number }
  revalidatePath('/', 'layout')
  return {
    ok: true,
    message: `Christmas ${r.year} has started. ${r.moved + r.copied} ${r.moved + r.copied === 1 ? 'idea' : 'ideas'} came forward; ${r.kept} stayed in ${r.year - 1}'s history.`,
  }
}

/** Undoes the newest season start, if nothing has happened in it yet. */
export async function undoSeason(): Promise<SeasonResult> {
  await admin()
  const year = await currentYear()
  const { error } = await db().rpc('undo_season', { season_year: year })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/', 'layout')
  return { ok: true, message: `Christmas ${year} was undone. Everything is back in ${year - 1}.` }
}

/** "My list is up to date": opens a carried-over list to buyers. Owners, or parents for a kid's list. */
export async function markReviewed(ownerId: string): Promise<{ ok: boolean }> {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  try {
    await assertCanEdit(me, ownerId)
  } catch {
    return { ok: false }
  }
  const { error } = await db()
    .from('list_reviews')
    .upsert({ owner_id: ownerId, year: await currentYear() }, { onConflict: 'owner_id,year' })
  revalidatePath('/', 'layout')
  return { ok: !error }
}
