import { redirect } from 'next/navigation'
import { adminLists, adminNotes, adminPeople } from '@/lib/admin'
import { currentPerson } from '@/lib/session'
import AdminScreen from './AdminScreen'

export const metadata = { title: 'Admin · Family List' }

// Jeremy and Jessica only. Everyone else is sent home before anything loads.
export default async function AdminPage() {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  if (!me.is_admin) redirect('/')

  const [lists, notes, people] = await Promise.all([adminLists(me), adminNotes(me), adminPeople(me)])
  return <AdminScreen lists={lists} notes={notes} people={people} meId={me.id} />
}
