'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markGiftNotesRead } from '@/app/actions/gifts'
import { unclaimItem } from '@/app/actions/items'
import { formatPrice } from '@/lib/format'
import type { Change, Gift, Note } from '@/lib/mygifts'

type Props = {
  groups: { ownerName: string; ownerId: string; gifts: Gift[] }[]
  notes: Note[]
  count: number
  viewerId: string
}

const FIELD_NAMES: Record<string, string> = { name: 'Name', size: 'Size', color: 'Color', link: 'Link', cash_for: "What it's for" }

function changeLine(c: Change): string {
  if (c.field === 'link') return c.to ? 'Link changed' : 'Link removed'
  return `${FIELD_NAMES[c.field] ?? c.field}: ${c.from ?? 'none'} → ${c.to ?? 'none'}`
}

function noteText(n: Note, viewerId: string): string {
  const d = n.details
  switch (n.kind) {
    case 'item_changed': {
      const changes = (d.changes as Change[] | undefined) ?? []
      return `${n.actorName} changed ${n.itemName}: ${changes.map(changeLine).join(', ')}`
    }
    case 'item_removed':
      return `${n.actorName} removed ${n.itemName} from the list. You'd already said you'd get it.`
    case 'split_joined':
      return `${n.actorName} joined the group gift for ${n.itemName}${d.amount ? ` with ${d.amount}` : ''}.`
    case 'split_left':
      return `${n.actorName} left the group gift for ${n.itemName}.${d.newPurchaser === viewerId ? " You're ordering it now." : ''}`
    case 'split_purchaser':
      return `${n.actorName} will order ${n.itemName} now.`
  }
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function MyGiftsScreen({ groups, notes, count, viewerId }: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  // Remember which notes were new when the page opened, so they stay marked
  // "New" while you read them even after they're saved as read.
  const [newIds] = useState(() => new Set(notes.filter((n) => n.unread).map((n) => n.id)))

  useEffect(() => {
    if (newIds.size) markGiftNotesRead([...newIds])
  }, [newIds])

  async function undo(itemId: string) {
    setBusyId(itemId)
    await unclaimItem(itemId)
    setBusyId(null)
    router.refresh()
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-14">
      <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
        <span className="h-px w-6 bg-rose" />
        My Gifts
      </p>
      <h1 className="mt-1.5 font-serif text-[38px] leading-tight text-plum">Your shopping</h1>
      <p className="mt-1 text-[15px] text-muted">
        {count === 0 ? "You haven't picked anything yet." : `${count} ${count === 1 ? 'gift' : 'gifts'} across the family's lists`}
      </p>

      {notes.length > 0 && (
        <section className="mt-6" aria-labelledby="updates">
          <h2 id="updates" className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
            Updates
            <span className="h-px flex-1 bg-line" />
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {notes.slice(0, 8).map((n) => (
              <li
                key={n.id}
                className={`flex gap-3 rounded-2xl px-4 py-3 text-[14px] leading-snug ${newIds.has(n.id) ? 'border border-rose bg-white' : 'bg-soft'}`}
              >
                <span className="flex-1 text-ink">{noteText(n, viewerId)}</span>
                <span className="shrink-0 text-[12px] text-muted">
                  {newIds.has(n.id) ? <span className="font-semibold text-rose-text">New</span> : when(n.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {count === 0 && (
        <Link
          href="/"
          className="mt-8 flex h-[58px] items-center justify-center rounded-full bg-plum text-[17px] font-semibold text-paper"
        >
          Browse the lists
        </Link>
      )}

      {groups.map((group) => (
        <section key={group.ownerId} className="mt-7" aria-labelledby={`for-${group.ownerId}`}>
          <h2 id={`for-${group.ownerId}`} className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full border border-rose font-serif text-[16px] text-plum">
              {group.ownerName[0]}
            </span>
            <span className="font-serif text-[22px] text-plum">For {group.ownerName}</span>
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {group.gifts.map((g) => (
              <li key={g.itemId} className="flex flex-col gap-2 rounded-[18px] border border-line bg-white px-4 py-3.5">
                <div className="flex items-center gap-3.5">
                  {g.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.photoUrl} alt="" loading="lazy" decoding="async" className="size-14 shrink-0 rounded-xl border border-line object-cover" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`font-serif text-[19px] text-plum ${g.removedBy ? 'line-through decoration-1' : ''}`}>{g.name}</span>
                    {g.detail && <span className="text-[13px] text-muted">{g.detail}</span>}
                    {g.split ? (
                      <span className="text-[13px] font-semibold text-got">
                        Going in together · your share {formatPrice(g.split.members.find((m) => m.id === viewerId)?.amount ?? 0)} ·{' '}
                        {g.split.purchaserId === viewerId
                          ? g.split.ordered ? 'you ordered it' : "you're ordering it"
                          : g.split.ordered ? `${g.split.purchaserName} ordered it` : `${g.split.purchaserName} is ordering it`}
                      </span>
                    ) : (
                      <span className="text-[13px] font-semibold text-got">You got this</span>
                    )}
                  </div>
                </div>

                {g.removedBy && (
                  <p className="rounded-xl bg-soft px-3 py-2 text-[13px] leading-snug text-rose-text">
                    Removed by {g.removedBy}: you already said you&apos;d get this. Keep it, or swap it for another idea.
                  </p>
                )}
                {!g.removedBy && g.changes.length > 0 && (
                  <div className="rounded-xl bg-soft px-3 py-2 text-[13px] leading-snug text-rose-text">
                    <span className="font-semibold">Changed after you picked it.</span>{' '}
                    {g.changes.map(changeLine).join(' · ')}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {!g.removedBy && (
                    <Link href={`/list/${g.ownerId}`} className="min-h-11 content-center text-[14px] font-semibold text-plum underline underline-offset-4">
                      See on {g.ownerName}&apos;s list
                    </Link>
                  )}
                  {g.link && !g.removedBy && (
                    <a href={g.link} target="_blank" rel="noopener noreferrer" className="min-h-11 content-center text-[14px] font-semibold text-plum underline underline-offset-4">
                      Store link
                    </a>
                  )}
                  {g.kind === 'bought' && (
                    <button
                      type="button"
                      onClick={() => undo(g.itemId)}
                      disabled={busyId === g.itemId}
                      className="ml-auto min-h-11 text-[14px] text-muted underline underline-offset-4 disabled:opacity-50"
                    >
                      {g.removedBy ? 'Remove from my gifts' : 'Undo'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
