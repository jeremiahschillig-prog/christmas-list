// Small display helpers. Pure, so they're tested directly.

/** 68 → "$68", 58.5 → "$58.50", null → null. */
export function formatPrice(price: number | string | null | undefined): string | null {
  if (price === null || price === undefined || price === '') return null
  const n = Number(price)
  if (!Number.isFinite(n)) return null
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`
}

/** "https://shop.lululemon.com/p/…" → "lululemon.com". Null if it isn't a web link. */
export function linkDomain(link: string | null | undefined): string | null {
  if (!link) return null
  try {
    const { protocol, hostname } = new URL(link)
    if (protocol !== 'http:' && protocol !== 'https:') return null
    const parts = hostname.replace(/^www\./, '').split('.')
    // Keep the last two parts ("lululemon.com"), or three for "co.uk"-style endings.
    const keep = parts.length > 2 && parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length === 2 ? 3 : 2
    return parts.slice(-keep).join('.')
  } catch {
    return null
  }
}

/** "Size 6 · Black · $68": whichever of the three an item has. */
export function detailLine(item: { size?: string | null; color?: string | null; price?: number | string | null }): string {
  return [item.size ? `Size ${item.size}` : null, item.color || null, formatPrice(item.price)]
    .filter(Boolean)
    .join(' · ')
}
