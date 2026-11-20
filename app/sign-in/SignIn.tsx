'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PinPad from '@/components/PinPad'
import { signIn } from '@/app/actions/auth'

type Person = { id: string; name: string; is_owner: boolean }

function lockMessage(until: string): string {
  const time = new Date(until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `Too many tries. You can try again at ${time}.`
}

export default function SignIn({ people }: { people: Person[] }) {
  const router = useRouter()
  const [chosen, setChosen] = useState<Person | null>(null)
  const [locked, setLocked] = useState<string | null>(null)

  const owners = people.filter((p) => p.is_owner)
  const family = people.filter((p) => !p.is_owner)

  if (chosen) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col px-5 pt-12 pb-10">
        <button
          type="button"
          onClick={() => {
            setChosen(null)
            setLocked(null)
          }}
          aria-label="Choose a different name"
          className="flex size-11 items-center justify-center rounded-full border border-line bg-white text-plum"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        <div className="mt-6">
          <PinPad
            key={chosen.id}
            title={`Hi, ${chosen.name}`}
            subtitle="Enter your 4-digit PIN"
            blockedMessage={locked}
            onComplete={async (pin) => {
              const result = await signIn(chosen.id, pin)
              if (result.ok) {
                router.replace(result.next)
                router.refresh()
                return null
              }
              if (result.reason === 'locked') {
                setLocked(lockMessage(result.until))
                return null
              }
              if (result.reason === 'wrong') {
                return result.triesLeft === 1
                  ? "That's not it. One more try before a short wait."
                  : `That's not it. ${result.triesLeft} tries left.`
              }
              return 'Something went wrong. Please try again.'
            }}
          />
        </div>

        <p className="mt-8 text-center text-[14px] text-muted">Forgot your PIN? Ask Jeremy or Jessica to reset it.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-14 pb-10">
      <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
        <span className="h-px w-6 bg-rose" />
        Christmas 2026
      </p>
      <h1 className="mt-1.5 font-serif text-[38px] leading-tight text-plum">The Family List</h1>
      <p className="mt-1 text-[15px] text-muted">Who&apos;s this?</p>

      <div className="mt-7 grid grid-cols-2 gap-3">
        {owners.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setChosen(p)}
            className="flex flex-col items-start gap-5 rounded-[20px] border border-line bg-white p-[18px] text-left shadow-[0_8px_24px_rgba(78,42,79,0.06)] active:bg-soft"
          >
            <span className="flex size-12 items-center justify-center rounded-full border border-rose font-serif text-[22px] text-plum">
              {p.name[0]}
            </span>
            <span className="font-serif text-[22px] text-plum">{p.name}</span>
          </button>
        ))}
      </div>

      {family.length > 0 && (
        <>
          <p className="mt-8 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
            Family
            <span className="h-px flex-1 bg-line" />
          </p>
          <div className="mt-3 overflow-hidden rounded-[20px] border border-line bg-white">
            {family.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setChosen(p)}
                className={`flex min-h-[56px] w-full items-center gap-3.5 px-[18px] py-3 text-left active:bg-soft ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <span className="flex size-9 items-center justify-center rounded-full border border-rose font-serif text-[16px] text-plum">
                  {p.name[0]}
                </span>
                <span className="flex-1 text-[17px] text-ink">{p.name}</span>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted" aria-hidden="true">
                  <path d="M1 1l6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
