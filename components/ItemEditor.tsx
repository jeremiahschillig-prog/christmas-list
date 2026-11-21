'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addItem, deleteItem, removePhoto, replacePhoto, suggestFromLink, updateItem } from '@/app/actions/mylist'
import type { ItemInput } from '@/lib/itemform'
import type { ItemForEdit } from '@/lib/mylist'
import { shrinkImage } from '@/lib/shrink'

// Add or edit one idea, in a sheet that slides up over My List.

type Props = {
  ownerId: string
  /** Set when a parent is editing a child's list; null on your own. */
  ownerName: string | null
  item: ItemForEdit | null
  onClose: () => void
  onSaved: (message: string | null) => void
}

function toInput(item: ItemForEdit | null): ItemInput {
  return {
    name: item?.name ?? '',
    link: item?.link ?? '',
    size: item?.size ?? '',
    color: item?.color ?? '',
    notes: item?.notes ?? '',
    price: item?.price != null ? String(Number(item.price)) : '',
    is_top_pick: item?.is_top_pick ?? false,
    is_cash: item?.is_cash ?? false,
    cash_for: item?.cash_for ?? '',
    multi_ok: item?.multi_ok ?? false,
  }
}

const FIELD = 'h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[16px] text-ink outline-none focus:border-plum'
const LABEL = 'text-[12px] font-semibold uppercase tracking-[0.12em] text-muted'

function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left"
    >
      <span className="flex flex-1 flex-col">
        <span className="text-[16px] font-medium text-ink">{label}</span>
        <span className="text-[13px] text-muted">{help}</span>
      </span>
      <span className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? 'bg-plum' : 'bg-line'}`}>
        <span
          className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow transition-[left] ${checked ? 'left-[22px]' : 'left-[2px]'}`}
        />
      </span>
    </button>
  )
}

