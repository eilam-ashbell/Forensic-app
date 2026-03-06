import * as Comlink from 'comlink'

export interface ElaEngineResult {
  overlayDataUrl: string
  maxDifference: number
  meanDifference: number
}

export interface MultiElaEngineResult {
  results: Array<{ quality: number; overlayDataUrl: string; meanDifference: number }>
  compositeDataUrl: string
}

export class ElaWorker {
  /** Re-encode image at JPEG quality Q, diff against original, amplify */
  async runEla(
    imageData: ImageData,
    quality: number,
    amplify: number,
    onProgress: (pct: number) => void,
  ): Promise<ElaEngineResult> {
    onProgress(5)
    const reencoded = await this._reencodeAsJpeg(imageData, quality)
    onProgress(60)
    const result = this._computeDiff(imageData, reencoded, amplify)
    onProgress(100)
    return result
  }

  async runMultiEla(
    imageData: ImageData,
    qualities: number[],
    amplify: number,
    onProgress: (pct: number) => void,
  ): Promise<MultiElaEngineResult> {
    const results: MultiElaEngineResult['results'] = []
    const step = 80 / qualities.length

    for (let i = 0; i < qualities.length; i++) {
      const q = qualities[i]
      onProgress(5 + i * step)
      const reencoded = await this._reencodeAsJpeg(imageData, q)
      const r = this._computeDiff(imageData, reencoded, amplify)
      results.push({ quality: q, overlayDataUrl: r.overlayDataUrl, meanDifference: r.meanDifference })
    }

    onProgress(90)
    // Composite: average all overlays
    const compositeDataUrl = await this._composite(results.map((r) => r.overlayDataUrl), imageData.width, imageData.height)
    onProgress(100)
    return { results, compositeDataUrl }
  }

  private async _reencodeAsJpeg(imageData: ImageData, quality: number): Promise<ImageData> {
    // Step 1: Draw original onto OffscreenCanvas
    const src = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = src.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)

    // Step 2: Encode to JPEG blob at given quality
    const blob = await src.convertToBlob({ type: 'image/jpeg', quality: quality / 100 })

    // Step 3: Decode back to ImageBitmap, draw, extract ImageData
    const bitmap = await createImageBitmap(blob)
    const dst = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx2 = dst.getContext('2d')!
    ctx2.drawImage(bitmap, 0, 0)
    bitmap.close()
    return ctx2.getImageData(0, 0, imageData.width, imageData.height)
  }

  private _computeDiff(original: ImageData, reencoded: ImageData, amplify: number): ElaEngineResult {
    const { width, height } = original
    const src = original.data
    const re = reencoded.data
    const out = new Uint8ClampedArray(width * height * 4)

    let maxDiff = 0
    let sumDiff = 0
    const n = width * height

    for (let i = 0; i < n; i++) {
      const p = i * 4
      const dr = Math.abs(src[p] - re[p])
      const dg = Math.abs(src[p + 1] - re[p + 1])
      const db = Math.abs(src[p + 2] - re[p + 2])
      const diff = Math.max(dr, dg, db)
      maxDiff = Math.max(maxDiff, diff)
      sumDiff += diff
      const v = Math.min(255, diff * amplify)
      out[p] = v
      out[p + 1] = v
      out[p + 2] = v
      out[p + 3] = 255
    }

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(new ImageData(out, width, height), 0, 0)

    // Convert to data URL via blob + FileReader trick isn't available in workers
    // Use canvas.convertToBlob → object URL isn't available either in workers
    // Use a different approach: encode to PNG blob then convert to base64
    const imageDataObj = new ImageData(out, width, height)
    const overlayDataUrl = this._imageDataToDataUrl(imageDataObj)

    return {
      overlayDataUrl,
      maxDifference: maxDiff,
      meanDifference: Math.round(sumDiff / n),
    }
  }

  private async _composite(dataUrls: string[], width: number, height: number): Promise<string> {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    const n = dataUrls.length
    // Average all overlay images
    const accumulated = new Float32Array(width * height * 3)
    for (const url of dataUrls) {
      const blob = await fetch(url).then((r) => r.blob()).catch(() => null)
      if (!blob) continue
      const bmp = await createImageBitmap(blob)
      ctx.drawImage(bmp, 0, 0)
      bmp.close()
      const d = ctx.getImageData(0, 0, width, height).data
      for (let i = 0; i < width * height; i++) {
        accumulated[i * 3] += d[i * 4]
        accumulated[i * 3 + 1] += d[i * 4 + 1]
        accumulated[i * 3 + 2] += d[i * 4 + 2]
      }
    }
    const out = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      out[i * 4] = accumulated[i * 3] / n
      out[i * 4 + 1] = accumulated[i * 3 + 1] / n
      out[i * 4 + 2] = accumulated[i * 3 + 2] / n
      out[i * 4 + 3] = 255
    }
    return this._imageDataToDataUrl(new ImageData(out, width, height))
  }

  private _imageDataToDataUrl(imageData: ImageData): string {
    // Encode as PNG data URL using OffscreenCanvas
    // We can't use URL.createObjectURL in all worker contexts, so encode as raw data URL
    // using a minimal PNG encoder approach via canvas
    const canvas = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    // Synchronous fallback: encode pixels as a simple canvas data URL
    // OffscreenCanvas doesn't have toDataURL, so we use a SharedArrayBuffer-free approach:
    // Return a structured payload instead and let the engine convert on the main thread side
    // Actually, we'll encode the raw pixel bytes as base64 and let the engine wrap it
    // Use PNG blob approach with a trick
    return this._pixelsToDataUrl(imageData.data, imageData.width, imageData.height)
  }

  private _pixelsToDataUrl(pixels: Uint8ClampedArray, width: number, height: number): string {
    // Minimal uncompressed PNG encoder
    const png = encodePng(pixels, width, height)
    const b64 = uint8ToBase64(png)
    return `data:image/png;base64,${b64}`
  }
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (uncompressed, DEFLATE store)
// ---------------------------------------------------------------------------

