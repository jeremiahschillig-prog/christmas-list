'use client'

import { useEffect, useRef, useState } from 'react'

// The 4-digit keypad, used for signing in and for choosing a new PIN.
//
// Big round keys in the phone-dialer layout, because that's the keypad every
// grandparent already knows. It submits by itself on the fourth digit; there's no
// "OK" button to find. `onComplete` returns an error message to show (the dots
// shake and clear) or null when it's done.

type Props = {
  title: string
  subtitle: string
  onComplete: (pin: string) => Promise<string | null>
  /** Shown instead of the keypad's normal hint, e.g. while locked. */
  blockedMessage?: string | null
  /** A message to show when the pad first appears, e.g. "Those didn't match". */
  initialError?: string | null
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

export default function PinPad({ title, subtitle, onComplete, blockedMessage, initialError }: Props) {
  const [pin, setPinState] = useState('')
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const blocked = Boolean(blockedMessage)
  // While locked, the dots read empty. Four filled dots under "Too many tries"
  // looked like a PIN still waiting to be checked.
  const shown = blocked ? 0 : pin.length

  // The digits live in a ref as well as in state. Two quick taps can land before
  // React re-renders, and reading `pin` from state would then see the old value,
  // so the second digit overwrote the first and the pad never reached four
  // (found in testing: typing "0000" fast left one dot). The ref is always current.
  const pinRef = useRef('')
  const busyRef = useRef(false)
  function setPin(value: string) {
    pinRef.current = value
    setPinState(value)
  }

  async function press(key: string) {
    if (busyRef.current || blocked) return
    if (key === 'del') return setPin(pinRef.current.slice(0, -1))
    if (pinRef.current.length >= 4) return
    const next = pinRef.current + key
    setPin(next)
    setError(null)
    if (next.length < 4) return

    busyRef.current = true
    setBusy(true)
    const message = await onComplete(next)
    busyRef.current = false
    setBusy(false)
    if (message) {
      setError(message)
      setShake(true)
      setTimeout(() => setShake(false), 400)
      setPin('')
    }
  }

  // A computer keyboard works too, for the laptop.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-center font-serif text-[32px] leading-tight text-plum">{title}</h1>
      <p className="mt-2 text-center text-[15px] text-muted">{subtitle}</p>

      <div
        className={`mt-8 flex gap-4 ${shake ? 'animate-[shake_0.4s]' : ''}`}
        role="status"
        aria-label={`${shown} of 4 digits entered`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-[1.5px] border-plum ${i < shown ? 'bg-plum' : ''}`}
          />
        ))}
      </div>

      <p className="mt-5 min-h-[44px] max-w-[280px] text-center text-[15px] leading-snug" aria-live="polite">
        {blockedMessage ? (
          <span className="text-rose-text">{blockedMessage}</span>
        ) : error ? (
          <span className="text-rose-text">{error}</span>
        ) : busy ? (
          <span className="text-muted">Checking…</span>
        ) : null}
      </p>

      <div className={`mt-2 grid grid-cols-3 gap-x-6 gap-y-4 ${blocked ? 'opacity-40' : ''}`}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <span key={i} />
          ) : key === 'del' ? (
            <button
              key={i}
              type="button"
              onClick={() => press('del')}
              disabled={blocked || pin.length === 0}
              aria-label="Delete last digit"
              className="flex size-[76px] items-center justify-center rounded-full text-plum disabled:opacity-30"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1zM17 9l-5 6M12 9l5 6" />
              </svg>
            </button>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              disabled={blocked}
              className="flex size-[76px] items-center justify-center rounded-full border border-line bg-white font-serif text-[30px] text-plum shadow-[0_2px_8px_rgba(78,42,79,0.06)] active:bg-soft"
            >
              {key}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
