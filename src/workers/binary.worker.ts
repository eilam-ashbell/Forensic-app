import * as Comlink from 'comlink'
import type { FileChunk, QuantizationTable, HexLine, StringMatch } from '../types/tools'

export class BinaryWorker {
  // ---------------------------------------------------------------------------
  // File Structure Inspector
  // ---------------------------------------------------------------------------
  inspectFileStructure(buffer: ArrayBuffer): FileChunk[] {
    const view = new DataView(buffer)
    const bytes = new Uint8Array(buffer)
    const chunks: FileChunk[] = []

    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      // JPEG
      let offset = 0
      while (offset < bytes.length - 1) {
        if (bytes[offset] !== 0xff) break
        const marker = bytes[offset + 1]
        const type = `FF ${marker.toString(16).toUpperCase().padStart(2, '0')}`
        let length = 2
        let description = jpegMarkerName(marker)
        if (marker >= 0xd0 && marker <= 0xd9) {
          // Standalone markers — no length field
        } else if (offset + 3 < bytes.length) {
          const segLen = view.getUint16(offset + 2, false)
          length = 2 + segLen
          description += ` (${segLen} bytes)`
        }
        chunks.push({ offset, length, type, description })
        offset += length
      }
    } else if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      // PNG
      chunks.push({ offset: 0, length: 8, type: 'PNG_SIG', description: 'PNG Signature' })
      let offset = 8
      while (offset + 12 <= bytes.length) {
        const chunkLen = view.getUint32(offset, false)
        const typeBytes = bytes.slice(offset + 4, offset + 8)
        const chunkType = String.fromCharCode(...typeBytes)
        const total = 4 + 4 + chunkLen + 4
        chunks.push({
          offset,
          length: total,
          type: chunkType,
          description: pngChunkDescription(chunkType) + ` (data: ${chunkLen} bytes)`,
        })
        offset += total
      }
    } else {
      chunks.push({
        offset: 0,
        length: bytes.length,
        type: 'UNKNOWN',
        description: `Unknown format (${bytes.length} bytes)`,
      })
    }

    return chunks
  }

  // ---------------------------------------------------------------------------
  // JPEG Quantization Table Analyzer
  // ---------------------------------------------------------------------------
  extractQuantizationTables(buffer: ArrayBuffer): QuantizationTable[] {
    const bytes = new Uint8Array(buffer)
    const tables: QuantizationTable[] = []
    let offset = 0

    while (offset < bytes.length - 1) {
      if (bytes[offset] !== 0xff) break
      const marker = bytes[offset + 1]
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2
        continue
      }
      if (offset + 3 >= bytes.length) break
      const segLen = ((bytes[offset + 2] << 8) | bytes[offset + 3]) + 2
      if (marker === 0xdb) {
        // DQT segment — may contain multiple tables
        let pos = offset + 4
        while (pos < offset + segLen) {
          const precision = (bytes[pos] >> 4) & 0xf // 0 = 8bit, 1 = 16bit
          const tableId = bytes[pos] & 0xf
          pos++
          const coeffs: number[] = []
          if (precision === 0) {
            for (let i = 0; i < 64; i++) coeffs.push(bytes[pos++])
          } else {
            for (let i = 0; i < 64; i++) {
              coeffs.push((bytes[pos] << 8) | bytes[pos + 1])
              pos += 2
            }
          }
          const quality = estimateQuality(coeffs)
          tables.push({ id: tableId, coefficients: coeffs, estimatedQuality: quality })
        }
      }
      offset += segLen
    }

    return tables
  }

  // ---------------------------------------------------------------------------
  // Hex Viewer
  // ---------------------------------------------------------------------------
  getHexLines(buffer: ArrayBuffer, offset: number, count: number): HexLine[] {
    const bytes = new Uint8Array(buffer, Math.min(offset, buffer.byteLength))
    const slice = bytes.slice(0, Math.min(count, bytes.length))
    const lines: HexLine[] = []

    for (let i = 0; i < slice.length; i += 16) {
      const row = slice.slice(i, i + 16)
      const hex = Array.from(row).map((b) => b.toString(16).padStart(2, '0'))
      const ascii = Array.from(row)
        .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
        .join('')
      lines.push({ offset: offset + i, hex, ascii })
    }

    return lines
  }

  // ---------------------------------------------------------------------------
  // String Extractor
  // ---------------------------------------------------------------------------
  extractStrings(buffer: ArrayBuffer, minLength: number, encoding: 'ascii' | 'utf16le'): StringMatch[] {
    const bytes = new Uint8Array(buffer)
    const matches: StringMatch[] = []

    if (encoding === 'ascii') {
      let start = -1
      let current = ''
      for (let i = 0; i <= bytes.length; i++) {
        const b = i < bytes.length ? bytes[i] : 0
        if (b >= 32 && b < 127) {
          if (start === -1) start = i
          current += String.fromCharCode(b)
        } else {
          if (current.length >= minLength) {
            matches.push({ offset: start, encoding: 'ascii', value: current, length: current.length })
          }
          start = -1
          current = ''
        }
      }
    } else {
      // UTF-16 LE
      let start = -1
      let current = ''
      for (let i = 0; i <= bytes.length - 1; i += 2) {
        const lo = bytes[i]
        const hi = bytes[i + 1] ?? 0
        const cp = lo | (hi << 8)
        if (cp >= 32 && cp < 127) {
          if (start === -1) start = i
          current += String.fromCharCode(cp)
        } else {
          if (current.length >= minLength) {
            matches.push({ offset: start, encoding: 'utf16le', value: current, length: current.length })
          }
          start = -1
          current = ''
        }
      }
    }

    return matches
  }
}

function jpegMarkerName(marker: number): string {
  const names: Record<number, string> = {
    0xd8: 'SOI (Start of Image)',
    0xd9: 'EOI (End of Image)',
    0xe0: 'APP0 (JFIF)',
    0xe1: 'APP1 (EXIF/XMP)',
    0xe2: 'APP2 (ICC Profile)',
    0xfe: 'COM (Comment)',
    0xdb: 'DQT (Quantization Table)',
    0xc0: 'SOF0 (Baseline DCT)',
    0xc2: 'SOF2 (Progressive DCT)',
    0xc4: 'DHT (Huffman Table)',
    0xda: 'SOS (Start of Scan)',
    0xdd: 'DRI (Restart Interval)',
  }
  return names[marker] ?? `Marker 0xFF${marker.toString(16).toUpperCase()}`
}

function pngChunkDescription(type: string): string {
  const names: Record<string, string> = {
    IHDR: 'Image Header',
    IDAT: 'Image Data',
    IEND: 'Image End',
    PLTE: 'Palette',
    tEXt: 'Text Metadata',
    iTXt: 'International Text',
    zTXt: 'Compressed Text',
    gAMA: 'Gamma',
    cHRM: 'Chromaticity',
    sRGB: 'sRGB Color Space',
    tIME: 'Timestamp',
    bKGD: 'Background Color',
    pHYs: 'Pixel Dimensions',
    eXIf: 'EXIF Metadata',
  }
  return names[type] ?? `${type} chunk`
}

function estimateQuality(coeffs: number[]): number {
  // IJG quality estimation from luminance table's first few coefficients
  const sum = coeffs.slice(0, 64).reduce((a, b) => a + b, 0)
  const avg = sum / 64
  // Approximate inversion: quality ≈ (200 - avg * 2) / 2 clamped to [1, 100]
  const q = Math.round((200 - avg * 2) / 2)
  return Math.max(1, Math.min(100, q))
}

Comlink.expose(new BinaryWorker())