function encodePng(pixels: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rowSize = width * 4 + 1 // filter byte + RGBA per row
  const rawSize = rowSize * height

  // Build raw data with filter byte 0 (None) per row
  const raw = new Uint8Array(rawSize)
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0 // filter: None
    raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * rowSize + 1)
  }

  // DEFLATE store (no compression) — zlib header + uncompressed blocks
  const deflated = zlibStore(raw)

  const chunks: Uint8Array[] = []

  // PNG signature
  chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))

  // IHDR
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, width)
  dv.setUint32(4, height)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB — we'll use 6 (RGBA) instead
  ihdr[9] = 6  // RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  chunks.push(makeChunk('IHDR', ihdr))

  // IDAT
  chunks.push(makeChunk('IDAT', deflated))

  // IEND
  chunks.push(makeChunk('IEND', new Uint8Array(0)))

  // Concatenate
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) { out.set(c, offset); offset += c.length }
  return out
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length
  const chunk = new Uint8Array(4 + 4 + len + 4)
  const dv = new DataView(chunk.buffer)
  dv.setUint32(0, len)
  chunk[4] = type.charCodeAt(0)
  chunk[5] = type.charCodeAt(1)
  chunk[6] = type.charCodeAt(2)
  chunk[7] = type.charCodeAt(3)
  chunk.set(data, 8)
  dv.setUint32(8 + len, crc32(chunk.subarray(4, 8 + len)))
  return chunk
}

function zlibStore(data: Uint8Array): Uint8Array {
  const BLOCK_SIZE = 65535
  const blocks = Math.ceil(data.length / BLOCK_SIZE) || 1
  // zlib header (CM=8, CINFO=7, check byte)
  const out = new Uint8Array(2 + blocks * 5 + data.length + 4)
  out[0] = 0x78; out[1] = 0x01
  let pos = 2, dataPos = 0
  for (let b = 0; b < blocks; b++) {
    const isLast = b === blocks - 1
    const blockLen = Math.min(BLOCK_SIZE, data.length - dataPos)
    out[pos++] = isLast ? 1 : 0
    out[pos++] = blockLen & 0xff; out[pos++] = (blockLen >> 8) & 0xff
    out[pos++] = (~blockLen) & 0xff; out[pos++] = ((~blockLen) >> 8) & 0xff
    out.set(data.subarray(dataPos, dataPos + blockLen), pos)
    pos += blockLen; dataPos += blockLen
  }
  // Adler32 checksum
  let s1 = 1, s2 = 0
  for (const b of data) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521 }
  out[pos++] = (s2 >> 8) & 0xff; out[pos++] = s2 & 0xff
  out[pos++] = (s1 >> 8) & 0xff; out[pos] = s1 & 0xff
  return out
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

// CRC32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

Comlink.expose(new ElaWorker())
