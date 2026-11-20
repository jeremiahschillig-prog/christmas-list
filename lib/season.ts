import 'server-only'
import { db } from './db'
import { currentYear } from './lists'
import { needsReview, planSeason, type SeasonItem } from './seasons'

// Season data for the Admin tab's Season section and the review gate.

export type SeasonInfo = {
  year: number
  years: number[]
  preview: { carry: number; copy: number; history: number }
  /** The newest season can be undone while nothing has happened in it yet. */
  canUndo: boolean
}

export async function seasonInfo(): Promise<SeasonInfo> {
  const year = await currentYear()
  const [{ data: seasons }, { data: items }] = await Promise.all([
    db().from('seasons').select('year').order('year'),
    db().from('items').select('id, multi_ok, deleted_at, carried_from_year').eq('year', year),
  ])
  const ids = (items ?? []).map((i) => i.id)
  const [{ data: claims }, { data: splits }] = ids.length
    ? await Promise.all([
        db().from('claims').select('item_id').in('item_id', ids),
        db().from('splits').select('item_id').in('item_id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  const plan = planSeason(
    (items ?? []) as SeasonItem[],
    new Set((claims ?? []).map((c) => c.item_id)),
    new Set((splits ?? []).map((s) => s.item_id)),
  )
  const years = (seasons ?? []).map((s) => s.year)
  const nothingNewYet =
    (items ?? []).every((i) => i.carried_from_year !== null) && !(claims ?? []).length && !(splits ?? []).length

  return {
    year,
    years,
    preview: { carry: plan.carry.length, copy: plan.copy.length, history: plan.history.length },
    canUndo: years.length > 1 && nothingNewYet,
  }
}

/** Has this owner reviewed their list this season? */
export async function isReviewed(ownerId: string, year: number): Promise<boolean> {
  const { data } = await db().from('list_reviews').select('owner_id').eq('owner_id', ownerId).eq('year', year).maybeSingle()
  return Boolean(data)
}

export async function reviewState(ownerId: string, items: { carried_from_year: number | null }[]) {
  const year = await currentYear()
  const reviewed = await isReviewed(ownerId, year)
  return { year, needsReview: needsReview(items, reviewed), carried: items.some((i) => i.carried_from_year !== null), reviewed }
}
