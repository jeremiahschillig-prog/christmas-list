// How long someone must wait after wrong PINs. Pure, so it's tested directly.
//
// Every 5 wrong guesses in a row (with no correct one in between) locks that
// name. The first lock is 5 minutes, and each one after doubles, up to a day:
// 5, 10, 20, 40 minutes… A grandparent fat-fingering their PIN loses five
// minutes. Someone working through all 10,000 PINs would need years.

export const MISSES_PER_LOCK = 5
const FIRST_LOCK_MINUTES = 5
const MAX_LOCK_MINUTES = 24 * 60

export type Attempt = { succeeded: boolean; attempted_at: string }

export type LockState =
  | { locked: true; until: Date }
  | { locked: false; triesLeft: number }

/** `attempts` must be newest first. */
export function lockState(attempts: Attempt[], now: Date): LockState {
  let misses = 0
  for (const a of attempts) {
    if (a.succeeded) break
    misses++
  }

  const intoBlock = misses % MISSES_PER_LOCK
  if (misses > 0 && intoBlock === 0) {
    const locksSoFar = misses / MISSES_PER_LOCK
    const minutes = Math.min(FIRST_LOCK_MINUTES * 2 ** (locksSoFar - 1), MAX_LOCK_MINUTES)
    const until = new Date(new Date(attempts[0].attempted_at).getTime() + minutes * 60_000)
    if (until > now) return { locked: true, until }
  }
  return { locked: false, triesLeft: MISSES_PER_LOCK - intoBlock }
}

/** How many recent attempts lockState needs to see. 20 blocks covers the 1-day cap. */
export const ATTEMPTS_TO_LOAD = MISSES_PER_LOCK * 20
