// What the Admin tab may show, and to whom. Pure, so it's tested directly.
//
// Jeremy and Jessica see who bought what so they can label gifts while
// wrapping. Each sees every list EXCEPT their own: the surprise rule holds for
// the parents too.

export type AdminViewer = { id: string; is_admin: boolean }
export type Owner = { id: string; name: string }

/** The lists an admin may see purchases on. Empty for anyone who isn't an admin. */
export function adminVisibleLists<T extends Owner>(viewer: AdminViewer, owners: T[]): T[] {
  if (!viewer.is_admin) return []
  return owners.filter((o) => o.id !== viewer.id)
}

/** A display name for a new person: trimmed, single-spaced, 1–40 characters. */
export function cleanName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 1 || name.length > 40) return null
  return name
}

/**
 * Who can be removed from the Admin tab. List owners can't (their lists and
 * history hang off them); relatives can.
 */
export function canRemovePerson(target: { is_owner: boolean }): boolean {
  return !target.is_owner
}
