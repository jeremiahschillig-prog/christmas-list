// Shown the moment a tab or a list is tapped, while the server gathers that
// screen. Without it the old screen just sat there until the new one was ready,
// which looked like the tap hadn't registered. The tab bar stays in place.

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-3 px-5" aria-busy="true">
      <span className="size-8 animate-spin rounded-full border-[3px] border-line border-t-plum" aria-hidden="true" />
      <p className="text-[15px] text-muted">Loading…</p>
    </main>
  )
}
