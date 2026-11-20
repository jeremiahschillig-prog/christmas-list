import { redirect } from 'next/navigation'
import TabBar from '@/components/TabBar'
import { unreadAdminNotes } from '@/lib/admin'
import { unreadGiftNotes } from '@/lib/mygifts'
import { currentPerson } from '@/lib/session'

// Every signed-in screen: the page, then the floating tab bar. Sign-in and
// welcome sit outside this group, so they have no tab bar.

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  // Still on the shared starter PIN (1111): nothing else until they choose their
  // own, or anyone could sign in as them.
  if (me.pin_is_starter) redirect('/welcome')
  const [giftBadge, adminBadge] = await Promise.all([unreadGiftNotes(me.id), unreadAdminNotes(me)])
  return (
    <>
      <div className="pb-28">{children}</div>
      <TabBar isOwner={me.is_owner} isAdmin={me.is_admin} giftBadge={giftBadge} adminBadge={adminBadge} />
    </>
  )
}
