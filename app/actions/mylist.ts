'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { meaningfulChanges, normalizeLink, validateItem, type ItemInput } from '@/lib/itemform'
import { currentYear } from '@/lib/lists'
import { adminIds, assertCanEdit, buyersOf } from '@/lib/mylist'
import { changeRecipients } from '@/lib/permissions'
import { deleteStoredPhoto, fromLink, previewOf, storeUploadedPhoto } from '@/lib/photos'
import { currentPerson } from '@/lib/session'

export type SaveResult = { ok: true; id: string; photoFound: boolean | null } | { ok: false; error: string }

// The editor never learns anything about purchases from these actions. Every
// one of them answers the same way whether or not the item was bought; any
// alert about a change goes to other people, quietly.

async function me() {
  const person = await currentPerson()
  if (!person) redirect('/sign-in')
  return person
}

async function editableItem(itemId: string) {
  const person = await me()
  const { data: item } = await db()
    .from('items')
    .select('id, owner_id, name, link, size, color, notes, price, cash_for, photo_url, photo_source, deleted_at')
    .eq('id', itemId)
    .maybeSingle()
  if (!item || item.deleted_at) throw new Error('not found')
  await assertCanEdit(person, item.owner_id)
  return { person, item }
}

async function notify(kind: 'item_changed' | 'item_removed', item: { id: string; owner_id: string }, editorId: string, details: object) {
  const buyers = await buyersOf(item.id)
  if (!buyers.length) return
  const recipients = changeRecipients({ ownerId: item.owner_id, editorId, buyerIds: buyers, adminIds: await adminIds() })
  if (!recipients.length) return
  await db().from('notifications').insert(
    recipients.map((recipient_id) => ({ recipient_id, kind, item_id: item.id, actor_id: editorId, details })),
  )
}

function done() {
  revalidatePath('/', 'layout')
}

/** Suggests a name and price for a pasted link (the photo is fetched when the item is saved). */
export async function suggestFromLink(raw: string): Promise<{ title: string | null; price: number | null }> {
  await me()
  const link = normalizeLink(raw)
  if (!link) return { title: null, price: null }
  const { title, price } = await previewOf(link)
  return { title, price }
}

export async function addItem(ownerId: string, input: ItemInput): Promise<SaveResult> {
  const person = await me()
  try {
    await assertCanEdit(person, ownerId)
  } catch {
    return { ok: false, error: "You can't add to that list." }
  }
  const v = validateItem(input)
  if (!v.ok) return v

  const year = await currentYear()
  const { data: last } = await db()
    .from('items').select('sort_order').eq('owner_id', ownerId).eq('year', year)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()

  const found = v.fields.link ? await fromLink(v.fields.link) : null
  const photo = found?.photo ?? null
  const { data, error } = await db()
    .from('items')
    .insert({
      ...v.fields,
      // No price typed in: use the store's, if its page says.
      price: v.fields.price ?? (v.fields.is_cash ? null : found?.price ?? null),
      owner_id: ownerId,
      year,
      sort_order: (last?.sort_order ?? -1) + 1,
      photo_url: photo,
      photo_source: photo ? 'link' : null,
      created_by: person.id,
      updated_by: person.id,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Something went wrong saving that. Please try again.' }

  done()
  return { ok: true, id: data.id, photoFound: v.fields.link ? Boolean(photo) : null }
}

export async function updateItem(itemId: string, input: ItemInput): Promise<SaveResult> {
  let ctx
  try {
    ctx = await editableItem(itemId)
  } catch {
    return { ok: false, error: "That idea couldn't be found. Please refresh." }
  }
  const { person, item } = ctx
  const v = validateItem(input)
  if (!v.ok) return v

  // A photo pulled from the old link is replaced when the link changes. One
  // the owner chose themselves is kept.
  // A new link with no price typed in takes the store's price too.
  let photo: { photo_url: string | null; photo_source: 'link' | 'upload' | null } | null = null
  let photoFound: boolean | null = null
  const linkChanged = (item.link ?? null) !== v.fields.link
  const wantPrice = linkChanged && v.fields.price === null && !v.fields.is_cash
  const wantPhoto = linkChanged && item.photo_source !== 'upload'
  const found = v.fields.link && (wantPhoto || wantPrice) ? await fromLink(v.fields.link) : null
  if (wantPhoto) {
    photo = { photo_url: found?.photo ?? null, photo_source: found?.photo ? 'link' : null }
    photoFound = v.fields.link ? Boolean(found?.photo) : null
  }
  const fields = wantPrice && found?.price ? { ...v.fields, price: found.price } : v.fields

  const { error } = await db()
    .from('items')
    .update({ ...fields, ...(photo ?? {}), updated_by: person.id, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  if (error) return { ok: false, error: 'Something went wrong saving that. Please try again.' }
  if (photo) await deleteStoredPhoto(item.photo_url)

  const changes = meaningfulChanges(item, fields)
  if (changes.length) await notify('item_changed', item, person.id, { changes })

  done()
  return { ok: true, id: itemId, photoFound }
}

/**
 * Removes an idea from the list. The row is kept (deleted_at), so if someone
 * already bought it they still see "Removed by Ellie: you already bought this".
 */
export async function deleteItem(itemId: string): Promise<{ ok: boolean }> {
  let ctx
  try {
    ctx = await editableItem(itemId)
  } catch {
    return { ok: false }
  }
  const { person, item } = ctx
  await db().from('items').update({ deleted_at: new Date().toISOString(), deleted_by: person.id }).eq('id', itemId)
  await notify('item_removed', item, person.id, { name: item.name })
  done()
  return { ok: true }
}

/** The owner's own photo, replacing whatever was there. */
export async function replacePhoto(itemId: string, form: FormData): Promise<{ ok: boolean; error?: string }> {
  let ctx
  try {
    ctx = await editableItem(itemId)
  } catch {
    return { ok: false, error: "That idea couldn't be found." }
  }
  const file = form.get('photo')
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a photo first.' }
  try {
    const url = await storeUploadedPhoto(file)
    await db().from('items').update({ photo_url: url, photo_source: 'upload' }).eq('id', itemId)
    await deleteStoredPhoto(ctx.item.photo_url)
  } catch {
    return { ok: false, error: "That photo couldn't be saved. Try a different one." }
  }
  done()
  return { ok: true }
}

export async function removePhoto(itemId: string): Promise<{ ok: boolean }> {
  let ctx
  try {
    ctx = await editableItem(itemId)
  } catch {
    return { ok: false }
  }
  // 'upload' with no photo = the owner chose "no photo"; a later link change won't add one back.
  await db().from('items').update({ photo_url: null, photo_source: 'upload' }).eq('id', itemId)
  await deleteStoredPhoto(ctx.item.photo_url)
  done()
  return { ok: true }
}
