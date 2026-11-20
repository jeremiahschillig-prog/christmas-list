'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// The floating pill of tabs from the mockup. My Gifts and Admin join it in
// steps 6 and 7.

const LISTS_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </svg>
)

const MY_LIST_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  </svg>
)

export default function TabBar({ isOwner }: { isOwner: boolean }) {
  const path = usePathname()
  const tabs = [
    { href: '/', label: 'Lists', icon: LISTS_ICON, active: path === '/' || path.startsWith('/list/') },
    ...(isOwner ? [{ href: '/my-list', label: 'My List', icon: MY_LIST_ICON, active: path.startsWith('/my-list') }] : []),
  ]

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-5 bottom-[max(20px,env(safe-area-inset-bottom))] z-40 mx-auto flex h-16 max-w-[400px] items-center justify-around rounded-full border border-line bg-white shadow-[0_8px_30px_rgba(78,42,79,0.12)]"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? 'page' : undefined}
          className={`flex min-h-11 items-center gap-2 rounded-full px-[18px] py-2.5 text-[14px] ${
            t.active ? 'bg-soft font-semibold text-plum' : 'font-medium text-muted'
          }`}
        >
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
