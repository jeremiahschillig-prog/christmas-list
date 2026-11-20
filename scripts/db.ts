import { createClient } from '@supabase/supabase-js'

// The scripts' own database connection. lib/db.ts is marked server-only for
// Next.js, which a plain Node script can't import, so this mirrors it. Same
// secret key, read from .env.local by `node --env-file`.

export function connect() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
