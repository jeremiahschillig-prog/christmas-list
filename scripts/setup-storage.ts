// Creates the bucket that holds item photos.
//
//   npm run db:storage
//
// Safe to run again. The bucket is public-read: a photo's address is a long
// random path, a gift photo says nothing about who bought what, and it lets the
// page show photos without signing each request. Only the server (secret key)
// can upload or delete.

import { connect } from './db'

const BUCKET = 'item-photos'
const db = connect()

const { data: existing } = await db.storage.getBucket(BUCKET)
const options = {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
}

const { error } = existing
  ? await db.storage.updateBucket(BUCKET, options)
  : await db.storage.createBucket(BUCKET, options)

if (error) {
  console.error(`Could not set up the ${BUCKET} bucket: ${error.message}`)
  process.exit(1)
}
console.log(`${existing ? 'Updated' : 'Created'} the ${BUCKET} bucket.`)
