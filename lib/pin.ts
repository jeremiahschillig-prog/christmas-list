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

/** A random 4-digit starter PIN, for an admin adding or resetting someone. */
export function starterPin(): string {
  return String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, '0')
}
