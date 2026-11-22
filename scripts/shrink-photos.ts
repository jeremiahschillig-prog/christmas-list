// One-time fix: shrinks photos saved before the app stored them small.
// Each big photo is re-saved as an 800 px JPEG under a new name, every idea
// that used it (this year and past years) is pointed at the new file, and only
// then is the old file deleted.
//
//   npm run db:shrink-photos            -- shows what it would do, changes nothing
//   npm run db:shrink-photos -- --save  -- does it

import { connect } from './db'
import { shrinkForStorage } from '../lib/photosize'

const save = process.argv.includes('--save')
const BUCKET = 'item-photos'
const MARKER = `/storage/v1/object/public/${BUCKET}/`
const SMALL_ENOUGH = 150 * 1024

const db = connect()
const { data: items, error } = await db.from('items').select('photo_url').not('photo_url', 'is', null)
if (error) throw error
const urls = [...new Set((items ?? []).map((i) => i.photo_url as string))].filter((u) => u.includes(MARKER))

let before = 0
let after = 0
let changed = 0
for (const url of urls) {
  const res = await fetch(url)
  if (!res.ok) {
    console.log('  skip (could not download)', url.slice(-40))
    continue
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  before += bytes.length
  if (bytes.length <= SMALL_ENOUGH && url.endsWith('.jpg')) {
    after += bytes.length
    continue
  }
  const small = await shrinkForStorage(bytes)
  after += small.length
  changed++
  console.log(`  ${String(Math.round(bytes.length / 1024)).padStart(5)} KB -> ${String(Math.round(small.length / 1024)).padStart(4)} KB`)
  if (!save) continue

  const path = `${crypto.randomUUID()}.jpg`
  const up = await db.storage.from(BUCKET).upload(path, small, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
  if (up.error) throw up.error
  const newUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  const upd = await db.from('items').update({ photo_url: newUrl }).eq('photo_url', url)
  if (upd.error) throw upd.error
  await db.storage.from(BUCKET).remove([url.slice(url.indexOf(MARKER) + MARKER.length)])
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(1)
console.log(`\n${urls.length} photos, ${changed} to shrink: ${mb(before)} MB -> ${mb(after)} MB`)
console.log(save ? 'Saved.' : 'Nothing changed. Add --save to do it.')
