// Jeremy or Jessica's red note on an idea ("We already bought this on sale…").
// Shown to buyers only: the list's owner is never sent it.
export default function ParentNote({ note, compact = false }: { note: string; compact?: boolean }) {
  return (
    <span
      className={`flex gap-2 rounded-xl bg-alert-soft text-alert ${compact ? 'px-3 py-2 text-[13px]' : 'px-4 py-3 text-[15px]'} font-medium leading-snug`}
    >
      <svg className="mt-[2px] shrink-0" width={compact ? 14 : 16} height={compact ? 14 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5h.01" />
      </svg>
      <span className={compact ? 'line-clamp-3' : ''}>{note}</span>
    </span>
  )
}
