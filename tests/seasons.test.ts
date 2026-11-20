import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsReview, planSeason } from '../lib/seasons'

const item = (id: string, over: { multi_ok?: boolean; deleted_at?: string | null } = {}) => ({
  id, multi_ok: false, deleted_at: null, ...over,
})

test('unbought ideas carry forward; bought ones stay in history', () => {
  const plan = planSeason([item('a'), item('b'), item('c')], new Set(['b']), new Set())
  assert.deepEqual(plan, { carry: ['a', 'c'], copy: [], history: ['b'] })
})

test('a group gift stays in history, ordered or not', () => {
  const plan = planSeason([item('tv')], new Set(), new Set(['tv']))
  assert.deepEqual(plan, { carry: [], copy: [], history: ['tv'] })
})

test('a bought "more than one" idea stays in history AND starts fresh next year', () => {
  const plan = planSeason([item('socks', { multi_ok: true })], new Set(['socks']), new Set())
  assert.deepEqual(plan, { carry: [], copy: ['socks'], history: ['socks'] })
})

test('an unbought "more than one" idea simply carries', () => {
  const plan = planSeason([item('socks', { multi_ok: true })], new Set(), new Set())
  assert.deepEqual(plan, { carry: ['socks'], copy: [], history: [] })
})

test('removed ideas go nowhere', () => {
  const plan = planSeason([item('gone', { deleted_at: '2026-12-01' })], new Set(), new Set())
  assert.deepEqual(plan, { carry: [], copy: [], history: [] })
})

test('a carried list needs review until the owner marks it', () => {
  const carried = [{ carried_from_year: 2026 }, { carried_from_year: null }]
  assert.equal(needsReview(carried, false), true)
  assert.equal(needsReview(carried, true), false)
  assert.equal(needsReview([{ carried_from_year: null }], false), false)
  assert.equal(needsReview([], false), false)
})
