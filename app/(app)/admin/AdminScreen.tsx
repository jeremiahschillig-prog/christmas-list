'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addPerson, markAdminNotesRead, removePerson, resetPin, type PinResult } from '@/app/actions/admin'
import { startSeason, undoSeason, type SeasonResult } from '@/app/actions/season'
import { formatPrice } from '@/lib/format'
import type { AdminItem, AdminList, AdminNote, AdminPerson } from '@/lib/admin'
import type { SeasonInfo } from '@/lib/season'

type Props = {
  lists: AdminList[]
  notes: AdminNote[]
  people: AdminPerson[]
  meId: string
  season: SeasonInfo
  /** The Christmas whose purchases are shown; earlier than season.year = history. */
  viewingYear: number
}

const FIELD_NAMES: Record<string, string> = { name: 'Name', size: 'Size', color: 'Color', link: 'Link', cash_for: "What it's for" }

function changeText(c: AdminNote['changes'][number]): string {
  if (c.field === 'link') return c.to ? 'link changed' : 'link removed'
  return `${(FIELD_NAMES[c.field] ?? c.field).toLowerCase()} ${c.from ?? 'none'} → ${c.to ?? 'none'}`
}

function whoBought(item: AdminItem): string {
  if (item.split) {
    const people = item.split.members.map((m) => `${m.name} ${formatPrice(m.amount)}`).join(', ')
    const status = item.split.ordered ? `${item.split.purchaserName} ordered it` : `${item.split.purchaserName} will order it`
    return `Together: ${people} · ${status}`
  }
  return item.buyers.join(', ')
}

