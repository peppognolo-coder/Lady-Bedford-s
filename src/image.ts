/** Ridimensiona una foto nel browser (lato lungo massimo `max` px) e la converte in WebP leggero. */
export async function prepareImage(file: File, max: number, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Il file scelto non è un’immagine.')
  if (file.size > 30 * 1024 * 1024) throw new Error('La foto è troppo grande (massimo 30 MB).')
  const bmp = await createImageBitmap(file).catch(() => { throw new Error('Non riesco a leggere questa foto. Prova con un JPG o PNG.') })
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k))
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const toBlob = (type: string) => new Promise<Blob | null>(res => canvas.toBlob(res, type, quality))
  let out = await toBlob('image/webp')
  if (!out || out.type !== 'image/webp') out = await toBlob('image/jpeg')
  if (!out) throw new Error('Non sono riuscito a preparare la foto.')
  return out
}
export const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(new Error('Lettura della foto non riuscita')); r.readAsDataURL(b) })
