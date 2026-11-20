import { redirect } from 'next/navigation'
import { adminLists, adminNotes, adminPeople } from '@/lib/admin'
import { seasonInfo } from '@/lib/season'
import { currentPerson } from '@/lib/session'
import AdminScreen from './AdminScreen'

export const metadata = { title: 'Admin · Family List' }

// Jeremy and Jessica only. Everyone else is sent home before anything loads.
// ?year=2026 shows a past Christmas's purchases (read-only history).
export default async function AdminPage(props: PageProps<'/admin'>) {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  if (!me.is_admin) redirect('/')

  const season = await seasonInfo()
  const asked = Number((await props.searchParams).year)
  const year = season.years.includes(asked) ? asked : season.year

  const [lists, notes, people] = await Promise.all([adminLists(me, year), adminNotes(me), adminPeople(me)])
  return <AdminScreen lists={lists} notes={notes} people={people} meId={me.id} season={season} viewingYear={year} />
}