function lastSeen(iso: string | null): string {
  if (!iso) return 'Not signed in yet'
  return `Last here ${new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}

export default function AdminScreen({ lists, notes, people, meId, season, viewingYear }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'purchases' | 'people' | 'season'>('purchases')
  const [seasonConfirm, setSeasonConfirm] = useState<null | 'start' | 'undo'>(null)
  const [seasonMessage, setSeasonMessage] = useState<string | null>(null)
  const history = viewingYear !== season.year

  async function runSeason(action: () => Promise<SeasonResult>) {
    setBusy('season')
    setError(null)
    const result = await action()
    setBusy(null)
    setSeasonConfirm(null)
    if (!result.ok) return setError(result.error)
    setSeasonMessage(result.message)
    router.replace('/admin')
    router.refresh()
  }
  const [newIds] = useState(() => new Set(notes.filter((n) => n.unread).map((n) => n.id)))
  const [pinShown, setPinShown] = useState<{ name: string; pin: string; fresh: boolean } | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    if (newIds.size) markAdminNotesRead([...newIds])
  }, [newIds])

  async function withPin(key: string, action: () => Promise<PinResult>, fresh: boolean) {
    setBusy(key)
    setError(null)
    const result = await action()
    setBusy(null)
    if (!result.ok) return setError(result.error)
    setPinShown({ name: result.name, pin: result.pin, fresh })
    setNewName('')
    setConfirming(null)
    router.refresh()
  }

  async function remove(id: string) {
    setBusy(id)
    setError(null)
    const result = await removePerson(id)
    setBusy(null)
    setConfirming(null)
    if (!result.ok) return setError(result.error ?? 'That couldn’t be done.')
    router.refresh()
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-14">
      <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
        <span className="h-px w-6 bg-rose" />
        Admin
      </p>
      <h1 className="mt-1.5 font-serif text-[38px] leading-tight text-plum">Who bought what</h1>
      <p className="mt-1 text-[14px] leading-relaxed text-muted">
        For labeling gifts while you wrap. Your own list is never shown here.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-soft p-1" role="tablist">
        {(['purchases', 'people', 'season'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-full text-[15px] font-semibold ${tab === t ? 'bg-white text-plum shadow-sm' : 'text-muted'}`}
          >
            {t === 'purchases' ? 'Purchases' : t === 'people' ? 'People' : 'Season'}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-center text-[15px] text-rose-text" role="alert">
          {error}
        </p>
      )}

      {tab === 'purchases' && (
        <>
          {season.years.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Which Christmas">
              {[...season.years].reverse().map((y) => (
                <Link
                  key={y}
                  href={y === season.year ? '/admin' : `/admin?year=${y}`}
                  aria-current={y === viewingYear ? 'page' : undefined}
                  className={`min-h-11 content-center rounded-full px-4 text-[14px] font-semibold ${
                    y === viewingYear ? 'bg-plum text-paper' : 'border border-line bg-white text-plum'
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          )}
          {history && (
            <p className="mt-4 rounded-2xl bg-soft px-4 py-3 text-[14px] leading-relaxed text-ink">
              Looking back at Christmas {viewingYear}. Ideas nobody bought moved on to {viewingYear + 1}.
            </p>
          )}
          {!history && notes.length > 0 && (
            <section className="mt-6" aria-labelledby="alerts">
              <h2 id="alerts" className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
                Changed after buying
                <span className="h-px flex-1 bg-line" />
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {notes.slice(0, 10).map((n) => (
                  <li
                    key={n.id}
                    className={`flex gap-3 rounded-2xl px-4 py-3 text-[14px] leading-snug ${newIds.has(n.id) ? 'border border-rose bg-white' : 'bg-soft'}`}
                  >
                    <span className="flex-1 text-ink">
                      {n.kind === 'item_removed'
                        ? `${n.actorName} removed ${n.itemName} from ${n.ownerName}'s list.`
                        : `${n.actorName} changed ${n.itemName} on ${n.ownerName}'s list: ${n.changes.map(changeText).join(', ')}.`}
                      {n.buyers.length > 0 && <span className="text-muted"> Bought by {n.buyers.join(', ')}.</span>}
                    </span>
                    {newIds.has(n.id) && <span className="shrink-0 text-[12px] font-semibold text-rose-text">New</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lists.map((list) => (
            <section key={list.ownerId} className="mt-7" aria-labelledby={`l-${list.ownerId}`}>
              <h2 id={`l-${list.ownerId}`} className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full border border-rose font-serif text-[16px] text-plum">
                  {list.ownerName[0]}
                </span>
                <span className="flex-1 font-serif text-[22px] text-plum">{list.ownerName}</span>
                <span className="text-[13px] text-muted">
                  {list.bought.length} bought · {list.notBought.length} open
                </span>
              </h2>

              {list.bought.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-soft px-4 py-3 text-[14px] text-muted">{history ? 'Nothing was bought.' : 'Nothing bought yet.'}</p>
              ) : (
                <ul className="mt-3 overflow-hidden rounded-[18px] border border-line bg-white">
                  {list.bought.map((item, i) => (
                    <li key={item.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                      {item.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photoUrl} alt="" className="size-12 shrink-0 rounded-lg border border-line object-cover" />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[16px] font-medium text-ink">
                          {item.name}
                          {item.removed && <span className="ml-1.5 text-[12px] font-semibold text-rose-text">removed from list</span>}
                        </span>
                        {item.detail && <span className="text-[13px] text-muted">{item.detail}</span>}
                        <span className="text-[14px] font-semibold text-plum">{whoBought(item)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {list.notBought.length > 0 && (
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer content-center text-[14px] font-semibold text-plum">
                    {list.notBought.length} not bought yet
                  </summary>
                  <ul className="flex flex-col gap-1 pb-1 pl-1 text-[14px] text-muted">
                    {list.notBought.map((item) => (
                      <li key={item.id}>{item.name}</li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          ))}
        </>
      )}

      {tab === 'people' && (
        <>
          {pinShown && (
            <div className="mt-5 flex flex-col items-center gap-2 rounded-[20px] bg-plum px-5 py-5 text-center text-paper" role="status">
              <span className="text-[14px] text-paper/85">
                {pinShown.fresh ? `${pinShown.name} is added. Their starter PIN is` : `${pinShown.name}'s new starter PIN is`}
              </span>
              <span className="font-serif text-[44px] tracking-[0.25em]">{pinShown.pin}</span>
              <span className="text-[13px] leading-snug text-paper/85">
                Tell them in person or by text. It won&apos;t be shown again. They can choose their own when they sign in.
              </span>
              <button type="button" onClick={() => setPinShown(null)} className="mt-1 min-h-11 text-[14px] font-semibold text-rose-light underline underline-offset-4">
                Done
              </button>
            </div>
          )}

          <form
            className="mt-5 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              withPin('add', () => addPerson(newName), true)
            }}
          >
            <label htmlFor="new-person" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
              Add a family member
            </label>
            <div className="flex gap-2">
              <input
                id="new-person"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Grandma Sue"
                className="h-12 flex-1 rounded-xl border border-line bg-white px-3.5 text-[16px] outline-none focus:border-plum"
              />
              <button
                type="submit"
                disabled={busy !== null || !newName.trim()}
                className="h-12 rounded-full bg-plum px-5 text-[15px] font-semibold text-paper disabled:opacity-50"
              >
                {busy === 'add' ? 'Adding…' : 'Add'}
              </button>
            </div>
            <span className="text-[13px] text-muted">They&apos;ll be able to buy from every list. They won&apos;t have a list of their own.</span>
          </form>

          <ul className="mt-6 overflow-hidden rounded-[18px] border border-line bg-white">
            {people.map((p, i) => (
              <li key={p.id} className={`flex flex-col gap-2 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rose font-serif text-[16px] text-plum">
                    {p.name[0]}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[16px] font-medium text-ink">
                      {p.name}
                      {p.id === meId && <span className="text-muted"> (you)</span>}
                    </span>
                    <span className="text-[12px] text-muted">
                      {p.role} · {lastSeen(p.lastSeen)}
                      {p.hasStarterPin ? ' · starter PIN' : ''}
                    </span>
                  </span>
                </div>
                {confirming === p.id ? (
                  <div className="flex flex-col gap-2 rounded-xl bg-soft p-3">
                    <p className="text-[14px] text-ink">
                      Remove {p.name}?{' '}
                      {p.giftCount > 0
                        ? `The ${p.giftCount} ${p.giftCount === 1 ? 'gift' : 'gifts'} they marked will go back to open.`
                        : 'They haven’t marked any gifts.'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setConfirming(null)} className="min-h-11 rounded-full border border-plum text-[14px] font-semibold text-plum">
                        Keep
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => remove(p.id)}
                        className="min-h-11 rounded-full bg-rose-text text-[14px] font-semibold text-white disabled:opacity-50"
                      >
                        {busy === p.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ) : p.id === meId ? null : (
                  <div className="flex gap-5 pl-12">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => withPin(p.id, () => resetPin(p.id), false)}
                      className="min-h-11 text-[14px] font-semibold text-plum underline underline-offset-4 disabled:opacity-50"
                    >
                      {busy === p.id ? 'Resetting…' : 'Reset PIN'}
                    </button>
                    {!p.isOwner && (
                      <button
                        type="button"
                        onClick={() => setConfirming(p.id)}
                        className="min-h-11 text-[14px] text-rose-text underline underline-offset-4"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Resetting a PIN signs that person out on every phone and clears any wait from wrong guesses.
          </p>
        </>
      )}

      {tab === 'season' && (
        <section className="mt-6 flex flex-col gap-4" aria-label="Season">
          {seasonMessage && (
            <p role="status" className="rounded-2xl border border-rose bg-white px-4 py-3 text-[15px] leading-relaxed text-ink">
              {seasonMessage}
            </p>
          )}

          <div className="rounded-[20px] border border-line bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">This season</p>
            <p className="mt-1 font-serif text-[30px] text-plum">Christmas {season.year}</p>
          </div>

          <div className="flex flex-col gap-3 rounded-[20px] bg-soft p-5">
            <p className="font-serif text-[22px] leading-snug text-plum">Ready for Christmas {season.year + 1}?</p>
            <p className="text-[14px] leading-relaxed text-ink">Starting next Christmas:</p>
            <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-ink">
              <li>
                · <strong>{season.preview.carry + season.preview.copy}</strong> {season.preview.carry + season.preview.copy === 1 ? 'idea' : 'ideas'} nobody bought come forward, tagged &ldquo;From last year&rdquo;
                {season.preview.copy > 0 && ` (${season.preview.copy} of them "more than one is fine" ideas starting fresh)`}.
              </li>
              <li>
                · <strong>{season.preview.history}</strong> bought {season.preview.history === 1 ? 'idea stays' : 'ideas stay'} in {season.year}&apos;s history.
              </li>
              <li>· Every list with carried-over ideas stays closed to buyers until its owner taps &ldquo;My list is up to date&rdquo;.</li>
            </ul>
            {seasonConfirm === 'start' ? (
              <div className="flex flex-col gap-2">
                <p className="text-[15px] font-semibold text-ink">
                  Start Christmas {season.year + 1} now? Everyone will see the new season straight away.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSeasonConfirm(null)} className="min-h-12 rounded-full border border-plum text-[15px] font-semibold text-plum">
                    Not yet
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => runSeason(startSeason)}
                    className="min-h-12 rounded-full bg-plum text-[15px] font-semibold text-paper disabled:opacity-50"
                  >
                    {busy === 'season' ? 'Starting…' : 'Start it'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSeasonConfirm('start')}
                className="h-[54px] rounded-full bg-plum text-[16px] font-semibold text-paper"
              >
                Start Christmas {season.year + 1}
              </button>
            )}
          </div>

          {season.canUndo && (
            <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-white p-5">
              <p className="text-[14px] leading-relaxed text-ink">
                Started Christmas {season.year} by mistake? Nothing has been added or marked in it yet, so it can be undone.
              </p>
              {seasonConfirm === 'undo' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSeasonConfirm(null)} className="min-h-12 rounded-full border border-plum text-[15px] font-semibold text-plum">
                    Keep it
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => runSeason(undoSeason)}
                    className="min-h-12 rounded-full bg-rose-text text-[15px] font-semibold text-white disabled:opacity-50"
                  >
                    {busy === 'season' ? 'Undoing…' : `Undo ${season.year}`}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSeasonConfirm('undo')}
                  className="min-h-11 self-start text-[15px] font-semibold text-rose-text underline underline-offset-4"
                >
                  Undo starting {season.year}
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  )
}
