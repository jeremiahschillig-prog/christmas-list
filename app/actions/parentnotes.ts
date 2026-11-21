'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { canEditList } from '@/lib/permissions'
import { currentPerson } from '@/lib/session'

// Parents' notes: a red note Jeremy or Jessica puts on an idea on a kid's list
// ("We already bought this on sale…"). Everyone but the kid sees it. Only an
// admin who can edit that list may set one, so never on their own list, where
// they couldn't see it anyway.

export type NoteResult = { ok: true } | { ok: false; error: string }

const MAX = 300

async function allowed(itemId: string) {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  if (!me.is_admin) return null
  const { data: item } = await db()
    .from('items')
    .select('id, owner:people!items_owner_id_fkey(id, is_owner, is_admin)')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()
  const owner = item?.owner as unknown as { id: string; is_owner: boolean; is_admin: boolean } | null
  if (!item || !owner || owner.id === me.id || !canEditList(me, owner)) return null
  return me
}

export async function setParentNote(itemId: string, raw: string): Promise<NoteResult> {
  const me = await allowed(itemId)
  if (!me) return { ok: false, error: "You can't add a note to that idea." }
  const note = raw.trim().replace(/\s+/g, ' ')
  if (!note) return clearParentNote(itemId)
  if (note.length > MAX) return { ok: false, error: `Keep it under ${MAX} letters.` }

  const { error } = await db()
    .from('parent_notes')
    .upsert({ item_id: itemId, note, set_by: me.id, updated_at: new Date().toISOString() })
  if (error) return { ok: false, error: 'That couldn’t be saved. Please try again.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function clearParentNote(itemId: string): Promise<NoteResult> {
  if (!(await allowed(itemId))) return { ok: false, error: "You can't change that note." }
  const { error } = await db().from('parent_notes').delete().eq('item_id', itemId)
  if (error) return { ok: false, error: 'That couldn’t be removed. Please try again.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}
