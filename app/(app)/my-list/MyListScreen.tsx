'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markReviewed } from '@/app/actions/season'
import ItemEditor from '@/components/ItemEditor'
import { detailLine } from '@/lib/format'
import type { Editable, ItemForEdit } from '@/lib/mylist'

type Props = {
  lists: Editable[]
  ownerId: string
  ownerName: string
  isMe: boolean
  items: ItemForEdit[]
  review: { year: number; needsReview: boolean; carried: boolean }
}

export default function MyListScreen({ lists, ownerId, ownerName, isMe, items, review }: Props) {
  const router = useRouter()
  // null = closed, 'new' = adding, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)

  async function upToDate() {
    setReviewing(true)
    const { ok } = await markReviewed(ownerId)
    setReviewing(false)
    if (ok) {
      setToast(`Thanks! ${isMe ? 'Your' : `${ownerName}'s`} list is open for ${review.year} shopping.`)
      router.refresh()
    }
  }
  const current = items.find((i) => i.id === editing) ?? null

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-14">
      <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
        <span className="h-px w-6 bg-rose" />
        My List
      </p>
      <h1 className="mt-1.5 font-serif text-[38px] leading-tight text-plum">{isMe ? 'Your List' : `${ownerName}'s List`}</h1>

      {lists.length > 1 && (
        <div className="mt-4 flex gap-2" role="tablist" aria-label="Whose list to edit">
          {lists.map((l) => (
            <Link
              key={l.id}
              href={l.isMe ? '/my-list' : `/my-list?for=${l.id}`}
              role="tab"
              aria-selected={l.id === ownerId}
              className={`min-h-11 rounded-full px-4 py-2.5 text-[14px] font-semibold ${
                l.id === ownerId ? 'bg-plum text-paper' : 'border border-line bg-white text-plum'
              }`}
            >
              {l.isMe ? 'Mine' : l.name}
            </Link>
          ))}
        </div>
      )}

      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        {isMe
          ? "Add the things you'd love. You'll never see what's been bought, so it stays a surprise."
          : `You're editing ${ownerName}'s list. Purchases aren't shown here.`}
      </p>

      {review.needsReview && (
        <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-rose bg-white p-[18px]" role="region" aria-label="Review this list">
          <p className="font-serif text-[20px] leading-snug text-plum">Is this list still right for {review.year}?</p>
          <p className="text-[14px] leading-relaxed text-ink">
            The ideas marked &ldquo;From last year&rdquo; came forward from {review.year - 1}. Update sizes and links, remove anything
            {isMe ? " you don't want" : ` ${ownerName} doesn't want`} any more, then tap below. Until then, nobody can mark
            anything on {isMe ? 'your' : 'this'} list.
          </p>
          <button
            type="button"
            disabled={reviewing}
            onClick={upToDate}
            className="h-[54px] rounded-full bg-plum text-[16px] font-semibold text-paper disabled:opacity-60"
          >
            {reviewing ? 'Saving…' : isMe ? 'My list is up to date' : `${ownerName}'s list is up to date`}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditing('new')}
        className="mt-5 flex h-[58px] w-full items-center justify-center gap-2 rounded-full bg-plum text-[17px] font-semibold text-paper shadow-[0_10px_24px_rgba(78,42,79,0.25)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add an idea
      </button>

      {toast && (
        <p role="status" className="mt-4 rounded-2xl bg-soft px-4 py-3 text-[14px] leading-relaxed text-ink">
          {toast}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-10 text-center text-[15px] text-muted">Nothing here yet. Tap &ldquo;Add an idea&rdquo; to start.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-2.5">
          {items.map((item) => {
            const tag = [item.is_top_pick ? 'Top pick' : null, item.is_cash ? 'Cash' : null, item.carried_from_year ? 'From last year' : null].filter(Boolean).join(' · ')
            const sub = item.is_cash ? item.cash_for || 'Cash gift' : detailLine(item)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setEditing(item.id)}
                className="flex items-center gap-3.5 rounded-[18px] border border-line bg-white px-4 py-3.5 text-left"
              >
                {item.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photo_url} alt="" loading="lazy" decoding="async" className="size-14 shrink-0 rounded-xl border border-line object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-soft text-rose" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="8" width="18" height="13" rx="2" />
                      <path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S9 8 12 8zM12 8c2-4 6-4 6-1.5S15 8 12 8z" />
                    </svg>
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {tag && <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-text">{tag}</span>}
                  <span className="truncate font-serif text-[19px] text-plum">{item.name}</span>
                  {sub && <span className="truncate text-[13px] text-muted">{sub}</span>}
                </span>
                <span className="shrink-0 text-[14px] font-semibold text-plum">Edit</span>
              </button>
            )
          })}
        </div>
      )}

      {editing && (
        <ItemEditor
          key={editing}
          ownerId={ownerId}
          ownerName={isMe ? null : ownerName}
          item={editing === 'new' ? null : current}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            if (message) setToast(message)
          }}
        />
      )}
    </main>
  )
}
