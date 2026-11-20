import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAmount, purchaserAfterLeaving, summarize } from '../lib/splits'

const at = (n: number) => `2026-11-20T00:00:0${n}Z`
const members = [
  { id: 'grandpa', name: 'Grandpa', amount: 75, joined_at: at(2) },
  { id: 'grandma', name: 'Grandma', amount: 100, joined_at: at(1) },
]

test('adds up pledges against the price', () => {
  const s = summarize(249, members, 'grandma', false)
  assert.equal(s.pledged, 175)
  assert.equal(s.remaining, 74)
  assert.equal(s.percent, 70)
  assert.equal(s.purchaserName, 'Grandma')
  assert.deepEqual(s.members.map((m) => m.id), ['grandma', 'grandpa']) // in the order they joined
})

test('over-pledging caps at 100% with nothing left to go', () => {
  const s = summarize(150, members, 'grandma', false)
  assert.equal(s.remaining, 0)
  assert.equal(s.percent, 100)
})

test('no price: just the total, no bar', () => {
  const s = summarize(null, members, 'grandma', false)
  assert.equal(s.pledged, 175)
  assert.equal(s.remaining, null)
  assert.equal(s.percent, null)
})

test('the purchaser stays when someone else leaves', () => {
  assert.equal(purchaserAfterLeaving(members, 'grandpa', 'grandma'), 'grandma')
})

test('when the purchaser leaves, the earliest remaining member takes over', () => {
  const three = [...members, { id: 'aunt', name: 'Aunt', amount: 20, joined_at: at(3) }]
  assert.equal(purchaserAfterLeaving(three, 'grandma', 'grandma'), 'grandpa')
})

test('when the last person leaves, the split ends', () => {
  assert.equal(purchaserAfterLeaving([members[1]], 'grandma', 'grandma'), null)
})

test('amounts accept the ways people type them', () => {
  assert.equal(parseAmount('$50'), 50)
  assert.equal(parseAmount('37.5'), 37.5)
  for (const bad of ['', '0', '-5', 'lots', '200000']) assert.equal(parseAmount(bad), null, bad)
})
