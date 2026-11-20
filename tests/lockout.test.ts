import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lockState, type Attempt } from '../lib/lockout'

const NOW = new Date('2026-12-01T12:00:00Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()

/** n wrong guesses, newest first, the newest `newestAgo` minutes ago. */
const misses = (n: number, newestAgo = 0): Attempt[] =>
  Array.from({ length: n }, (_, i) => ({ succeeded: false, attempted_at: ago(newestAgo + i * 0.1) }))

test('no attempts: 5 tries left', () => {
  assert.deepEqual(lockState([], NOW), { locked: false, triesLeft: 5 })
})

test('each miss uses up a try', () => {
  assert.deepEqual(lockState(misses(3), NOW), { locked: false, triesLeft: 2 })
})

test('the fifth miss locks for 5 minutes', () => {
  const s = lockState(misses(5), NOW)
  assert.equal(s.locked, true)
  if (s.locked) assert.equal(s.until.toISOString(), new Date(NOW.getTime() + 5 * 60_000).toISOString())
})

test('after the wait, there are 5 fresh tries', () => {
  assert.deepEqual(lockState(misses(5, 6), NOW), { locked: false, triesLeft: 5 })
})

test('the second lock is 10 minutes, the third 20', () => {
  const second = lockState(misses(10, 6), NOW)
  assert.equal(second.locked, true)
  if (second.locked) assert.equal(second.until.getTime() - new Date(ago(6)).getTime(), 10 * 60_000)
  const third = lockState(misses(15, 0), NOW)
  if (third.locked) assert.equal(third.until.getTime() - NOW.getTime(), 20 * 60_000)
  else assert.fail('should be locked')
})

test('locks never exceed a day', () => {
  const s = lockState(misses(100), NOW)
  if (s.locked) assert.equal(s.until.getTime() - NOW.getTime(), 24 * 60 * 60_000)
  else assert.fail('should be locked')
})

test('a correct PIN wipes the slate', () => {
  const attempts: Attempt[] = [...misses(2), { succeeded: true, attempted_at: ago(5) }, ...misses(4, 6)]
  assert.deepEqual(lockState(attempts, NOW), { locked: false, triesLeft: 3 })
})
