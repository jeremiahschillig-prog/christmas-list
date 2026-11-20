import Link from 'next/link'
import { redirect } from 'next/navigation'
import { homeFor } from '@/lib/lists'
import { currentPerson } from '@/lib/session'
import { signOut } from '@/app/actions/auth'

export default async function Home() {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  const { year, cards, myGiftCount } = await homeFor(me.id)

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-14 pb-10">
      <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
        <span className="h-px w-6 bg-rose" />
        Christmas {year}
      </p>
      <h1 className="mt-1.5 font-serif text-[38px] leading-tight text-plum">The Family List</h1>
      <p className="mt-1 text-[15px] text-muted">Welcome back, {me.name}</p>

      <div className="mt-7 grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <Link
            key={card.id}
            href={`/list/${card.id}`}
            className="flex flex-col gap-5 rounded-[20px] border border-line bg-white p-[18px] shadow-[0_8px_24px_rgba(78,42,79,0.06)] active:bg-soft"
          >
            <span className="flex size-12 items-center justify-center rounded-full border border-rose font-serif text-[22px] text-plum">
              {card.name[0]}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-serif text-[22px] text-plum">{card.name}</span>
              <span className="text-[13px] text-muted">
                {card.isMe
                  ? `Your list · ${card.itemCount} ${card.itemCount === 1 ? 'idea' : 'ideas'}`
                  : `${card.openCount} ${card.openCount === 1 ? 'idea' : 'ideas'} open`}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-1 rounded-[20px] bg-plum p-5 text-paper">
        <span className="text-xs uppercase tracking-[0.16em] text-rose-light">Your shopping</span>
        <span className="font-serif text-[22px]">
          {myGiftCount === 0 ? 'Nothing picked yet' : `${myGiftCount} ${myGiftCount === 1 ? 'gift' : 'gifts'} picked`}
        </span>
        <span className="text-[13px] text-paper/80">
          {myGiftCount === 0 ? 'Tap a name to see their list' : 'Your full checklist is coming soon'}
        </span>
      </div>

      <form action={signOut} className="mt-10 text-center">
        <button type="submit" className="min-h-11 text-[15px] font-semibold text-plum underline underline-offset-4">
          Sign out
        </button>
      </form>
    </main>
  )
}
