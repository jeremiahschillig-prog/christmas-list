import { redirect } from 'next/navigation'
import { currentPerson } from '@/lib/session'
import Welcome from './Welcome'

export const metadata = { title: 'Welcome · Family List' }

// Shown once, right after signing in with a starter PIN.
export default async function WelcomePage() {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  if (!me.pin_is_starter) redirect('/')
  return <Welcome name={me.name} />
}
