// Turning what someone typed into a clean item, and spotting changes that
// matter. Pure, so it's tested directly.

export type ItemInput = {
  name: string
  link: string
  size: string
  color: string
  notes: string
  price: string
  is_top_pick: boolean
  is_cash: boolean
  cash_for: string
  multi_ok: boolean
}

export type ItemFields = {
  name: string
  link: string | null
  size: string | null
  color: string | null
  notes: string | null
  price: number | null
  is_top_pick: boolean
  is_cash: boolean
  cash_for: string | null
  multi_ok: boolean
}

const text = (s: string, max = 500) => {
  const t = s.trim().replace(/\s+/g, ' ').slice(0, max)
  return t === '' ? null : t
}

/** "shop.lululemon.com/x" → "https://shop.lululemon.com/x". Null if it can't be a web link. */
export function normalizeLink(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

/** "$68", "68.00", "1,299" → a number. Null when empty or nonsense. */
export function parsePrice(raw: string): number | null {
  const t = raw.replace(/[$,\s]/g, '')
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null
  return Math.round(n * 100) / 100
}

export type Validated = { ok: true; fields: ItemFields } | { ok: false; error: string }

export function validateItem(input: ItemInput): Validated {
  const name = text(input.name, 120)
  if (!name) return { ok: false, error: 'Give the idea a name.' }

  const link = normalizeLink(input.link)
  if (input.link.trim() && !link) return { ok: false, error: "That link doesn't look right. Copy it from the store's page." }

  if (input.price.trim() && parsePrice(input.price) === null) {
    return { ok: false, error: 'The price should be a number, like 68 or 24.99.' }
  }

  return {
    ok: true,
    fields: {
      name,
      // A cash request has no link, size or color to buy.
      link: input.is_cash ? null : link,
      size: input.is_cash ? null : text(input.size, 40),
      color: input.is_cash ? null : text(input.color, 60),
      notes: text(input.notes, 1000),
      price: parsePrice(input.price),
      is_top_pick: input.is_top_pick,
      is_cash: input.is_cash,
      cash_for: input.is_cash ? text(input.cash_for, 200) : null,
      multi_ok: input.multi_ok,
    },
  }
}

/**
 * The changes worth telling a buyer about. Name, size, color, link and what
 * the money is for change WHAT to buy. Notes, price, top pick and "more than one
 * is fine" don't, so they change quietly (decided Nov 20).
 */
const MEANINGFUL = ['name', 'size', 'color', 'link', 'cash_for'] as const
export type Change = { field: (typeof MEANINGFUL)[number]; from: string | null; to: string | null }

export function meaningfulChanges(before: Partial<ItemFields>, after: ItemFields): Change[] {
  const changes: Change[] = []
  for (const field of MEANINGFUL) {
    const from = (before[field] ?? null) as string | null
    const to = after[field]
    if ((from ?? '').trim().toLowerCase() !== (to ?? '').trim().toLowerCase()) changes.push({ field, from, to })
  }
  return changes
}
