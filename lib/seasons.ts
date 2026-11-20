// What happens to each idea when a new Christmas starts. Pure, so it's tested
// directly. supabase/02-seasons.sql does the same thing inside the database in
// one step (so a half-finished start is impossible); this copy powers the
// "here's what will happen" preview before anyone presses the button.
//
//   carry   — nobody bought it or started a group gift: it moves to the new
//             year, tagged "From last year".
//   copy    — a "more than one is fine" idea someone bought: the bought one
//             stays in last year's history, and a fresh copy starts the new year.
//   history — bought, or part of a group gift: stays in last year.
// Ideas the owner removed stay behind too.

export type SeasonItem = { id: string; multi_ok: boolean; deleted_at: string | null }

export type SeasonPlan = { carry: string[]; copy: string[]; history: string[] }

export function planSeason(items: SeasonItem[], claimedIds: Set<string>, splitIds: Set<string>): SeasonPlan {
  const plan: SeasonPlan = { carry: [], copy: [], history: [] }
  for (const item of items) {
    if (item.deleted_at) continue
    const bought = claimedIds.has(item.id)
    if (item.multi_ok && bought) {
      plan.copy.push(item.id)
      plan.history.push(item.id)
    } else if (bought || splitIds.has(item.id)) {
      plan.history.push(item.id)
    } else {
      plan.carry.push(item.id)
    }
  }
  return plan
}

/**
 * Whether a list is closed to buyers until its owner reviews it: it has ideas
 * that came forward from last year, and the owner hasn't tapped "My list is up
 * to date" this season. A list of only new ideas needs no review.
 */
export function needsReview(items: { carried_from_year: number | null }[], reviewed: boolean): boolean {
  return !reviewed && items.some((i) => i.carried_from_year !== null)
}
