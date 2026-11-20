// Going in together: the arithmetic and the hand-offs. Pure, so it's tested directly.

export type SplitMember = { id: string; name: string; amount: number; joined_at: string }

export type SplitInfo = {
  purchaserId: string
  purchaserName: string
  members: SplitMember[]
  pledged: number
  /** Still needed to reach the item's price; null when the item has no price. */
  remaining: number | null
  /** 0–100 for the progress bar; null when the item has no price. */
  percent: number | null
  ordered: boolean
}

export function summarize(
  price: number | string | null,
  members: SplitMember[],
  purchaserId: string,
  ordered: boolean,
): SplitInfo {
  const sorted = [...members].sort((a, b) => a.joined_at.localeCompare(b.joined_at))
  const pledged = Math.round(sorted.reduce((sum, m) => sum + Number(m.amount), 0) * 100) / 100
  const p = price === null || price === '' ? null : Number(price)
  const hasPrice = p !== null && Number.isFinite(p) && p > 0
  return {
    purchaserId,
    purchaserName: sorted.find((m) => m.id === purchaserId)?.name ?? '',
    members: sorted,
    pledged,
    remaining: hasPrice ? Math.max(0, Math.round((p - pledged) * 100) / 100) : null,
    percent: hasPrice ? Math.min(100, Math.round((pledged / p) * 100)) : null,
    ordered,
  }
}

/**
 * Who orders the gift after someone leaves. The purchaser stays unless they're
 * the one leaving; then it passes to whoever joined earliest of those left.
 * Null when nobody is left, which means the split ends and the item reopens.
 */
export function purchaserAfterLeaving(
  members: { id: string; joined_at: string }[],
  leavingId: string,
  purchaserId: string,
): string | null {
  const left = members.filter((m) => m.id !== leavingId).sort((a, b) => a.joined_at.localeCompare(b.joined_at))
  if (left.length === 0) return null
  return purchaserId === leavingId ? left[0].id : purchaserId
}

/** A pledge must be a positive amount of money, at most $100,000. */
export function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ''))
  if (!raw.trim() || !Number.isFinite(n) || n <= 0 || n > 100_000) return null
  return Math.round(n * 100) / 100
}
