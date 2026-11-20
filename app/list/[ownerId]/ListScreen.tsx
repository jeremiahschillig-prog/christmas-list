'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ItemSheet from '@/components/ItemSheet'
import { unclaimItem } from '@/app/actions/items'
import { detailLine } from '@/lib/format'
import type { BuyerItem, ItemRow, ListView } from '@/lib/listview'

type Props = { ownerName: string; view: ListView }

function label(item: ItemRow): string | null {
  const parts = [item.is_top_pick ? 'Top pick' : null, item.is_cash ? 'Cash' : null].filter(Boolean)
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
    <img src={item.photo_url} alt="" className="size-16 shrink-0 rounded-xl border border-line object-cover" />
  )
}

export default function ListScreen({ ownerName, view }: Props) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const isOwn = view.kind === 'own'
  const items: (ItemRow | BuyerItem)[] = view.items
  const selected = items.find((i) => i.id === openId) ?? null

  const open = view.kind === 'buyer' ? view.items.filter((i) => i.status.kind === 'open') : []
  const done = view.kind === 'buyer' ? view.items.filter((i) => i.status.kind !== 'open') : []
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
          You won&apos;t see what&apos;s been bought here, so it stays a surprise. Adding and editing ideas is coming next.
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
                </span>
                {!s?.mine && !needsReview && (
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

      {done.length > 0 && (
        <>
          <p className="mt-7 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Already taken
            <span className="h-px flex-1 bg-line" />
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {done.map((item) => {
              const mine = item.status.kind === 'mine'
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
                      {mine ? 'You got this' : together ? 'Going in together' : 'Taken'}
                    </span>
                  </button>
                  {mine && (
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
          onClose={() => setOpenId(null)}
        />
      )}
    </main>
  )
}
