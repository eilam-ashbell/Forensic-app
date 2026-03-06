import type { ImageRecord } from '../../types/image'
import { sampleImageBitmap } from './sampler'

const SUPPORTED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/bmp',
  'image/gif',
  'image/heic',
  'image/heif',
])

/** JPEG magic bytes: FF D8 */
function isJpeg(buf: ArrayBuffer): boolean {
  const view = new Uint8Array(buf, 0, 2)
  return view[0] === 0xff && view[1] === 0xd8
}

/** PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A */
function isPng(buf: ArrayBuffer): boolean {
  const view = new Uint8Array(buf, 0, 8)
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return PNG.every((b, i) => view[i] === b)
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Simple MD5 — not cryptographically secure, chain-of-custody only */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function md5Hex(_buf: ArrayBuffer): Promise<string> {
  // Browsers don't support MD5 natively via SubtleCrypto.
  // TODO: replace with md5 from 'hash-wasm' or similar when added.
  return 'md5-not-implemented'
}

export class ImageLoadError extends Error {}

export async function loadImageFile(file: File): Promise<ImageRecord> {
  if (!SUPPORTED_MIME.has(file.type) && file.type !== '') {
    throw new ImageLoadError(`Unsupported file type: ${file.type}`)
  }

  const arrayBuffer = await file.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: file.type || 'image/jpeg' })
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    throw new ImageLoadError('Failed to decode image — file may be corrupt or unsupported.')
  }

  const imageData = await sampleImageBitmap(bitmap)
  bitmap.close()

  const [sha256, md5] = await Promise.all([sha256Hex(arrayBuffer), md5Hex(arrayBuffer)])

  return {
    file,
    imageData,
    arrayBuffer,
    dimensions: { width: imageData.width, height: imageData.height },
    megapixels: (imageData.width * imageData.height) / 1_000_000,
    isJpeg: isJpeg(arrayBuffer),
    isPng: isPng(arrayBuffer),
    sha256,
    md5,
  }
}
