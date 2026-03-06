/** Maximum allowed megapixels before downsampling */
export const MAX_MEGAPIXELS = 50

/**
 * Returns a scale factor (0 < scale <= 1) that brings the image within MAX_MEGAPIXELS.
 */
export function computeScale(width: number, height: number): number {
  const mp = (width * height) / 1_000_000
  if (mp <= MAX_MEGAPIXELS) return 1
  return Math.sqrt(MAX_MEGAPIXELS / mp)
}

/**
 * Draws an ImageBitmap onto an OffscreenCanvas, optionally downsampling to
 * stay within the megapixel limit. Returns the resulting ImageData.
 */
export async function sampleImageBitmap(bitmap: ImageBitmap): Promise<ImageData> {
  const scale = computeScale(bitmap.width, bitmap.height)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}
