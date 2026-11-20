// Sample items so the screens have something to show while they're being built.
//
//   npm run db:sample              -- adds a few items to each owner's list
//   npm run db:sample -- --remove  -- deletes exactly the items it added
//
// The ids it adds are kept in scripts/sample-items.local.json (git-ignored), so
// --remove never touches a real item. Remove them before Ellie's real list goes
// in (step 9).

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { connect } from './db'

const FILE = new URL('./sample-items.local.json', import.meta.url)
const db = connect()

if (process.argv.includes('--remove')) {
  if (!existsSync(FILE)) {
    console.log('No sample items recorded. Nothing to remove.')
    process.exit(0)
  }
  const ids: string[] = JSON.parse(readFileSync(FILE, 'utf8'))
  const { error } = await db.from('items').delete().in('id', ids)
  if (error) {
    console.error(`Could not remove: ${error.message}`)
    process.exit(1)
  }
  rmSync(FILE)
  console.log(`Removed ${ids.length} sample items.`)
  process.exit(0)
}

if (existsSync(FILE)) {
  console.log('Sample items are already in. Run with --remove first to start over.')
  process.exit(0)
}

type Sample = {
  name: string; link?: string; size?: string; color?: string; notes?: string; price?: number
  is_top_pick?: boolean; is_cash?: boolean; cash_for?: string; multi_ok?: boolean
}

const SAMPLES: Record<string, Sample[]> = {
  Ellie: [
    { name: 'Lululemon shorts', link: 'https://shop.lululemon.com/', size: '6', color: 'Black', price: 68, is_top_pick: true, multi_ok: true, notes: 'The 6-inch length. Any color is fine if black is sold out.' },
    { name: 'Concert ticket money', is_cash: true, cash_for: 'For the March concert', is_top_pick: true },
    { name: 'Lululemon shirt', link: 'https://shop.lululemon.com/', size: '8', color: 'White', price: 58 },
    { name: 'Insulated tumbler, 40 oz', color: 'Light pink', notes: 'Any brand is fine' },
    { name: 'Hoodie', size: 'M', color: 'Gray', price: 45 },
  ],
  Austin: [
    { name: 'Noise-canceling headphones', link: 'https://www.amazon.com/', color: 'Silver', price: 249, is_top_pick: true },
    { name: 'Basketball shoes', size: '10.5', price: 120 },
    { name: 'Gas money', is_cash: true, cash_for: 'For driving to practice' },
  ],
  Jessica: [
    { name: 'Cookbook', notes: 'Anything Mediterranean', price: 30 },
    { name: 'Cozy slippers', size: '8', color: 'Cream', price: 40, is_top_pick: true },
  ],
  Jeremy: [
    { name: '3D printer filament', color: 'Black PLA', multi_ok: true, price: 22, notes: '1.75 mm' },
    { name: 'Hiking socks', size: 'L', price: 25 },
  ],
}

const { data: season } = await db.from('seasons').select('year').order('year', { ascending: false }).limit(1).single()
const { data: owners } = await db.from('people').select('id, name').eq('is_owner', true)
if (!season || !owners) {
  console.error('No season or owners yet. Run supabase/01-schema.sql and npm run db:seed first.')
  process.exit(1)
}

const rows = owners.flatMap((o) =>
  // Every row gets every column. In a bulk insert, a column one row has and
  // another lacks is sent as null, not left to its default.
  (SAMPLES[o.name] ?? []).map((s, i) => ({
    link: null, size: null, color: null, notes: null, price: null, cash_for: null,
    is_top_pick: false, is_cash: false, multi_ok: false,
    ...s, owner_id: o.id, year: season.year, sort_order: i, created_by: o.id,
  })),
)
const { data, error } = await db.from('items').insert(rows).select('id')
if (error || !data) {
  console.error(`Could not add sample items: ${error?.message}`)
  process.exit(1)
}
writeFileSync(FILE, JSON.stringify(data.map((r) => r.id), null, 2) + '\n')
console.log(`Added ${data.length} sample items across ${owners.length} lists.`)
