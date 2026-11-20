import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { currentPerson } from '@/lib/session'
import SignIn from './SignIn'

export const metadata = { title: 'Sign in · Family List' }

export default async function SignInPage() {
  if (await currentPerson()) redirect('/')

  // Names only. Nothing about anyone's list is needed to sign in.
  const { data } = await db()
    .from('people')
    .select('id, name, is_owner')
    .order('sort_order')
    .order('name')

  return <SignIn people={data ?? []} />
}
