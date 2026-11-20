import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canEditList, changeRecipients } from '../lib/permissions'
import { meaningfulChanges, normalizeLink, parsePrice, validateItem, type ItemInput } from '../lib/itemform'
import { isPrivateHost, parsePreview } from '../lib/linkpreview'

const jeremy = { id: 'jeremy', is_owner: true, is_admin: true }
const jessica = { id: 'jessica', is_owner: true, is_admin: true }
const ellie = { id: 'ellie', is_owner: true, is_admin: false }
const austin = { id: 'austin', is_owner: true, is_admin: false }
const grandma = { id: 'grandma', is_owner: false, is_admin: false }

// ---------------------------------------------------------------- who edits what

test('everyone edits their own list', () => {
  for (const p of [jeremy, jessica, ellie, austin]) assert.equal(canEditList(p, p), true)
})

test("parents edit the kids' lists, not each other's", () => {
  assert.equal(canEditList(jeremy, ellie), true)
  assert.equal(canEditList(jessica, austin), true)
  assert.equal(canEditList(jessica, jeremy), false)
  assert.equal(canEditList(jeremy, jessica), false)
})

test("kids and relatives can't edit anyone else's list", () => {
  assert.equal(canEditList(ellie, austin), false)
  assert.equal(canEditList(ellie, jeremy), false)
  assert.equal(canEditList(grandma, ellie), false)
  assert.equal(canEditList(grandma, grandma), false) // relatives have no list
})

test('change alerts never go to the owner or whoever made the change', () => {
  const to = changeRecipients({ ownerId: 'ellie', editorId: 'ellie', buyerIds: ['grandma'], adminIds: ['jeremy', 'jessica'] })
  assert.deepEqual(to.sort(), ['grandma', 'jeremy', 'jessica'])
  const parentEdit = changeRecipients({ ownerId: 'ellie', editorId: 'jessica', buyerIds: ['grandma'], adminIds: ['jeremy', 'jessica'] })
  assert.deepEqual(parentEdit.sort(), ['grandma', 'jeremy'])
  const ownList = changeRecipients({ ownerId: 'jeremy', editorId: 'jeremy', buyerIds: ['jessica'], adminIds: ['jeremy', 'jessica'] })
  assert.deepEqual(ownList, ['jessica'])
})

// ---------------------------------------------------------------- the form

const blank: ItemInput = {
  name: '', link: '', size: '', color: '', notes: '', price: '',
  is_top_pick: false, is_cash: false, cash_for: '', multi_ok: false,
}

test('a name is required', () => {
  assert.equal(validateItem(blank).ok, false)
  assert.equal(validateItem({ ...blank, name: '   ' }).ok, false)
  assert.equal(validateItem({ ...blank, name: 'Hoodie' }).ok, true)
})

test('blank fields become null and spaces are tidied', () => {
  const r = validateItem({ ...blank, name: '  Lululemon   shorts ', size: ' 6 ', color: '' })
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.fields.name, 'Lululemon shorts')
    assert.equal(r.fields.size, '6')
    assert.equal(r.fields.color, null)
  }
})

test('links get https added, and junk links are refused', () => {
  assert.equal(normalizeLink('shop.lululemon.com/p/1'), 'https://shop.lululemon.com/p/1')
  assert.equal(normalizeLink('https://amazon.com/dp/X'), 'https://amazon.com/dp/X')
  assert.equal(normalizeLink('javascript:alert(1)'), null)
  assert.equal(normalizeLink('hello'), null)
  assert.equal(validateItem({ ...blank, name: 'X', link: 'not a link' }).ok, false)
})

test('prices accept the ways people type them', () => {
  assert.equal(parsePrice('$68'), 68)
  assert.equal(parsePrice('1,299.50'), 1299.5)
  assert.equal(parsePrice(''), null)
  assert.equal(parsePrice('cheap'), null)
  assert.equal(validateItem({ ...blank, name: 'X', price: 'cheap' }).ok, false)
})

test('a cash request drops link, size and color', () => {
  const r = validateItem({ ...blank, name: 'Concert money', is_cash: true, cash_for: 'March concert', link: 'x.com', size: 'M' })
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual([r.fields.link, r.fields.size, r.fields.cash_for], [null, null, 'March concert'])
})

// ---------------------------------------------------------------- changes that matter

test('size, color, name and link changes are flagged; notes and price are not', () => {
  const before = { name: 'Shorts', size: '6', color: 'Black', link: null, notes: 'a', price: 68, cash_for: null }
  const r = validateItem({ ...blank, name: 'Shorts', size: '6', color: 'Navy', notes: 'b', price: '70' })
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(meaningfulChanges(before, r.fields), [{ field: 'color', from: 'Black', to: 'Navy' }])
})

test('changing only capitals or spaces is not a change', () => {
  const r = validateItem({ ...blank, name: 'shorts', color: 'black' })
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(meaningfulChanges({ name: 'Shorts', color: 'Black' }, r.fields), [])
})

// ---------------------------------------------------------------- reading store pages

test('JSON-LD product data wins', () => {
  const html = `<head><meta property="og:image" content="https://x.com/og.jpg">
    <script type="application/ld+json">{"@type":"Product","name":"Align Short 6\\"","image":["https://x.com/p.jpg"]}</script></head>`
  assert.deepEqual(parsePreview(html, 'https://x.com/p'), { image: 'https://x.com/p.jpg', title: 'Align Short 6"' })
})

test('falls back to og:image (either attribute order) and the title', () => {
  const html = `<title>Hoodie &amp; More</title><meta content="/img/h.jpg" property="og:image">`
  assert.deepEqual(parsePreview(html, 'https://shop.example.com/h'), { image: 'https://shop.example.com/img/h.jpg', title: 'Hoodie & More' })
})

test('a page with nothing gives nothing', () => {
  assert.deepEqual(parsePreview('<html></html>', 'https://x.com'), { image: null, title: null })
})

test('the server refuses to fetch private addresses', () => {
  for (const h of ['localhost', '127.0.0.1', '192.168.1.10', '10.0.0.1', '172.20.1.1', '169.254.169.254', '[::1]', 'homeassistant.local', 'intranet']) {
    assert.equal(isPrivateHost(h), true, h)
  }
  for (const h of ['shop.lululemon.com', 'amazon.com', '172.32.0.1']) assert.equal(isPrivateHost(h), false, h)
})
