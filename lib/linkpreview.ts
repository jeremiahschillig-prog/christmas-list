// Reading a product photo, name and price out of a store's page. Pure, so it's
// tested on saved snippets of real-looking pages.
//
// Stores publish these for link previews in texts and social posts: the
// og:image / twitter:image meta tags, and often JSON-LD "Product" data. Amazon
// often refuses automated requests, which is why the owner can always replace
// the photo by hand.

export type Preview = { image: string | null; title: string | null; price: number | null }

/** "$1,299.00" / "24.99" / 24.99 → a sensible dollar amount, or null. */
function toPrice(v: unknown): number | null {
  if (typeof v !== 'number' && typeof v !== 'string') return null
  const n = typeof v === 'number' ? v : Number(v.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null
}

/**
 * The price in a JSON-LD "offers" value: one Offer, a list of them (one per
 * size or color), or an AggregateOffer. When the link picks a variant
 * (Shopify's ?variant=123), that variant's offer wins. Prices in another
 * currency are skipped.
 */
function offerPrice(offers: unknown, pageUrl: string): number | null {
  const list = (Array.isArray(offers) ? offers : [offers]).filter(
    (o): o is Record<string, unknown> => typeof o === 'object' && o !== null,
  )
  const usd = list.filter((o) => !o.priceCurrency || String(o.priceCurrency).toUpperCase() === 'USD')
  let variant: string | null = null
  try {
    variant = new URL(pageUrl).searchParams.get('variant')
  } catch {}
  const picked = (variant && usd.find((o) => typeof o.url === 'string' && o.url.includes(variant))) || usd[0]
  if (!picked) return null
  const spec = picked.priceSpecification as Record<string, unknown> | undefined
  return toPrice(picked.price) ?? toPrice(picked.lowPrice) ?? toPrice(spec?.price)
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function meta(html: string, key: string): string | null {
  // <meta property="og:image" content="…"> with the attributes in either order.
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, 'i').exec(html)
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, 'i').exec(html)
  const v = a?.[1] ?? b?.[1]
  return v ? decode(v) : null
}

/** JSON-LD "image": a URL, a list of them, or an ImageObject. */
function imageOf(img: unknown): string | null {
  const first = Array.isArray(img) ? img[0] : img
  if (typeof first === 'string') return first
  return (first as { url?: string } | undefined)?.url ?? null
}

function jsonLdProduct(html: string, pageUrl: string): { image: string | null; name: string | null; price: number | null } {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const [, body] of blocks) {
    try {
      // Some stores (PacSun) leave raw line breaks inside their text, which
      // strict JSON refuses. As spaces they're harmless.
      const data = JSON.parse(body.replace(/[\u0000-\u001f]+/g, ' '))
      const nodes: unknown[] = Array.isArray(data) ? data : data['@graph'] ?? [data]
      for (const node of nodes) {
        const n = node as Record<string, unknown>
        const type = n['@type']
        const is = (t: string) => type === t || (Array.isArray(type) && type.includes(t))
        if (is('Product') || is('ProductGroup')) {
          // A ProductGroup keeps its photos and prices on each variant
          // ("hasVariant", or "variants" on PacSun).
          const list = n.hasVariant ?? n.variants
          const variants = (Array.isArray(list) ? list : []).filter(
            (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
          )
          const image = imageOf(n.image) ?? imageOf(variants[0]?.image)
          const price = offerPrice(n.offers, pageUrl) ?? offerPrice(variants.map((v) => v.offers).flat(), pageUrl)
          return { image, name: typeof n.name === 'string' ? n.name : null, price }
        }
      }
    } catch {
      // A malformed block on someone's store page isn't our problem; try the next.
    }
  }
  return { image: null, name: null, price: null }
}

function absolute(url: string | null, base: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url, base)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

export function parsePreview(html: string, pageUrl: string): Preview {
  const product = jsonLdProduct(html, pageUrl)
  const image = product.image ?? meta(html, 'og:image') ?? meta(html, 'og:image:url') ?? meta(html, 'twitter:image')
  const titleTag = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]
  const title = product.name ?? meta(html, 'og:title') ?? (titleTag ? decode(titleTag) : null)
  const currency = meta(html, 'product:price:currency') ?? meta(html, 'og:price:currency')
  const metaPrice = !currency || currency.toUpperCase() === 'USD'
    ? toPrice(meta(html, 'product:price:amount') ?? meta(html, 'og:price:amount'))
    : null
  return {
    image: absolute(image, pageUrl),
    title: title ? title.slice(0, 120) : null,
    price: product.price ?? metaPrice,
  }
}

/**
 * Hosts the server must never fetch on someone's say-so: this machine, the home
 * network, and cloud metadata addresses. Owners are family, but a link is still
 * typed-in input, and fetching it runs on the server.
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true
  if (!h.includes('.') && !h.includes(':')) return true
  return false
}
