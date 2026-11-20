import { redirect } from 'next/navigation'
import { giftsFor } from '@/lib/mygifts'
import { currentPerson } from '@/lib/session'
import MyGiftsScreen from './MyGiftsScreen'

export const metadata = { title: 'My Gifts · Family List' }

export default async function MyGiftsPage() {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  const { groups, notes, count } = await giftsFor(me.id)
  return <MyGiftsScreen groups={groups} notes={notes} count={count} viewerId={me.id} />
}
