import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The ONE way the app reaches the database: server code only, with the secret key.
//
// `server-only` makes the build fail if anything in the browser bundle imports
// this file, so the secret key can't leak into a page by accident. The tables
// have row-level security on and no policies (supabase/01-schema.sql), so this is
// also the only key that can read anything at all. Every surprise-rule check lives
// in the server routes that call this.

let client: SupabaseClient | undefined

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return client
}
