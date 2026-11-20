// Reading a product photo (and a name) out of a store's page. Pure, so it's
// tested on saved snippets of real-looking pages.
//
// Stores publish these for link previews in texts and social posts: the
// og:image / twitter:image meta tags, and often JSON-LD "Product" data. Amazon
// often refuses automated requests, which is why the owner can always replace
// the photo by hand.

export type Preview = { image: string | null; title: string | null }

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

function jsonLdProduct(html: string): { image: string | null; name: string | null } {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const [, body] of blocks) {
    try {
      const data = JSON.parse(body)
      const nodes: unknown[] = Array.isArray(data) ? data : data['@graph'] ?? [data]
      for (const node of nodes) {
        const n = node as Record<string, unknown>
        const type = n['@type']
        if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
          const img = n.image
          const image =
            typeof img === 'string' ? img
            : Array.isArray(img) ? (typeof img[0] === 'string' ? img[0] : (img[0] as { url?: string })?.url ?? null)
            : (img as { url?: string } | undefined)?.url ?? null
          return { image: image ?? null, name: typeof n.name === 'string' ? n.name : null }
        }
      }
    } catch {
      // A malformed block on someone's store page isn't our problem; try the next.
    }
  }
  return { image: null, name: null }
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
  const product = jsonLdProduct(html)
  const image = product.image ?? meta(html, 'og:image') ?? meta(html, 'og:image:url') ?? meta(html, 'twitter:image')
  const titleTag = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]
  const title = product.name ?? meta(html, 'og:title') ?? (titleTag ? decode(titleTag) : null)
  return { image: absolute(image, pageUrl), title: title ? title.slice(0, 120) : null }
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
