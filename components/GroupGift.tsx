'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { joinSplit, leaveSplit, setOrdered, startSplit, takeOrdering, type SplitResult } from '@/app/actions/splits'
import { formatPrice } from '@/lib/format'
import type { Status } from '@/lib/listview'
import type { SplitInfo } from '@/lib/splits'

// Going in together, inside the item sheet. Never shown on your own list:
// the sheet only renders this for someone else's item.

type Props = {
  itemId: string
  viewerId: string
  status: Status
  needsReview: boolean
}

const FIELD =
  'flex h-[54px] items-center gap-2 rounded-2xl border border-line bg-white px-4 focus-within:border-plum'

function Amount({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={FIELD}>
      <span className="font-serif text-[22px] text-plum">$</span>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent font-serif text-[22px] text-plum outline-none"
      />
    </div>
  )
}

function Panel({ split, viewerId }: { split: SplitInfo; viewerId: string }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-white p-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-serif text-[20px] text-plum">Going in together</span>
        <span className="text-[14px] font-semibold text-rose-text">
          {split.ordered
            ? 'Ordered'
            : split.remaining === null
              ? `${formatPrice(split.pledged)} so far`
              : split.remaining === 0
                ? 'Fully covered'
                : `${formatPrice(split.remaining)} to go`}
        </span>
      </div>
      {split.percent !== null && (
        <div className="h-2 rounded-full bg-soft" role="img" aria-label={`${split.percent}% covered`}>
          <div className="h-2 rounded-full bg-plum" style={{ width: `${split.percent}%` }} />
        </div>
      )}
      <ul className="flex flex-col gap-2.5">
        {split.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-rose font-serif text-[15px] text-plum">
              {m.name[0]}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold text-ink">{m.id === viewerId ? 'You' : m.name}</span>
              {m.id === split.purchaserId && (
                <span className="text-[12px] text-muted">{split.ordered ? 'Ordered it' : 'Will order it'}</span>
              )}
            </span>
            <span className="text-[15px] font-semibold text-ink">{formatPrice(m.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function GroupGift({ itemId, viewerId, status, needsReview }: Props) {
  const router = useRouter()
  const [opening, setOpening] = useState(false)
  const [changing, setChanging] = useState(false)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run(action: () => Promise<SplitResult>) {
    setBusy(true)
    setMessage(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) return setMessage(result.message)
    setOpening(false)
    setChanging(false)
    setAmount('')
    router.refresh()
  }

  const amountText = formatPrice(amount.replace(/[$,\s]/g, '')) ?? ''
  const error = message && (
    <p className="text-center text-[15px] text-rose-text" role="alert">
      {message}
    </p>
  )
  const primary =
    'flex h-[58px] items-center justify-center rounded-full bg-plum text-[17px] font-semibold text-paper shadow-[0_10px_24px_rgba(78,42,79,0.25)] disabled:opacity-50'
  const secondary = 'h-[54px] rounded-full border border-plum text-[16px] font-semibold text-plum disabled:opacity-50'
  const quiet = 'min-h-11 self-center text-[15px] font-semibold text-plum underline underline-offset-4 disabled:opacity-50'

  // ---- An open item: offer to start one ----
  if (status.kind === 'open') {
    if (needsReview || status.mine || status.boughtCount > 0) return null
    if (!opening) {
      return (
        <button type="button" className={quiet} onClick={() => setOpening(true)}>
          Go in together with others instead
        </button>
      )
    }
    return (
      <div className="flex flex-col gap-3 rounded-[20px] bg-soft p-4">
        <label htmlFor="start-amount" className="text-[15px] leading-snug text-ink">
          How much would you put in? Others can add the rest, and you&apos;ll be the one who orders it.
        </label>
        <Amount id="start-amount" value={amount} onChange={setAmount} />
        {error}
        <button type="button" disabled={busy || !amountText} className={primary} onClick={() => run(() => startSplit(itemId, amount))}>
          {busy ? 'Saving…' : amountText ? `Start a group gift with ${amountText}` : 'Start a group gift'}
        </button>
        <button type="button" className={quiet} onClick={() => setOpening(false)}>
          Never mind
        </button>
      </div>
    )
  }

  // ---- A group gift is forming ----
  if (status.kind === 'together') {
    const { split } = status
    const iAmPurchaser = split.purchaserId === viewerId

    if (!status.member) {
      return (
        <div className="flex flex-col gap-3">
          <Panel split={split} viewerId={viewerId} />
          <label htmlFor="join-amount" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
            How much would you put in?
          </label>
          <Amount id="join-amount" value={amount} onChange={setAmount} />
          {error}
          <button type="button" disabled={busy || !amountText} className={primary} onClick={() => run(() => joinSplit(itemId, amount))}>
            {busy ? 'Saving…' : amountText ? `Join in for ${amountText}` : 'Join in'}
          </button>
          <span className="text-center text-[13px] leading-snug text-muted">
            You can take your name off any time before it&apos;s ordered. {split.purchaserName} gets a note when you join.
          </span>
        </div>
      )
    }

    const mine = split.members.find((m) => m.id === viewerId)
    return (
      <div className="flex flex-col gap-3">
        <Panel split={split} viewerId={viewerId} />
        {error}
        {iAmPurchaser ? (
          <>
            <button type="button" disabled={busy} className={primary} onClick={() => run(() => setOrdered(itemId, true))}>
              {busy ? 'Saving…' : 'I ordered it'}
            </button>
            <span className="text-center text-[13px] leading-snug text-muted">
              You&apos;re ordering this one. Settle up with the others yourselves. Once it&apos;s ordered, everyone else sees &ldquo;Taken.&rdquo;
            </span>
          </>
        ) : (
          <>
            <p className="text-center text-[15px] text-ink">{split.purchaserName} is ordering it.</p>
            <button type="button" disabled={busy} className={secondary} onClick={() => run(() => takeOrdering(itemId))}>
              I&apos;ll order it instead
            </button>
          </>
        )}
        {changing ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-soft p-4">
            <label htmlFor="change-amount" className="text-[15px] text-ink">
              Your share (now {formatPrice(mine?.amount ?? 0)})
            </label>
            <Amount id="change-amount" value={amount} onChange={setAmount} />
            <button type="button" disabled={busy || !amountText} className={secondary} onClick={() => run(() => joinSplit(itemId, amount))}>
              {amountText ? `Change to ${amountText}` : 'Change my share'}
            </button>
          </div>
        ) : (
          <button type="button" className={quiet} onClick={() => setChanging(true)}>
            Change my share
          </button>
        )}
        <button type="button" disabled={busy} className={`${quiet} text-rose-text`} onClick={() => run(() => leaveSplit(itemId))}>
          Take my name off
        </button>
      </div>
    )
  }

  // ---- Ordered, and you're in it ----
  if (status.kind === 'mine' && status.split) {
    const { split } = status
    return (
      <div className="flex flex-col gap-3">
        <Panel split={split} viewerId={viewerId} />
        {error}
        {split.purchaserId === viewerId && (
          <button type="button" disabled={busy} className={quiet} onClick={() => run(() => setOrdered(itemId, false))}>
            Not ordered yet after all
          </button>
        )}
      </div>
    )
  }

  return null
}
