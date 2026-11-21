import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { listFor, parentNames } from '@/lib/lists'
import { canEditList } from '@/lib/permissions'
import { currentPerson } from '@/lib/session'
import ListScreen from './ListScreen'

export default async function ListPage(props: PageProps<'/list/[ownerId]'>) {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')

  const { ownerId } = await props.params
  const { data: owner } = await db()
    .from('people').select('id, name, is_owner, is_admin').eq('id', ownerId).eq('is_owner', true).maybeSingle()
  if (!owner) notFound()

  // listFor applies the surprise rule: on your own list it never fetches
  // purchases or parents' notes.
  const [view, parents] = await Promise.all([listFor(me.id, ownerId), parentNames(ownerId)])
  // Jeremy and Jessica can put a parents' note on the kids' lists.
  const canNote = me.is_admin && me.id !== owner.id && canEditList(me, owner)
  return <ListScreen ownerName={owner.name} view={view} viewerId={me.id} parents={parents} canNote={canNote} />
}
