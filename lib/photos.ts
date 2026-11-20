import 'server-only'
import { lookup } from 'node:dns/promises'
import { randomUUID } from 'node:crypto'
import { db } from './db'
import { isPrivateHost, parsePreview, type Preview } from './linkpreview'

// Fetching store pages and photos, and keeping photos in our own storage.
//
// Photos are copied into the item-photos bucket rather than shown straight from
// the store, because stores move and delete images, and many refuse to be shown
// on other sites. A copy keeps the list looking right all season.

const BUCKET = 'item-photos'
const TIMEOUT_MS = 6000
const MAX_PAGE_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
}

// A normal browser's request headers. Several stores send a blank page to
// anything that looks like a script.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

/** Refuses anything that resolves to this machine or a private network. */
async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('not a web link')
  if (isPrivateHost(url.hostname)) throw new Error('private host')
  const addresses = await lookup(url.hostname, { all: true })
  if (addresses.some((a) => isPrivateHost(a.address))) throw new Error('private address')
}

/** fetch, following at most 3 redirects, checking every hop. */
async function safeFetch(raw: string): Promise<Response> {
  let url = new URL(raw)
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url)
    const res = await fetch(url, { headers: HEADERS, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
    const next = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && next) {
      url = new URL(next, url)
      continue
    }
    return res
  }
  throw new Error('too many redirects')
}

async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > max) {
      await reader.cancel()
      throw new Error('too large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

/** The photo and name a store page advertises. Never throws; empty when it can't tell. */
export async function previewOf(link: string): Promise<Preview> {
  try {
    const res = await safeFetch(link)
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return { image: null, title: null }
    const html = new TextDecoder().decode(await readCapped(res, MAX_PAGE_BYTES))
    return parsePreview(html, res.url || link)
  } catch {
    return { image: null, title: null }
  }
}

async function upload(bytes: Uint8Array, contentType: string): Promise<string> {
  const ext = IMAGE_TYPES[contentType]
  if (!ext) throw new Error('not a supported image')
  const path = `${randomUUID()}.${ext}`
  const { error } = await db().storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false })
  if (error) throw new Error(error.message)
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Copies a store's photo into our storage. Null if it can't be had. */
export async function copyPhoto(imageUrl: string): Promise<string | null> {
  try {
    const res = await safeFetch(imageUrl)
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!res.ok || !IMAGE_TYPES[type]) return null
    return await upload(await readCapped(res, MAX_IMAGE_BYTES), type)
  } catch {
    return null
  }
}

/** The photo for a link: find it on the page, then copy it. Null if none. */
export async function photoFromLink(link: string): Promise<string | null> {
  const { image } = await previewOf(link)
  return image ? copyPhoto(image) : null
}

/** A photo the owner chose from their phone (already shrunk in the browser). */
export async function storeUploadedPhoto(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('That photo is too large.')
  return upload(new Uint8Array(await file.arrayBuffer()), file.type.toLowerCase())
}

/**
 * Deletes a photo we stored, once nothing uses it. Call it AFTER the item that
 * used it has been updated. A new season copies "more than one is fine" ideas,
 * and the copy shares last year's photo file, so a file still pointed at by any
 * item (last year's history included) is kept. Store links are left alone.
 */
export async function deleteStoredPhoto(publicUrl: string | null): Promise<void> {
  if (!publicUrl) return
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const at = publicUrl.indexOf(marker)
  if (at === -1) return
  const { count } = await db().from('items').select('*', { count: 'exact' }).eq('photo_url', publicUrl).limit(0)
  if ((count ?? 0) > 0) return
  await db().storage.from(BUCKET).remove([publicUrl.slice(at + marker.length)])
}
