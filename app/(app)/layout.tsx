import { redirect } from 'next/navigation'
import TabBar from '@/components/TabBar'
import { unreadGiftNotes } from '@/lib/mygifts'
import { currentPerson } from '@/lib/session'

// Every signed-in screen: the page, then the floating tab bar. Sign-in and
// welcome sit outside this group, so they have no tab bar.

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  return (
    <>
      <div className="pb-28">{children}</div>
      <TabBar isOwner={me.is_owner} giftBadge={await unreadGiftNotes(me.id)} />
    </>
  )
}
