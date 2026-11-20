// Who may edit whose list. Pure, so it's tested directly.
//
// You can always edit your own list. Jeremy and Jessica (admins) can also edit
// the kids' lists, Austin's and Ellie's, but not each other's: Jessica editing
// Jeremy's list would let her change his ideas without him knowing, and
// neither of them sees the other's purchase status, so there's no reason to.

export type ListPerson = { id: string; is_owner: boolean; is_admin: boolean }

export function canEditList(editor: ListPerson, owner: ListPerson): boolean {
  if (!owner.is_owner) return false
  if (editor.id === owner.id) return true
  return editor.is_admin && !owner.is_admin
}

/**
 * Who hears about a change to an item someone already bought: the buyers and
 * every admin, minus the list's owner (the surprise) and minus whoever made the
 * change (they know already).
 */
export function changeRecipients(opts: {
  ownerId: string
  editorId: string
  buyerIds: string[]
  adminIds: string[]
}): string[] {
  const all = new Set([...opts.buyerIds, ...opts.adminIds])
  all.delete(opts.ownerId)
  all.delete(opts.editorId)
  return [...all]
}
