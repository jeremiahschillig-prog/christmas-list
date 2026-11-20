// Shrinks a photo in the browser before it's uploaded.
//
// A phone photo is 3–8 MB; a list thumbnail needs a fraction of that. Redrawing
// it at no more than 1600 px as a JPEG makes uploads quick on cellular, keeps
// storage small, and also turns any format the phone can display (including
// iPhone HEIC) into a JPEG every browser can show.

const MAX_SIDE = 1600

export async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.fillStyle = '#ffffff' // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('could not encode')
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
}
