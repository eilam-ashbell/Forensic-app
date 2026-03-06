import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImageLoadError, loadImageFile } from '../lib/image/loader'

// happy-dom provides createImageBitmap stub — mock it to return a fixed-size bitmap
const MOCK_WIDTH = 100
const MOCK_HEIGHT = 80

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', async () => ({
    width: MOCK_WIDTH,
    height: MOCK_HEIGHT,
    close: vi.fn(),
  }))

  // OffscreenCanvas stub (used inside sampleImageBitmap)
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      width: number
      height: number
      constructor(w: number, h: number) {
        this.width = w
        this.height = h
      }
      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: () => ({
            data: new Uint8ClampedArray(MOCK_WIDTH * MOCK_HEIGHT * 4),
            width: MOCK_WIDTH,
            height: MOCK_HEIGHT,
          }),
        }
      }
    },
  )
})

describe('loadImageFile', () => {
  it('rejects unsupported MIME types', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    await expect(loadImageFile(file)).rejects.toBeInstanceOf(ImageLoadError)
  })

  it('resolves for a JPEG file with valid magic bytes', async () => {
    // JPEG magic: FF D8, padded to 16 bytes so isPng() can safely read 8 bytes
    const bytes = new Uint8Array(16)
    bytes[0] = 0xff
    bytes[1] = 0xd8
    const file = new File([bytes.buffer], 'test.jpg', { type: 'image/jpeg' })
    const record = await loadImageFile(file)
    expect(record.isJpeg).toBe(true)
    expect(record.isPng).toBe(false)
    expect(record.sha256).toHaveLength(64)
    expect(record.md5).toHaveLength(32)
    expect(record.dimensions.width).toBe(MOCK_WIDTH)
    expect(record.dimensions.height).toBe(MOCK_HEIGHT)
  })

  it('resolves for a PNG file with valid magic bytes', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    const file = new File([png.buffer], 'test.png', { type: 'image/png' })
    const record = await loadImageFile(file)
    expect(record.isPng).toBe(true)
    expect(record.isJpeg).toBe(false)
  })

  it('computes megapixels correctly', async () => {
    const bytes = new Uint8Array(16)
    bytes[0] = 0xff
    bytes[1] = 0xd8
    const file = new File([bytes.buffer], 'x.jpg', { type: 'image/jpeg' })
    const record = await loadImageFile(file)
    expect(record.megapixels).toBeCloseTo((MOCK_WIDTH * MOCK_HEIGHT) / 1_000_000, 5)
  })
})
