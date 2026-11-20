import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adminVisibleLists, canRemovePerson, cleanName } from '../lib/adminrules'

const owners = [
  { id: 'jeremy', name: 'Jeremy' },
  { id: 'jessica', name: 'Jessica' },
  { id: 'austin', name: 'Austin' },
  { id: 'ellie', name: 'Ellie' },
]

test('Jeremy sees every list but his own', () => {
  const seen = adminVisibleLists({ id: 'jeremy', is_admin: true }, owners).map((o) => o.name)
  assert.deepEqual(seen, ['Jessica', 'Austin', 'Ellie'])
})

test('Jessica sees every list but her own', () => {
  const seen = adminVisibleLists({ id: 'jessica', is_admin: true }, owners).map((o) => o.name)
  assert.deepEqual(seen, ['Jeremy', 'Austin', 'Ellie'])
})

test('the kids and relatives see nothing', () => {
  assert.deepEqual(adminVisibleLists({ id: 'ellie', is_admin: false }, owners), [])
  assert.deepEqual(adminVisibleLists({ id: 'grandma', is_admin: false }, owners), [])
})

test('names are tidied and kept to a sensible length', () => {
  assert.equal(cleanName('  Aunt   Sue '), 'Aunt Sue')
  assert.equal(cleanName('   '), null)
  assert.equal(cleanName('x'.repeat(41)), null)
})

test('list owners cannot be removed; relatives can', () => {
  assert.equal(canRemovePerson({ is_owner: true }), false)
  assert.equal(canRemovePerson({ is_owner: false }), true)
})
