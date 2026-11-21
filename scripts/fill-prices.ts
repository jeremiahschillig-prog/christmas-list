// Fills in missing prices from each idea's store link, for ideas added before
// the app read prices (Ellie's imported list). Only ideas with a link and no
// price are touched; a price someone typed is never changed.
//
//   npm run db:prices -- Ellie          -- shows what it found, changes nothing
//   npm run db:prices -- Ellie --save   -- saves those prices
//
// Some stores (Amazon, Target, Free People) refuse automated reads; those
// stay blank for the owner to type in.

import { connect } from './db'
import { parsePreview } from '../lib/linkpreview'

const [ownerName, flag] = process.argv.slice(2)
const save = flag === '--save'
if (!ownerName) {
  console.error('Usage: npm run db:prices -- <Name> [--save]')
  process.exit(1)
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

const db = connect()
const { data: owner } = await db.from('people').select('id').eq('name', ownerName).maybeSingle()
if (!owner) {
  console.error(`Nobody called ${ownerName}.`)
  process.exit(1)
}
const { data: items } = await db
  .from('items')
  .select('id, name, link')
  .eq('owner_id', owner.id)
  .is('deleted_at', null)
  .is('price', null)
  .eq('is_cash', false)
  .not('link', 'is', null)

let found = 0
for (const item of items ?? []) {
  let price: number | null = null
  try {
    const res = await fetch(item.link!, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
    if (res.ok) price = parsePreview(await res.text(), res.url || item.link!).price
  } catch {}
  console.log(`${price === null ? '     —  ' : `$${price.toFixed(2).padStart(7)}`}  ${item.name}`)
  if (price === null) continue
  found++
  if (save) await db.from('items').update({ price }).eq('id', item.id)
}
console.log(`\n${found} of ${items?.length ?? 0} prices found${save ? ' and saved' : ' (nothing saved; add --save)'}.`)
