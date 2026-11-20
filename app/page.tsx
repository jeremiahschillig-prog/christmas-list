// Step 1 placeholder: proves the fonts and palette render the way the mockup does.
// Replaced by the real sign-in and Home screens in steps 3 and 4.

const OWNERS = ['Jeremy', 'Jessica', 'Austin', 'Ellie']

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-14 pb-10">
      <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-text">
        <span className="h-px w-6 bg-rose" />
        Christmas 2026
      </p>
      <h1 className="mt-1.5 font-serif text-[38px] leading-tight text-plum">The Family List</h1>
      <p className="mt-1 text-[15px] text-muted">Being built — check back soon.</p>

      <div className="mt-7 grid grid-cols-2 gap-3">
        {OWNERS.map((name) => (
          <div
            key={name}
            className="flex flex-col gap-5 rounded-[20px] border border-line bg-white p-[18px] shadow-[0_8px_24px_rgba(78,42,79,0.06)]"
          >
            <div className="flex size-12 items-center justify-center rounded-full border border-rose font-serif text-[22px] text-plum">
              {name[0]}
            </div>
            <span className="font-serif text-[22px] text-plum">{name}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
