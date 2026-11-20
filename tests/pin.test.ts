import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPin, isChoosablePin, isValidPin, starterPin, verifyPin } from '../lib/pin'

test('a hashed PIN verifies, a wrong one does not', async () => {
  const stored = await hashPin('4821')
  assert.ok(stored.startsWith('scrypt$'))
  assert.ok(!stored.includes('4821'))
  assert.equal(await verifyPin('4821', stored), true)
  assert.equal(await verifyPin('4822', stored), false)
})

test('the same PIN hashes differently each time (salted)', async () => {
  assert.notEqual(await hashPin('1111'), await hashPin('1111'))
})

test('only 4 digits count as a PIN', async () => {
  for (const ok of ['0000', '1234', '9999']) assert.equal(isValidPin(ok), true, ok)
  for (const bad of ['', '123', '12345', '12a4', ' 1234']) assert.equal(isValidPin(bad), false, bad)
  await assert.rejects(hashPin('12'))
})

test('a malformed stored value never verifies', async () => {
  assert.equal(await verifyPin('1234', ''), false)
  assert.equal(await verifyPin('1234', 'plain$1234'), false)
})

test('everyone starts on 1111, and nobody can choose it as their own', () => {
  assert.equal(starterPin(), '1111')
  assert.equal(isValidPin(starterPin()), true)
  assert.equal(isChoosablePin('1111'), false)
  assert.equal(isChoosablePin('4821'), true)
  assert.equal(isChoosablePin('12'), false)
})
