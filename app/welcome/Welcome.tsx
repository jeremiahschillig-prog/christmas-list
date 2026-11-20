'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PinPad from '@/components/PinPad'
import { choosePin, signOut } from '@/app/actions/auth'

type Stage = 'ask' | 'enter' | 'confirm' | 'done'

export default function Welcome({ name }: { name: string }) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('ask')
  const [first, setFirst] = useState('')
  const [busy, setBusy] = useState(false)
  // Carried into the fresh "enter" pad after a mismatch. The confirm pad's own
  // error would be lost, because that pad is gone by the time it could show it.
  const [mismatch, setMismatch] = useState<string | null>(null)

  function goHome() {
    router.replace('/')
    router.refresh()
  }

  if (stage === 'enter' || stage === 'confirm') {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col px-5 pt-12 pb-10">
        <button
          type="button"
          onClick={() => {
            setMismatch(null)
            setStage('ask')
          }}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border border-line bg-white text-plum"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="mt-6">
          {stage === 'enter' ? (
            <PinPad
              key={`enter-${mismatch ?? ''}`}
              title="Choose your PIN"
              subtitle="Pick 4 digits you'll remember"
              initialError={mismatch}
              onComplete={async (pin) => {
                if (pin === '1111') return 'Everyone starts with 1111, so pick something else.'
                setMismatch(null)
                setFirst(pin)
                setStage('confirm')
                return null
              }}
            />
          ) : (
            <PinPad
              key="confirm"
              title="One more time"
              subtitle="Enter the same 4 digits again"
              onComplete={async (pin) => {
                if (pin !== first) {
                  setFirst('')
                  setMismatch("Those didn't match. Let's start again.")
                  setStage('enter')
                  return null
                }
                const result = await choosePin(pin)
                if (!result.ok) return result.error ?? 'Something went wrong. Please try again.'
                setStage('done')
                return null
              }}
            />
          )}
        </div>
      </main>
    )
  }

  if (stage === 'done') {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col items-center px-5 pt-28 pb-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-plum">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FBF7F6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12l5 5L20 6" />
          </svg>
        </span>
        <h1 className="mt-6 font-serif text-[32px] text-plum">PIN saved</h1>
        <p className="mt-2 text-[15px] text-muted">Use it next time you sign in on a new phone.</p>
        <button
          type="button"
          onClick={goHome}
          className="mt-10 h-[58px] w-full rounded-full bg-plum text-[17px] font-semibold text-paper shadow-[0_10px_24px_rgba(78,42,79,0.25)]"
        >
          See the lists
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 pt-20 pb-10">
      <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
        <span className="h-px w-6 bg-rose" />
        Welcome
      </p>
      <h1 className="mt-2 font-serif text-[38px] leading-tight text-plum">Hi, {name}</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-ink">
        Everyone starts with 1111, so the first step is choosing a PIN of your own. That way nobody else can sign in as you.
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        This phone will remember you, so you&apos;ll only need it on a new phone.
      </p>

      <div className="mt-10 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setStage('enter')}
          className="h-[58px] rounded-full bg-plum text-[17px] font-semibold text-paper shadow-[0_10px_24px_rgba(78,42,79,0.25)]"
        >
          Choose my PIN
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await signOut()
          }}
          className="min-h-11 text-[15px] font-semibold text-plum underline underline-offset-4 disabled:opacity-50"
        >
          Not {name}? Go back
        </button>
      </div>
    </main>
  )
}
