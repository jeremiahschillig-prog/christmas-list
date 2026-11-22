'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ItemSheet from '@/components/ItemSheet'
import ParentNote from '@/components/ParentNote'
import { unclaimItem } from '@/app/actions/items'
import { detailLine, formatPrice } from '@/lib/format'
import type { BuyerItem, ItemRow, ListView } from '@/lib/listview'

type Props = {
  ownerName: string
  view: ListView
  viewerId: string
  /** "Jeremy & Jessica": who a parents' note sends buyers to. */
  parents: string
  /** Jeremy or Jessica looking at a kid's list: may add a parents' note. */
  canNote: boolean
}


function label(item: ItemRow): string | null {
  const parts = [item.is_top_pick ? 'Top pick' : null, item.is_cash ? 'Cash' : null, item.carried_from_year ? 'From last year' : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

function subline(item: ItemRow): string {
  return item.is_cash ? item.cash_for || 'Cash gift' : detailLine(item)
}

function Thumb({ item }: { item: ItemRow }) {
  if (!item.photo_url) return null
  return (
    // Product photos come from any store's site, so a plain <img> rather than
    // next/image, which would need every store's domain listed in config.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.photo_url} alt="" loading="lazy" decoding="async" className="size-16 shrink-0 rounded-xl border border-line object-cover" />
  )
}

export default function ListScreen({ ownerName, view, viewerId, parents, canNote }: Props) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const isOwn = view.kind === 'own'
  const items: (ItemRow | BuyerItem)[] = view.items
  const selected = items.find((i) => i.id === openId) ?? null

  const open = view.kind === 'buyer' ? view.items.filter((i) => i.status.kind === 'open') : []
  // Group gifts still forming get their own section: anyone can still join them.
  const forming = view.kind === 'buyer' ? view.items.filter((i) => i.status.kind === 'together') : []
  const done = view.kind === 'buyer' ? view.items.filter((i) => i.status.kind === 'mine' || i.status.kind === 'taken') : []
  const needsReview = view.kind === 'buyer' && view.needsReview

  async function undo(id: string) {
    setBusyId(id)
    await unclaimItem(id)
    setBusyId(null)
    router.refresh()
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-12 pb-16">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="Back to all lists"
          className="flex size-11 items-center justify-center rounded-full border border-line bg-white text-plum"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        {view.kind === 'buyer' && (
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
            {open.filter((i) => i.status.kind === 'open' && !i.status.mine).length} open · {done.length} taken
          </span>
        )}
      </div>

      <h1 className="mt-4 font-serif text-[40px] leading-tight text-plum">
        {isOwn ? 'Your List' : `${ownerName}'s List`}
      </h1>

      {isOwn && (
        <p className="mt-3 rounded-2xl bg-soft px-4 py-3 text-[14px] leading-relaxed text-ink">
          You won&apos;t see what&apos;s been bought here, so it stays a surprise. To add or change ideas, use{' '}
          <Link href="/my-list" className="font-semibold text-plum underline underline-offset-4">My List</Link>.
        </p>
      )}

      {needsReview && (
        <p className="mt-3 rounded-2xl bg-soft px-4 py-3 text-[14px] leading-relaxed text-ink">
          {ownerName} hasn&apos;t reviewed this list for this year yet, so nothing can be marked yet. Check back soon.
        </p>
      )}

      {items.length === 0 && (
        <p className="mt-8 text-center text-[15px] text-muted">
          {isOwn ? 'Your list is empty so far.' : `${ownerName} hasn't added any ideas yet.`}
        </p>
      )}

      {/* ---- Your own list: plain, no status of any kind ---- */}
      {isOwn && (
        <div className="mt-5 flex flex-col gap-2.5">
          {view.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpenId(item.id)}
              className="flex items-center gap-3.5 rounded-[18px] border border-line bg-white px-[18px] py-4 text-left"
            >
              <Thumb item={item} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {label(item) && <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-text">{label(item)}</span>}
                <span className="font-serif text-[20px] leading-snug text-plum">{item.name}</span>
                {subline(item) && <span className="text-[14px] text-muted">{subline(item)}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ---- Someone else's list ---- */}
      {open.length > 0 && (
        <div className="mt-5 flex flex-col gap-2.5">
          {open.map((item) => {
            const s = item.status.kind === 'open' ? item.status : null
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setOpenId(item.id)}
                className="flex items-center gap-3.5 rounded-[18px] border border-line bg-white px-[18px] py-4 text-left shadow-[0_6px_20px_rgba(78,42,79,0.05)]"
              >
                <Thumb item={item} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  {label(item) && <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-text">{label(item)}</span>}
                  <span className="font-serif text-[20px] leading-snug text-plum">{item.name}</span>
                  {subline(item) && <span className="text-[14px] text-muted">{subline(item)}</span>}
                  {item.multi_ok && (
                    <span className="text-[13px] font-medium text-got">
                      {s?.mine
                        ? `You got one · ${s.boughtCount} bought so far`
                        : `More than one is fine${s && s.boughtCount ? ` · ${s.boughtCount} bought so far` : ''}`}
                    </span>
                  )}
                  {item.parentNote && <span className="mt-1"><ParentNote note={item.parentNote} compact /></span>}
                </span>
                {/* Already bought by the parents: no quick "I got this" here. The sheet says to ask them first. */}
                {!s?.mine && !needsReview && !item.parentNote && (
                  <span
                    className={`shrink-0 rounded-full px-3.5 py-2.5 text-[14px] font-semibold ${
                      item.is_top_pick ? 'bg-plum text-paper' : 'border border-plum text-plum'
                    }`}
                  >
                    I got this
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {forming.length > 0 && (
        <>
          <p className="mt-7 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
            Going in together
            <span className="h-px flex-1 bg-line" />
          </p>
          <div className="mt-3 flex flex-col gap-2.5">
            {forming.map((item) => {
              if (item.status.kind !== 'together') return null
              const { split, member } = item.status
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOpenId(item.id)}
                  className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-white px-[18px] py-4 text-left"
                >
                  <span className="flex items-center gap-3.5">
                    <Thumb item={item} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-serif text-[20px] leading-snug text-plum">{item.name}</span>
                      <span className="text-[13px] text-muted">
                        {split.members.length} {split.members.length === 1 ? 'person' : 'people'} in ·{' '}
                        {split.remaining === null
                          ? `${formatPrice(split.pledged)} so far`
                          : split.remaining === 0
                            ? 'fully covered'
                            : `${formatPrice(split.remaining)} to go`}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-3.5 py-2.5 text-[14px] font-semibold ${
                        member ? 'bg-soft text-got' : 'border border-plum text-plum'
                      }`}
                    >
                      {member ? "You're in" : 'Join in'}
                    </span>
                  </span>
                  {split.percent !== null && (
                    <span className="h-1.5 rounded-full bg-soft">
                      <span className="block h-1.5 rounded-full bg-plum" style={{ width: `${split.percent}%` }} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <p className="mt-7 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Already taken
            <span className="h-px flex-1 bg-line" />
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {done.map((item) => {
              const mine = item.status.kind === 'mine' || (item.status.kind === 'together' && item.status.member)
              const viaGroup = (item.status.kind === 'mine' && Boolean(item.status.split)) || item.status.kind === 'together'
              const together = item.status.kind === 'together'
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-soft px-[18px] py-3">
                  {mine ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-plum">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBF7F6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 12l5 5L20 6" />
                      </svg>
                    </span>
                  ) : (
                    <span className="size-7 shrink-0 rounded-full border border-[#C9B9B5]" />
                  )}
                  <button type="button" onClick={() => setOpenId(item.id)} className="flex min-w-0 flex-1 flex-col text-left">
                    <span className={`text-[16px] ${mine ? 'font-medium text-ink' : 'text-muted'}`}>{item.name}</span>
                    <span className={`text-[13px] ${mine ? 'font-semibold text-got' : 'text-muted'}`}>
                      {mine && viaGroup
                        ? "You're going in together"
                        : mine
                          ? item.parentNote ? `You notified ${parents}` : 'You got this'
                          : together ? 'Going in together' : 'Taken'}
                    </span>
                  </button>
                  {mine && !viaGroup && (
                    <button
                      type="button"
                      onClick={() => undo(item.id)}
                      disabled={busyId === item.id}
                      className="min-h-11 px-1 text-[14px] font-semibold text-plum underline underline-offset-4 disabled:opacity-50"
                    >
                      Undo
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {selected && (
        <ItemSheet
          item={selected}
          ownerName={ownerName}
          isOwn={isOwn}
          needsReview={needsReview}
          viewerId={viewerId}
          parents={parents}
          canNote={canNote}
          onClose={() => setOpenId(null)}
        />
      )}
    </main>
  )
}
