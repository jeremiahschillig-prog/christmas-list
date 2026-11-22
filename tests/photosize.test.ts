import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { shrinkForStorage } from '../lib/photosize'

test('a big transparent PNG is stored as a small 800 px JPEG on white', async () => {
  const big = await sharp({ create: { width: 2400, height: 1600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png()
    .toBuffer()
  const out = await shrinkForStorage(new Uint8Array(big))
  const meta = await sharp(out).metadata()
  assert.equal(meta.format, 'jpeg')
  assert.equal(meta.width, 800)
  assert.equal(meta.height, 533)
  const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
  assert.ok(data[0] > 240, 'transparent areas become white, not black')
})

test('a small photo is never enlarged', async () => {
  const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#4E2A4F' } }).jpeg().toBuffer()
  const meta = await sharp(await shrinkForStorage(new Uint8Array(small))).metadata()
  assert.equal(meta.width, 300)
})
