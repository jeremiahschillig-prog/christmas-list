import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOpen, loadList, statusOf, type ClaimRow, type ItemRow, type ListDeps, type ParentNoteRow, type SplitRow } from '../lib/listview'

const ELLIE = 'ellie'
const GRANDMA = 'grandma'
const GRANDPA = 'grandpa'

let seq = 0
function item(over: Partial<ItemRow> = {}): ItemRow {
  seq++
  return {
    id: `item-${seq}`, owner_id: ELLIE, name: `Item ${seq}`, link: null, size: null, color: null,
    notes: null, price: null, is_top_pick: false, is_cash: false, cash_for: null, multi_ok: false,
    photo_url: null, sort_order: 0, carried_from_year: null, created_at: `2026-11-20T00:00:0${seq % 10}Z`,
    ...over,
  }
}

/** Fake database that records which calls were made. */
function fakeDeps(items: ItemRow[], claims: ClaimRow[] = [], splits: SplitRow[] = [], reviewed = false, notes: ParentNoteRow[] = []) {
  const calls: string[] = []
  const deps: ListDeps = {
    items: async () => (calls.push('items'), items.map((i) => ({ ...i }))),
    claims: async () => (calls.push('claims'), claims),
    splits: async () => (calls.push('splits'), splits),
    parentNotes: async () => (calls.push('parentNotes'), notes),
    reviewed: async () => (calls.push('reviewed'), reviewed),
  }
  return { deps, calls }
}

// ---------------------------------------------------------------- the surprise rule

test("an owner's own list never fetches purchases", async () => {
  const shorts = item()
  const { deps, calls } = fakeDeps([shorts], [{ item_id: shorts.id, buyer_id: GRANDMA }])
  const view = await loadList(ELLIE, ELLIE, deps)
  assert.equal(view.kind, 'own')
  assert.deepEqual(calls, ['items'])
})

test("an owner's own items carry no status of any kind", async () => {
  const shorts = item({ multi_ok: true })
  const { deps } = fakeDeps([shorts], [{ item_id: shorts.id, buyer_id: GRANDMA }])
  const view = await loadList(ELLIE, ELLIE, deps)
  const json = JSON.stringify(view)
  for (const word of ['status', 'taken', 'mine', 'bought', GRANDMA]) {
    assert.ok(!json.includes(word), `own view leaked "${word}"`)
  }
})

test('an owner with a bought item and one with none get identical views', async () => {
  const a = item({ id: 'same' })
  const bought = await loadList(ELLIE, ELLIE, fakeDeps([a], [{ item_id: 'same', buyer_id: GRANDMA }]).deps)
  const notBought = await loadList(ELLIE, ELLIE, fakeDeps([a]).deps)
  assert.deepEqual(bought, notBought)
})

test("a parents' note reaches buyers, never the owner", async () => {
  const pass = item({ name: 'Six Flags pass' })
  const notes = [{ item_id: pass.id, note: 'We already bought this on sale.' }]
  const own = fakeDeps([pass], [], [], false, notes)
  const ownJson = JSON.stringify(await loadList(ELLIE, ELLIE, own.deps))
  assert.deepEqual(own.calls, ['items'])
  assert.ok(!ownJson.includes('already bought') && !ownJson.includes('parentNote'))

  const view = await loadList(GRANDMA, ELLIE, fakeDeps([pass], [], [], false, notes).deps)
  assert.equal(view.kind, 'buyer')
  if (view.kind === 'buyer') {
    assert.equal(view.items[0].parentNote, 'We already bought this on sale.')
    assert.equal(view.items[0].status.kind, 'open')
  }
})

// ---------------------------------------------------------------- what buyers see

