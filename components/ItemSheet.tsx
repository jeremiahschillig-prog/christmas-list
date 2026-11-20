'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { claimItem, unclaimItem } from '@/app/actions/items'
import { formatPrice, linkDomain } from '@/lib/format'
import type { BuyerItem, ItemRow } from '@/lib/listview'

// The bottom sheet for one item: everything a buyer needs to get it right
// (size, color, notes, link), then the big "I got this".

type Props = {
  item: ItemRow | BuyerItem
  ownerName: string
  /** The viewer's own list: details only, no buttons, no status. */
  isOwn: boolean
  needsReview: boolean
  onClose: () => void
}

export default function ItemSheet({ item, ownerName, isOwn, needsReview, onClose }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const status = 'status' in item ? item.status : null
  const domain = linkDomain(item.link)
  const price = formatPrice(item.price)

  // Close on Escape, and stop the page behind from scrolling while it's open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = before
    }
  }, [onClose])

  async function run(action: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>) {
    setBusy(true)
    setMessage(null)
    const result = await action(item.id)
    setBusy(false)
    router.refresh()
    if (result.ok) onClose()
    else setMessage(result.message)
  }

  const facts = [
    item.size ? { label: 'Size', value: item.size } : null,
    item.color ? { label: 'Color', value: item.color } : null,
    price ? { label: 'Price', value: price } : null,
  ].filter((f): f is { label: string; value: string } => f !== null)

  const canClaim = !isOwn && !needsReview && status?.kind === 'open' && !status.mine
  const iHaveIt = status?.kind === 'mine' || (status?.kind === 'open' && status.mine)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#2B1F2C]/55" />

      <div className="relative mx-auto flex max-h-[90dvh] w-full max-w-md flex-col gap-[18px] overflow-y-auto rounded-t-[28px] bg-paper px-6 pt-2.5 pb-[max(34px,env(safe-area-inset-bottom))]">
        <span className="h-[5px] w-9 self-center rounded-full bg-line" />

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
            <span className="h-px w-5 bg-rose" />
            {isOwn ? 'Your list' : `For ${ownerName}`}
            {item.is_top_pick ? ' · Top pick' : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-full border border-line bg-white text-plum"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {item.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo_url} alt="" className="aspect-[4/3] w-full rounded-2xl border border-line bg-white object-contain" />
        )}

        <div className="flex flex-col gap-1.5">
          <h2 id="sheet-title" className="font-serif text-[32px] leading-tight text-plum">{item.name}</h2>
          {item.is_cash && <span className="text-[15px] text-muted">Cash · {item.cash_for || 'any amount'}</span>}
          {item.multi_ok && status?.kind === 'open' && (
            <span className="text-[14px] font-medium text-got">
              More than one is fine{status.boughtCount ? ` · ${status.boughtCount} bought so far` : ''}
            </span>
          )}
          {item.multi_ok && isOwn && <span className="text-[14px] text-muted">More than one is fine</span>}
        </div>

        {facts.length > 0 && (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}>
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-white p-3.5">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{f.label}</span>
                <span className="font-serif text-[22px] leading-tight text-plum break-words">{f.value}</span>
              </div>
            ))}
          </div>
        )}

        {item.notes && (
          <div className="flex flex-col gap-1.5 rounded-2xl bg-soft px-[18px] py-4">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{isOwn ? 'Your note' : `${ownerName}'s note`}</span>
            <span className="font-serif text-[18px] italic leading-snug text-ink">{item.notes}</span>
          </div>
        )}

        {item.link && domain && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-2.5 text-[15px] font-semibold text-plum"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />
            </svg>
            View at {domain}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        )}

        {!isOwn && (
          <div className="mt-2 flex flex-col gap-3">
            {message && <p className="text-center text-[15px] text-rose-text" aria-live="polite">{message}</p>}

            {canClaim && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(claimItem)}
                  className="flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-plum text-[17px] font-semibold text-paper shadow-[0_10px_24px_rgba(78,42,79,0.25)] disabled:opacity-60"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EBC3B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="8" width="18" height="13" rx="2" />
                    <path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S9 8 12 8zM12 8c2-4 6-4 6-1.5S15 8 12 8z" />
                  </svg>
                  {busy ? 'Saving…' : 'I got this'}
                </button>
                <span className="text-center text-[13px] text-muted">
                  Others will see &ldquo;Taken.&rdquo; {ownerName} won&apos;t see anything.
                </span>
              </>
            )}

            {iHaveIt && (
              <>
                <p className="flex items-center justify-center gap-2 text-[17px] font-semibold text-got">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12l5 5L20 6" />
                  </svg>
                  You got this
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(unclaimItem)}
                  className="h-[54px] rounded-full border border-plum text-[16px] font-semibold text-plum disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Undo, I didn’t get it'}
                </button>
              </>
            )}

            {status?.kind === 'taken' && (
              <p className="text-center text-[15px] text-muted">Someone already got this one.</p>
            )}
            {status?.kind === 'together' && (
              <p className="text-center text-[15px] text-muted">A group gift is being put together for this one.</p>
            )}
            {needsReview && status?.kind === 'open' && !status.mine && (
              <p className="text-center text-[15px] text-muted">
                {ownerName} needs to review this list before anything can be marked.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
