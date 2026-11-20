'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// The floating pill of tabs from the mockup. Up to four tabs (Lists, My Gifts,
// My List for owners, Admin for Jeremy and Jessica), so each is an icon over a
// small label, the way the iPhone's own tab bars fit four or five.

const ICON = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

const LISTS_ICON = (
  <svg {...ICON}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </svg>
)
const GIFTS_ICON = (
  <svg {...ICON}>
    <rect x="3" y="8" width="18" height="13" rx="2" />
    <path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S9 8 12 8zM12 8c2-4 6-4 6-1.5S15 8 12 8z" />
  </svg>
)
const MY_LIST_ICON = (
  <svg {...ICON}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  </svg>
)
const ADMIN_ICON = (
  <svg {...ICON}>
    <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

type Props = { isOwner: boolean; isAdmin: boolean; giftBadge: number; adminBadge: number }

export default function TabBar({ isOwner, isAdmin, giftBadge, adminBadge }: Props) {
  const path = usePathname()
  const tabs = [
    { href: '/', label: 'Lists', icon: LISTS_ICON, active: path === '/' || path.startsWith('/list/'), badge: 0 },
    { href: '/my-gifts', label: 'My Gifts', icon: GIFTS_ICON, active: path.startsWith('/my-gifts'), badge: giftBadge },
    ...(isOwner ? [{ href: '/my-list', label: 'My List', icon: MY_LIST_ICON, active: path.startsWith('/my-list'), badge: 0 }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: ADMIN_ICON, active: path.startsWith('/admin'), badge: adminBadge }] : []),
  ]

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 mx-auto flex h-[66px] max-w-[420px] items-center justify-around rounded-full border border-line bg-white px-2 shadow-[0_8px_30px_rgba(78,42,79,0.12)]"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? 'page' : undefined}
          aria-label={t.badge ? `${t.label}, ${t.badge} new` : undefined}
          className={`relative flex h-[54px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] ${
            t.active ? 'bg-soft font-semibold text-plum' : 'font-medium text-muted'
          }`}
        >
          {t.icon}
          {t.label}
          {t.badge > 0 && (
            <span className="absolute top-1 left-[calc(50%+6px)] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-text px-1 text-[11px] font-bold text-white">
              {t.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