export default function ItemEditor({ ownerId, ownerName, item, onClose, onSaved }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<ItemInput>(() => toInput(item))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'save' | 'delete' | 'photo' | 'lookup'>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(item?.photo_url ?? null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isNew = item === null
  const whose = ownerName ? `${ownerName}'s list` : 'your list'

  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) => setForm((f) => ({ ...f, [key]: value }))

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

  // Paste a link, and the store's own product name and price fill in, unless
  // they've been typed already.
  async function lookUpName() {
    if (!form.link.trim() || (form.name.trim() && (form.price.trim() || form.is_cash))) return
    setBusy('lookup')
    const { title, price } = await suggestFromLink(form.link)
    setBusy(null)
    setForm((f) => ({
      ...f,
      name: f.name.trim() || !title ? f.name : title,
      price: f.price.trim() || f.is_cash || price === null ? f.price : String(price),
    }))
  }

  async function save() {
    setBusy('save')
    setError(null)
    const result = isNew ? await addItem(ownerId, form) : await updateItem(item.id, form)
    setBusy(null)
    if (!result.ok) return setError(result.error)
    router.refresh()
    onSaved(
      result.photoFound === false
        ? "Saved. That store didn't share a photo. Open the idea and tap “Add a photo” to choose one."
        : isNew ? `Added to ${whose}.` : null,
    )
  }

  async function remove() {
    setBusy('delete')
    await deleteItem(item!.id)
    setBusy(null)
    router.refresh()
    onSaved(`Removed from ${whose}.`)
  }

  async function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !item) return
    setBusy('photo')
    setError(null)
    try {
      const small = await shrinkImage(file)
      const data = new FormData()
      data.set('photo', small)
      const result = await replacePhoto(item.id, data)
      if (!result.ok) setError(result.error ?? "That photo couldn't be saved.")
      else {
        setPhotoUrl(URL.createObjectURL(small))
        router.refresh()
      }
    } catch {
      setError("That photo couldn't be read. Try a different one.")
    }
    setBusy(null)
  }

  async function dropPhoto() {
    if (!item) return
    setBusy('photo')
    await removePhoto(item.id)
    setPhotoUrl(null)
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#2B1F2C]/55" />

      <div className="relative mx-auto flex max-h-[94dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-[28px] bg-paper px-5 pt-2.5 pb-[max(28px,env(safe-area-inset-bottom))]">
        <span className="h-[5px] w-9 self-center rounded-full bg-line" />
        <div className="mt-3 flex items-center justify-between">
          <h2 id="editor-title" className="font-serif text-[28px] text-plum">{isNew ? 'Add an idea' : 'Edit idea'}</h2>
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

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-soft p-1" role="radiogroup" aria-label="Kind of idea">
          {[
            { cash: false, label: 'Something to buy' },
            { cash: true, label: 'Cash' },
          ].map((k) => (
            <button
              key={k.label}
              type="button"
              role="radio"
              aria-checked={form.is_cash === k.cash}
              onClick={() => set('is_cash', k.cash)}
              className={`min-h-11 rounded-full text-[15px] font-semibold ${form.is_cash === k.cash ? 'bg-white text-plum shadow-sm' : 'text-muted'}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {!form.is_cash && (
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Link</span>
              <input
                className={FIELD}
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="Paste the store link"
                value={form.link}
                onChange={(e) => set('link', e.target.value)}
                onBlur={lookUpName}
              />
              {busy === 'lookup' && <span className="text-[13px] text-muted">Looking up the link…</span>}
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Name</span>
            <input
              className={FIELD}
              placeholder={form.is_cash ? 'e.g. Concert ticket money' : 'e.g. Lululemon shorts'}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </label>

          {form.is_cash ? (
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>What it&apos;s for</span>
              <input className={FIELD} placeholder="e.g. For the March concert" value={form.cash_for} onChange={(e) => set('cash_for', e.target.value)} />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Size</span>
                <input className={FIELD} value={form.size} onChange={(e) => set('size', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Color</span>
                <input className={FIELD} value={form.color} onChange={(e) => set('color', e.target.value)} />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>{form.is_cash ? 'Amount (optional)' : 'Price (optional)'}</span>
            <input className={FIELD} inputMode="decimal" placeholder="$" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Notes</span>
            <textarea
              className={`${FIELD} h-24 resize-none py-3`}
              placeholder="Anything that helps, e.g. any brand is fine"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>

          <Toggle label="Top pick" help="Shown first on the list" checked={form.is_top_pick} onChange={(v) => set('is_top_pick', v)} />
          <Toggle
            label="More than one is fine"
            help="Stays open after someone buys one"
            checked={form.multi_ok}
            onChange={(v) => set('multi_ok', v)}
          />

          {!form.is_cash && (
            <div className="flex flex-col gap-2">
              <span className={LABEL}>Photo</span>
              {isNew ? (
                <p className="text-[14px] leading-relaxed text-muted">
                  The photo comes from the link when you save. You can change it afterwards.
                </p>
              ) : (
                <div className="flex items-center gap-3.5">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt="" className="size-20 rounded-xl border border-line bg-white object-cover" />
                  ) : (
                    <span className="flex size-20 items-center justify-center rounded-xl bg-soft text-[12px] text-muted">No photo</span>
                  )}
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => fileRef.current?.click()}
                      className="min-h-11 text-[15px] font-semibold text-plum underline underline-offset-4 disabled:opacity-50"
                    >
                      {busy === 'photo' ? 'Saving photo…' : photoUrl ? 'Replace photo' : 'Add a photo'}
                    </button>
                    {photoUrl && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={dropPhoto}
                        className="min-h-11 text-[14px] text-muted underline underline-offset-4 disabled:opacity-50"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChosen} />
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-center text-[15px] text-rose-text" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy !== null}
            className="mt-1 h-[58px] rounded-full bg-plum text-[17px] font-semibold text-paper shadow-[0_10px_24px_rgba(78,42,79,0.25)] disabled:opacity-60"
          >
            {busy === 'save' ? 'Saving…' : isNew ? `Add to ${whose}` : 'Save changes'}
          </button>
        </form>

        {!isNew &&
          (confirmDelete ? (
            <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-soft p-4">
              <p className="text-center text-[15px] text-ink">Remove &ldquo;{item.name}&rdquo; from {whose}?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-11 rounded-full border border-plum text-[15px] font-semibold text-plum"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={remove}
                  className="min-h-11 rounded-full bg-rose-text text-[15px] font-semibold text-white disabled:opacity-60"
                >
                  {busy === 'delete' ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="mt-4 min-h-11 self-center text-[15px] font-semibold text-rose-text underline underline-offset-4"
            >
              Remove this idea
            </button>
          ))}
      </div>
    </div>
  )
}
