// Loads a reviewed list (a JSON draft like scripts/ellie-list.local.json) onto
// someone's list for the current season.
//
//   npm run db:import -- Ellie scripts/ellie-list.local.json [scripts/ellie-photos.local.json]
//   npm run db:import -- --remove Ellie     -- deletes exactly what the import added
//
// The optional photos file maps each item's position in the list (0, 1, 2…) to
// an image address, e.g. the pictures on Ellie's Google Slides. Each photo is
// copied into our own storage and marked as the owner's choice, so a later link
// change won't replace it. An item whose photo can't be fetched just has none.
//
// Order is kept: the draft's order becomes the list's order (Ellie's slides go
// most-wanted first). The ids added are recorded in scripts/<name>-import.local.json.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { connect } from './db'

type Draft = {
  name: string; link?: string; size?: string; color?: string; notes?: string; price?: number
  is_top_pick?: boolean; is_cash?: boolean; cash_for?: string; multi_ok?: boolean
}

const args = process.argv.slice(2)
const remove = args[0] === '--remove'
const [ownerName, draftFile, photosFile] = remove ? args.slice(1) : args
if (!ownerName || (!remove && !draftFile)) {
  console.error('Usage: npm run db:import -- <Name> <draft.json> [photos.json]   or   -- --remove <Name>')
  process.exit(1)
}

const db = connect()
const record = new URL(`./${ownerName.toLowerCase()}-import.local.json`, import.meta.url)

const { data: owner } = await db.from('people').select('id, name').eq('name', ownerName).eq('is_owner', true).maybeSingle()
if (!owner) {
  console.error(`No list owner called ${ownerName}.`)
  process.exit(1)
}

if (remove) {
  if (!existsSync(record)) {
    console.log('Nothing recorded to remove.')
    process.exit(0)
  }
  const { ids, photos } = JSON.parse(readFileSync(record, 'utf8')) as { ids: string[]; photos: string[] }
  await db.from('items').delete().in('id', ids)
  if (photos.length) await db.storage.from('item-photos').remove(photos)
  rmSync(record)
  console.log(`Removed ${ids.length} items and ${photos.length} photos from ${owner.name}'s list.`)
  process.exit(0)
}

if (existsSync(record)) {
  console.error(`${owner.name}'s list was already imported. Run with --remove first to start over.`)
  process.exit(1)
}

const draft = JSON.parse(readFileSync(draftFile, 'utf8')) as { items: Draft[] }
const photoUrls: Record<string, string> = photosFile ? JSON.parse(readFileSync(photosFile, 'utf8')) : {}
const { data: season } = await db.from('seasons').select('year').order('year', { ascending: false }).limit(1).single()
if (!season) throw new Error('No season')

async function copyPhoto(url: string): Promise<string | null> {
  try {
    // Google Slides picture addresses end in a size like "=s2048". Ask for 1200 px:
    // plenty for a phone, and full-size PNGs can exceed the 5 MB photo limit
    // (two of Ellie's did, Nov 20).
    const sized = url.replace(/=s\d+(?=\?|$)/, '=s1200')
    const res = await fetch(sized, { signal: AbortSignal.timeout(15000) })
    const type = (res.headers.get('content-type') ?? '').split(';')[0]
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[type]
    if (!res.ok || !ext) return null
    const path = `${randomUUID()}.${ext}`
    const { error } = await db.storage.from('item-photos').upload(path, new Uint8Array(await res.arrayBuffer()), { contentType: type })
    return error ? null : path
  } catch {
    return null
  }
}

const ids: string[] = []
const photos: string[] = []
let withPhoto = 0

for (const [index, d] of draft.items.entries()) {
  const path = photoUrls[String(index)] ? await copyPhoto(photoUrls[String(index)]) : null
  if (path) {
    photos.push(path)
    withPhoto++
  }
  const { data, error } = await db
    .from('items')
    .insert({
      owner_id: owner.id,
      year: season.year,
      name: d.name,
      link: d.link ?? null,
      size: d.size ?? null,
      color: d.color ?? null,
      notes: d.notes ?? null,
      price: d.price ?? null,
      is_top_pick: d.is_top_pick ?? false,
      is_cash: d.is_cash ?? false,
      cash_for: d.cash_for ?? null,
      multi_ok: d.multi_ok ?? false,
      photo_url: path ? db.storage.from('item-photos').getPublicUrl(path).data.publicUrl : null,
      photo_source: path ? 'upload' : null,
      sort_order: index,
      created_by: owner.id,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error(`  FAILED: ${d.name} (${error?.message})`)
    process.exitCode = 1
    continue
  }
  ids.push(data.id)
}

writeFileSync(record, JSON.stringify({ ids, photos }, null, 2) + '\n')
console.log(`Added ${ids.length} of ${draft.items.length} items to ${owner.name}'s list, ${withPhoto} with photos.`)
