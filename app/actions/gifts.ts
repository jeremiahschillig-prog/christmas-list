'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { markRead } from '@/lib/mygifts'
import { currentPerson } from '@/lib/session'

/** Called once My Gifts has shown these notes. */
export async function markGiftNotesRead(noteIds: string[]): Promise<void> {
  const me = await currentPerson()
  if (!me) redirect('/sign-in')
  await markRead(me.id, noteIds)
  revalidatePath('/', 'layout')
}