test('buyers see open, mine and taken', async () => {
  const open = item(), mine = item(), theirs = item()
  const claims = [{ item_id: mine.id, buyer_id: GRANDMA }, { item_id: theirs.id, buyer_id: GRANDPA }]
  const view = await loadList(GRANDMA, ELLIE, fakeDeps([open, mine, theirs], claims).deps)
  assert.equal(view.kind, 'buyer')
  if (view.kind !== 'buyer') return
  const kinds = Object.fromEntries(view.items.map((i) => [i.id, i.status.kind]))
  assert.deepEqual(kinds, { [open.id]: 'open', [mine.id]: 'mine', [theirs.id]: 'taken' })
})

test('"more than one is fine" stays open and counts purchases', () => {
  const shorts = item({ multi_ok: true })
  const claims = [{ item_id: shorts.id, buyer_id: GRANDPA }]
  assert.deepEqual(statusOf(shorts, GRANDMA, claims, []), { kind: 'open', boughtCount: 1, mine: false })
  assert.deepEqual(statusOf(shorts, GRANDPA, claims, []), { kind: 'open', boughtCount: 1, mine: true })
  assert.equal(isOpen(statusOf(shorts, GRANDMA, claims, [])), true)
  assert.equal(isOpen(statusOf(shorts, GRANDPA, claims, [])), false)
})

test('group gifts: in progress, then taken once ordered', () => {
  const tv = item({ price: 249 })
  const members = [{ id: GRANDPA, name: 'Grandpa', amount: 100, joined_at: '2026-11-20T00:00:00Z' }]
  const forming: SplitRow[] = [{ item_id: tv.id, ordered_at: null, purchaser_id: GRANDPA, members }]

  const seen = statusOf(tv, GRANDMA, [], forming)
  assert.equal(seen.kind, 'together')
  if (seen.kind === 'together') {
    assert.equal(seen.member, false)
    assert.equal(seen.split.remaining, 149)
    assert.equal(seen.split.purchaserName, 'Grandpa')
  }
  const own = statusOf(tv, GRANDPA, [], forming)
  assert.equal(own.kind === 'together' && own.member, true)

  const ordered: SplitRow[] = [{ ...forming[0], ordered_at: '2026-12-01T00:00:00Z' }]
  assert.deepEqual(statusOf(tv, GRANDMA, [], ordered), { kind: 'taken' })
  const mine = statusOf(tv, GRANDPA, [], ordered)
  assert.equal(mine.kind === 'mine' && mine.split?.ordered, true)
})

test("an owner's own list never sees a group gift either", async () => {
  const tv = item({ price: 249 })
  const members = [{ id: GRANDPA, name: 'Grandpa', amount: 100, joined_at: '2026-11-20T00:00:00Z' }]
  const { deps, calls } = fakeDeps([tv], [], [{ item_id: tv.id, ordered_at: null, purchaser_id: GRANDPA, members }])
  const json = JSON.stringify(await loadList(ELLIE, ELLIE, deps))
  assert.deepEqual(calls, ['items'])
  for (const word of ['together', 'Grandpa', 'pledged', 'split']) assert.ok(!json.includes(word), `leaked "${word}"`)
})

test('open items come first with top picks leading; taken ones sink', async () => {
  const plain = item({ sort_order: 1 }), top = item({ is_top_pick: true, sort_order: 5 }), gone = item({ is_top_pick: true })
  const view = await loadList(GRANDMA, ELLIE, fakeDeps([plain, gone, top], [{ item_id: gone.id, buyer_id: GRANDPA }]).deps)
  assert.deepEqual(view.items.map((i) => i.id), [top.id, plain.id, gone.id])
})

test('a carried-over list needs review until the owner marks it', async () => {
  const old = item({ carried_from_year: 2026 })
  const pending = await loadList(GRANDMA, ELLIE, fakeDeps([old], [], [], false).deps)
  const done = await loadList(GRANDMA, ELLIE, fakeDeps([old], [], [], true).deps)
  const fresh = await loadList(GRANDMA, ELLIE, fakeDeps([item()]).deps)
  assert.equal(pending.kind === 'buyer' && pending.needsReview, true)
  assert.equal(done.kind === 'buyer' && done.needsReview, false)
  assert.equal(fresh.kind === 'buyer' && fresh.needsReview, false)
})
