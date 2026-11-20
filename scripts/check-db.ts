// Is the database reachable, and is the schema in place?
//
//   npm run db:check
//
// Prints each table's row count and the current season. Never prints a secret.

import { connect } from './db'

const TABLES = ['people', 'sessions', 'pin_attempts', 'seasons', 'list_reviews',
  'items', 'claims', 'splits', 'split_members', 'notifications']

const db = connect()
let ok = true

for (const table of TABLES) {
  // Not `head: true`: a HEAD request for a missing table comes back with no
  // error and a null count, which reads as "fine". A real GET reports it.
  const { count, error } = await db.from(table).select('*', { count: 'exact' }).limit(0)
  const missing = Boolean(error) || count === null
  if (missing) ok = false
  console.log(`${table.padEnd(14)} ${missing ? `MISSING${error ? ` (${error.message})` : ''}` : `${count} rows`}`)
}

const { data: season } = await db.from('seasons').select('year').order('year', { ascending: false }).limit(1)
console.log(`\ncurrent season: ${season?.[0]?.year ?? 'none'}`)
console.log(ok ? '\nDatabase looks right.' : '\nSomething is missing. Has supabase/01-schema.sql been run?')
process.exit(ok ? 0 : 1)
