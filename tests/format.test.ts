import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detailLine, formatPrice, linkDomain } from '../lib/format'

test('prices drop .00 but keep real cents', () => {
  assert.equal(formatPrice(68), '$68')
  assert.equal(formatPrice('68.00'), '$68')
  assert.equal(formatPrice(58.5), '$58.50')
  assert.equal(formatPrice(null), null)
  assert.equal(formatPrice('abc'), null)
})

test('links show just the store', () => {
  assert.equal(linkDomain('https://shop.lululemon.com/p/shorts/123'), 'lululemon.com')
  assert.equal(linkDomain('https://www.amazon.com/dp/B0'), 'amazon.com')
  assert.equal(linkDomain('https://www.argos.co.uk/x'), 'argos.co.uk')
  assert.equal(linkDomain('not a link'), null)
  assert.equal(linkDomain('javascript:alert(1)'), null)
})

test('the detail line uses whatever the item has', () => {
  assert.equal(detailLine({ size: '6', color: 'Black', price: 68 }), 'Size 6 · Black · $68')
  assert.equal(detailLine({ color: 'Light pink' }), 'Light pink')
  assert.equal(detailLine({}), '')
})
