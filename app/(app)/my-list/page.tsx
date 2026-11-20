import { redirect } from 'next/navigation'
import { assertCanEdit, editableLists, itemsForEdit } from '@/lib/mylist'
import { currentPerson } from '@/lib/session'
import MyListScreen from './MyListScreen'

export const metadata = { title: 'My List · Family List' }

// ?for=<ownerId> lets Jeremy and Jessica switch to Austin's or Ellie's list.
export default async function MyListPage(props: PageProps<'/my-list'>) {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')

  const lists = await editableLists(me)
  if (!lists.length) redirect('/')

  const wanted = (await props.searchParams).for
  const chosen = lists.find((l) => l.id === wanted) ?? lists[0]
  await assertCanEdit(me, chosen.id)

  return (
    <MyListScreen
      key={chosen.id}
      lists={lists}
      ownerId={chosen.id}
      ownerName={chosen.name}
      isMe={chosen.isMe}
      items={await itemsForEdit(chosen.id)}
    />
  )
}
