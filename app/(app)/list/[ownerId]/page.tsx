import { notFound, redirect } from 'next/navigation'
import { listFor, ownerName } from '@/lib/lists'
import { currentPerson } from '@/lib/session'
import ListScreen from './ListScreen'

export default async function ListPage(props: PageProps<'/list/[ownerId]'>) {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')

  const { ownerId } = await props.params
  const name = await ownerName(ownerId)
  if (!name) notFound()

  // listFor applies the surprise rule: on your own list it never fetches purchases.
  const view = await listFor(me.id, ownerId)
  return <ListScreen ownerName={name} view={view} />
}
