import sharp from 'sharp'

// Every photo is stored small: at most 800 px on its longest side, as a JPEG.
// Store photos are often 2-5 MB PNGs, and a list screen shows dozens of them, so
// full-size copies made every tap wait behind tens of megabytes on a phone.
// 800 px stays sharp in the item sheet and is around 50-100 KB.
const MAX_SIDE = 800

export async function shrinkForStorage(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp(bytes, { animated: false })
      .rotate() // honour the phone's orientation flag
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }) // transparent PNGs get white, not black
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer(),
  )
}
