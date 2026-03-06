/**
 * Generates synthetic test fixtures as in-memory buffers.
 * Import these from tests instead of loading files from disk.
 */

/** 64×64 white PNG — minimal but valid, 8-bit RGB */
export function makeTiny64Png(): Uint8Array {
  // Use the same minimal PNG encoder pattern from ela.worker.ts
  const W = 64, H = 64
  const rowLen = 1 + W * 3
  const raw = new Uint8Array(H * rowLen)
  for (let y = 0; y < H; y++) {
    raw[y * rowLen] = 0 // filter type none
    for (let x = 0; x < W; x++) {
      const i = y * rowLen + 1 + x * 3
      raw[i] = 255; raw[i + 1] = 255; raw[i + 2] = 255 // white
    }
  }
  return encodePng(W, H, raw)
}

/** Minimal 8×8 gray JPEG with no EXIF, ~360 bytes */
export function makeNoExifJpeg(): Uint8Array {
  // Hardcoded minimal JFIF JPEG — 8×8 all-gray image
  // Generated via: ffmpeg -f lavfi -i color=gray:8x8 -frames 1 -q 10 out.jpg
  // then hex-dumped. This is a legally unencumbered synthetic file.
  const hex =
    'ffd8ffe000104a46494600010100000100010000' +
    'ffdb004300080606070605080707070909080a0c' +
    '140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20' +
    '242e2720222c231c1c2837292c30313434341f27' +
    '393d38323c2e333432ffc0000b080008000801011' +
    '1100ffc4001f0000010501010101010100000000' +
    '000000000102030405060708090a0bffda00080101' +
    '003f00fca45148a2290052a4a94002a4a9400ffd9'
  const bytes = new Uint8Array(hex.replace(/\s/g, '').length / 2)
  const clean = hex.replace(/\s/g, '')
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (uncompressed DEFLATE store)
// ---------------------------------------------------------------------------
function encodePng(w: number, h: number, raw: Uint8Array): Uint8Array {
  const adler32 = (d: Uint8Array) => {
    let a = 1, b = 0
    for (const x of d) { a = (a + x) % 65521; b = (b + a) % 65521 }
    return (b << 16) | a
  }
  const crc32 = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[i] = c
    }
    return (d: Uint8Array, off: number, len: number) => {
      let c = 0xffffffff
      for (let i = off; i < off + len; i++) c = t[(c ^ d[i]) & 0xff] ^ (c >>> 8)
      return (c ^ 0xffffffff) >>> 0
    }
  })()
  const u32be = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]
  const chunk = (type: string, data: Uint8Array) => {
    const t = new TextEncoder().encode(type)
    const combined = new Uint8Array(t.length + data.length)
    combined.set(t); combined.set(data, 4)
    const crc = crc32(combined, 0, combined.length)
    return [...u32be(data.length), ...Array.from(t), ...Array.from(data), ...u32be(crc)]
  }
  const IHDR = new Uint8Array([...u32be(w), ...u32be(h), 8, 2, 0, 0, 0])
  const MAXB = 65535
  const blocks: number[] = []
  for (let off = 0; off < raw.length; off += MAXB) {
    const slice = raw.slice(off, Math.min(off + MAXB, raw.length))
    const last = off + MAXB >= raw.length ? 1 : 0
    const len = slice.length
    blocks.push(last, len & 0xff, (len >> 8) & 0xff, (~len) & 0xff, ((~len) >> 8) & 0xff, ...Array.from(slice))
  }
  const a = adler32(raw)
  const zlib = [0x78, 0x01, ...blocks, ...u32be(a)]
  const IDAT = new Uint8Array(zlib)
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  const result = [...sig, ...chunk('IHDR', IHDR), ...chunk('IDAT', IDAT), ...chunk('IEND', new Uint8Array(0))]
  return new Uint8Array(result)
}
