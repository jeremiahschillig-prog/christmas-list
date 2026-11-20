import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// PINs are stored as "scrypt$<salt>$<hash>", never as the digits.
//
// scrypt is deliberately slow to compute, which matters more than usual here: a
// 4-digit PIN has only 10,000 possibilities, so a fast hash of a leaked table would
// be cracked instantly. Slow hashing plus the attempt limit at sign-in (see
// pin_attempts in supabase/01-schema.sql) is what makes a short PIN acceptable.
//
// Pure Node, no Next.js, so the seed script and the app share it.

const KEYLEN = 32

function scryptAsync(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pin, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

/** A valid PIN is exactly 4 digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error('A PIN must be exactly 4 digits')
  const salt = randomBytes(16)
  const key = await scryptAsync(pin, salt)
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, saltText, keyText] = stored.split('$')
  if (scheme !== 'scrypt' || !saltText || !keyText) return false
  const expected = Buffer.from(keyText, 'base64url')
  const actual = await scryptAsync(pin, Buffer.from(saltText, 'base64url'))
  // Constant-time compare, so response timing doesn't hint at how close a guess was.
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/**
 * Everyone's first PIN, and the PIN after an admin reset (decided Nov 20). One
 * shared starter means the invitation can be a single email to the whole
 * family. It's only safe because it works exactly once: signing in with it goes
 * straight to "Choose your PIN" (no keep option, no way around it), and it can't
 * be chosen as anyone's own PIN.
 */
export const STARTER_PIN = '1111'

export function starterPin(): string {
  return STARTER_PIN
}

/** A PIN someone may choose for themselves: 4 digits, and not the shared starter. */
export function isChoosablePin(pin: string): boolean {
  return isValidPin(pin) && pin !== STARTER_PIN
}
