// Adds the people who can sign in, each with a starter PIN.
//
//   npm run db:seed
//
// Safe to run again: anyone already in the table is left alone, PIN included.
// Each NEW person's starter PIN is written to scripts/starter-pins.local.json
// (git-ignored, never committed) so Jeremy can hand them out. The database keeps
// only the hash. Once the Admin tab exists (step 7), people and PINs are managed
// there and this script is just for setting up a fresh database.
//
// The two "Test" buyers are for trying the app out as a relative would. Delete
// them before the link goes to the family.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from './db'
import { hashPin, starterPin } from '../lib/pin'

const PEOPLE = [
  { name: 'Jeremy',       is_owner: true,  is_admin: true,  sort_order: 1 },
  { name: 'Jessica',      is_owner: true,  is_admin: true,  sort_order: 2 },
  { name: 'Austin',       is_owner: true,  is_admin: false, sort_order: 3 },
  { name: 'Ellie',        is_owner: true,  is_admin: false, sort_order: 4 },
  { name: 'Test Grandma', is_owner: false, is_admin: false, sort_order: 10 },
  { name: 'Test Grandpa', is_owner: false, is_admin: false, sort_order: 11 },
]

const PIN_FILE = new URL('./starter-pins.local.json', import.meta.url)

const db = connect()

const { data: existing, error } = await db.from('people').select('name')
if (error) {
  console.error(`Could not read people: ${error.message}\nHas supabase/01-schema.sql been run?`)
  process.exit(1)
}
const have = new Set(existing.map((p) => p.name))

const pins: Record<string, string> = existsSync(PIN_FILE) ? JSON.parse(readFileSync(PIN_FILE, 'utf8')) : {}
let added = 0

for (const person of PEOPLE) {
  if (have.has(person.name)) {
    console.log(`  ${person.name}: already there, left alone`)
    continue
  }
  const pin = starterPin()
  const { error: insertError } = await db.from('people').insert({ ...person, pin_hash: await hashPin(pin) })
  if (insertError) {
    console.error(`  ${person.name}: FAILED (${insertError.message})`)
    process.exitCode = 1
    continue
  }
  pins[person.name] = pin
  added++
  console.log(`  ${person.name}: added`)
}

if (added) {
  writeFileSync(PIN_FILE, JSON.stringify(pins, null, 2) + '\n')
  console.log(`\nStarter PINs for the ${added} new people are in scripts/starter-pins.local.json`)
} else {
  console.log('\nNobody new to add.')
}
