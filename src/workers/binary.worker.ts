import * as Comlink from 'comlink'
import type {
  FileChunk,
  QuantizationTable,
  HexLine,
  StringMatch,
  SocialMediaDetectorResult,
  SocialMediaSignal,
  SocialMediaCandidate,
  SignalConfidence,
} from '../types/tools'

// ---------------------------------------------------------------------------
// Social Media Detector — static lookup tables
// ---------------------------------------------------------------------------

type SigEntry = [string, SignalConfidence, string] // [search string, confidence, description]
type PatternEntry = [RegExp, SignalConfidence, string] // [regex, confidence, description]
interface PlatformSig {
  platform: string
  strings: SigEntry[]
  filePatterns: PatternEntry[]
}

const PLATFORM_SIGS: PlatformSig[] = [
  {
    platform: 'Facebook',
    strings: [
      ['fbmd', 'high', 'Facebook Metadata (FBMD) marker in binary'],
      ['fbcdn', 'high', 'Facebook CDN (fbcdn) domain reference'],
      ['facebook.com', 'high', 'facebook.com domain reference'],
      ['fb.com', 'medium', 'fb.com short domain reference'],
      ['creator: gd-jpeg', 'medium', 'GD library JPEG creator string (used by Facebook)'],
    ],
    filePatterns: [
      [/^fb_img_\d+\.(jpe?g|png)$/i, 'high', 'Facebook download filename (FB_IMG_...)'],
      [
        /^\d{6,}_\d{6,}_\d{6,}_[a-z]\.(jpe?g|png)$/i,
        'high',
        'Facebook image ID format (NNN_NNN_NNN_x.jpg)',
      ],
    ],
  },
  {
    platform: 'Instagram',
    strings: [
      ['cdninstagram', 'high', 'Instagram CDN domain reference'],
      ['instagram.com', 'high', 'instagram.com domain reference'],
      ['instagram', 'medium', 'Instagram string in binary'],
    ],
    filePatterns: [
      [
        /^\d{6,}_\d{6,}_\d{6,}_n\.(jpe?g|png)$/i,
        'high',
        'Instagram image ID format (NNN_NNN_NNN_n.jpg)',
      ],
    ],
  },
  {
    platform: 'Twitter / X',
    strings: [
      ['twimg.com', 'high', 'Twitter image CDN (twimg.com) reference'],
      ['twitter.com', 'high', 'twitter.com domain reference'],
      ['twitter', 'medium', 'Twitter string in binary'],
      ['t.co', 'medium', 'Twitter URL shortener (t.co) reference'],
    ],
    filePatterns: [],
  },
  {
    platform: 'WhatsApp',
    strings: [
      ['whatsapp', 'high', 'WhatsApp string in binary'],
      ['com.whatsapp', 'high', 'WhatsApp Android package identifier'],
    ],
    filePatterns: [
      [/^img-\d{8}-wa\d{4}\.(jpe?g|png)$/i, 'high', 'WhatsApp image filename scheme (IMG-YYYYMMDD-WAxxxx)'],
      [/^vid-\d{8}-wa\d{4}\./i, 'high', 'WhatsApp video filename scheme (VID-YYYYMMDD-WAxxxx)'],
    ],
  },
  {
    platform: 'TikTok',
    strings: [
      ['tiktok', 'high', 'TikTok string in binary'],
      ['bytedance', 'high', 'ByteDance (TikTok parent company) reference'],
      ['musically', 'medium', 'Musical.ly (TikTok predecessor) reference'],
    ],
    filePatterns: [
      [/^\d{18,}\.(jpe?g|png|webp)$/i, 'medium', 'TikTok-style 18+ digit numeric ID filename'],
    ],
  },
  {
    platform: 'LinkedIn',
    strings: [
      ['licdn.com', 'high', 'LinkedIn CDN (licdn.com) reference'],
      ['linkedin', 'high', 'LinkedIn string in binary'],
    ],
    filePatterns: [],
  },
  {
    platform: 'Snapchat',
    strings: [
      ['snap.com', 'high', 'Snap Inc. domain reference'],
      ['snapchat', 'high', 'Snapchat string in binary'],
    ],
    filePatterns: [],
  },
  {
    platform: 'Pinterest',
    strings: [
      ['pinimg.com', 'high', 'Pinterest image CDN (pinimg.com) reference'],
      ['pinterest', 'high', 'Pinterest string in binary'],
    ],
    filePatterns: [],
  },
  {
    platform: 'YouTube',
    strings: [
      ['ytimg.com', 'high', 'YouTube image CDN (ytimg.com) reference'],
      ['googlevideo', 'high', 'Google Video CDN reference'],
      ['youtube', 'high', 'YouTube string in binary'],
    ],
    filePatterns: [
      [
        /^(maxresdefault|hqdefault|mqdefault|sddefault|default)\.(jpe?g|png)$/i,
        'high',
        'YouTube standard thumbnail filename',
      ],
    ],
  },
  {
    platform: 'Reddit',
    strings: [
      ['redd.it', 'high', 'Reddit short CDN domain (redd.it)'],
      ['redditmedia', 'high', 'Reddit media CDN reference'],
      ['reddit', 'high', 'Reddit string in binary'],
    ],
    filePatterns: [],
  },
  {
    platform: 'Telegram',
    strings: [
      ['telegram', 'high', 'Telegram string in binary'],
      ['t.me', 'medium', 'Telegram short link domain (t.me)'],
    ],
    filePatterns: [],
  },
  {
    platform: 'WeChat',
    strings: [
      ['wechat', 'high', 'WeChat string in binary'],
      ['weixin', 'high', 'WeChat (Weixin) Chinese name reference'],
    ],
    filePatterns: [
      [/^mmexport\d{13}\.(jpe?g|png)$/i, 'high', 'WeChat export filename scheme (mmexportXXXXXXXXXXXXX)'],
    ],
  },
  {
    platform: 'Signal',
    strings: [['signal', 'medium', 'Signal messenger string in binary']],
    filePatterns: [],
  },
]

// FNV-1a 32-bit hash (pure JS, no imports)
function fnv1a32(data: Uint8Array): number {
  let h = 0x811c9dc5
  for (const b of data) h = Math.imul(h ^ b, 0x01000193) >>> 0
  return h
}

// QT fingerprints: tableKey → {platform, confidence}
// Keys computed using FNV-1a over libjpeg/mozjpeg quantization table bytes.
// libjpeg quality formula: scale = (q<50) ? 5000/q : 200-2*q
//                          coeff = clamp(floor((base*scale+50)/100), 1, 255)
const KNOWN_QT_FINGERPRINTS = new Map<string, { platform: string; confidence: SignalConfidence }>([
  ['bb22f6cc:dbd05a49', { platform: 'Facebook / Instagram', confidence: 'high' }], // mozjpeg q85 custom tables
  ['45ac55ba:544acc98', { platform: 'WhatsApp', confidence: 'high' }],             // libjpeg q76
  ['9c5da9d2:41d6ba57', { platform: 'Twitter / X', confidence: 'high' }],         // libjpeg q85
  ['1829844a:1677cafc', { platform: 'TikTok', confidence: 'high' }],               // libjpeg q80
  ['9a929783:ccfc6d93', { platform: 'WeChat', confidence: 'high' }],               // libjpeg q75
  ['244198f0:c9dc7be5', { platform: 'Telegram', confidence: 'medium' }],           // libjpeg q83
])

// Marker sequence fingerprints: joined sequence → {platform, confidence}
const KNOWN_MARKER_SEQUENCES = new Map<string, { platform: string; confidence: SignalConfidence }>([
  [
    'SOI,DQT,DQT,SOF2,DHT,DHT,DHT,DHT,SOS,EOI',
    { platform: 'Facebook / Instagram', confidence: 'high' },
  ],
  [
    'SOI,APP0,DQT,DQT,SOF2,DHT,DHT,DHT,DHT,SOS,EOI',
    { platform: 'Twitter / X', confidence: 'high' },
  ],
  [
    'SOI,APP0,DQT,DQT,SOF0,DHT,DHT,DHT,DHT,SOS,EOI',
    { platform: 'WhatsApp', confidence: 'medium' }, // also used by TikTok, WeChat, YouTube
  ],
])

const JPEG_MARKER_NAMES: Record<number, string> = {
  0xd8: 'SOI', 0xd9: 'EOI',
  0xe0: 'APP0', 0xe1: 'APP1', 0xe2: 'APP2', 0xe3: 'APP3',
  0xe4: 'APP4', 0xe5: 'APP5', 0xe6: 'APP6', 0xe7: 'APP7',
  0xe8: 'APP8', 0xe9: 'APP9', 0xea: 'APP10', 0xeb: 'APP11',
  0xec: 'APP12', 0xed: 'APP13', 0xee: 'APP14', 0xef: 'APP15',
  0xdb: 'DQT', 0xc0: 'SOF0', 0xc2: 'SOF2',
  0xc4: 'DHT', 0xda: 'SOS', 0xfe: 'COM', 0xdd: 'DRI',
}

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
  // Social Media Detector
  // ---------------------------------------------------------------------------
  detectSocialMediaSource(
    buffer: ArrayBuffer,
    filename: string,
    onProgress: (p: number) => void,
  ): SocialMediaDetectorResult {
    const bytes = new Uint8Array(buffer)
    const signals: SocialMediaSignal[] = []
    const fname = filename.toLowerCase()

    // Step 1: Filename pattern matching
    for (const plat of PLATFORM_SIGS) {
      for (const [rx, conf, desc] of plat.filePatterns) {
        if (rx.test(fname)) {
          signals.push({
            type: 'filename',
            platform: plat.platform,
            description: desc,
            matchedValue: filename,
            confidence: conf,
          })
        }
      }
    }
    onProgress(15)

    // Step 2: JPEG structural analysis, marker sequence, and QT extraction
    let strippedExif = true
    let progressiveJpeg = false
    let hasJpegComment = false
    const markerSequence: string[] = []
    let qualityEquivalent: number | null = null
    let lumaTable: Uint8Array | null = null
    let chromaTable: Uint8Array | null = null

    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
    if (isJpeg) {
      markerSequence.push('SOI')
      let off = 2
      while (off < bytes.length - 1) {
        // Skip padding 0xff bytes
        while (off < bytes.length - 1 && bytes[off] === 0xff && bytes[off + 1] === 0xff) off++
        if (off >= bytes.length - 1 || bytes[off] !== 0xff) break
        const marker = bytes[off + 1]

        // Standalone markers (no length field)
        if (marker === 0xd8) { off += 2; continue }
        if (marker === 0xd9) { markerSequence.push('EOI'); break }
        if (marker >= 0xd0 && marker <= 0xd7) { off += 2; continue } // RST0–RST7

        if (off + 3 >= bytes.length) break
        const segLen = ((bytes[off + 2] << 8) | bytes[off + 3]) + 2

        // Record marker name
        const mname = JPEG_MARKER_NAMES[marker] ?? `APP${marker - 0xe0}`
        markerSequence.push(mname)

        if (marker === 0xe1) {
          // APP1 — check for Exif header
          if (off + 9 < bytes.length) {
            const h = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7])
            if (h.startsWith('Exif')) strippedExif = false
          }
        } else if (marker === 0xc2) {
          // SOF2 = progressive JPEG
          progressiveJpeg = true
          signals.push({
            type: 'structural',
            description: 'Progressive JPEG encoding (common on social media platforms)',
            matchedValue: 'SOF2 marker',
            confidence: 'low',
          })
        } else if (marker === 0xfe) {
          // COM = JPEG comment
          hasJpegComment = true
          const end = Math.min(off + segLen, bytes.length)
          let comment = ''
          for (let i = off + 4; i < end; i++) comment += String.fromCharCode(bytes[i])
          if (comment.startsWith('FBMD')) {
            signals.push({
              type: 'structural',
              platform: 'Facebook',
              description: 'Facebook Metadata (FBMD) block embedded in JPEG comment',
              matchedValue: comment.slice(0, 40),
              confidence: 'high',
            })
          }
        } else if (marker === 0xdb) {
          // DQT — extract luma (id=0) and chroma (id=1) tables
          let pos = off + 4
          while (pos < off + segLen - 1 && pos < bytes.length) {
            const prec = (bytes[pos] >> 4) & 0xf
            const tableId = bytes[pos] & 0xf
            pos++
            if (prec === 0) {
              const tbl = bytes.slice(pos, pos + 64)
              if (tableId === 0) lumaTable = tbl
              else if (tableId === 1) chromaTable = tbl
              pos += 64
            } else {
              pos += 128 // 16-bit precision table
            }
          }
        } else if (marker === 0xda) {
          // SOS — always the last structural marker before scan data
          markerSequence.push('EOI')
          break
        }

        off += segLen
      }

      if (strippedExif) {
        signals.push({
          type: 'structural',
          description: 'EXIF data absent — stripping EXIF is standard practice on social platforms',
          matchedValue: 'no APP1/Exif header',
          confidence: 'low',
        })
      }

      if (lumaTable) {
        qualityEquivalent = estimateQuality(Array.from(lumaTable))
      }
    }
    onProgress(40)

    // Step 3: Quantization table fingerprinting
    if (lumaTable || chromaTable) {
      const lumaHash = lumaTable ? fnv1a32(lumaTable).toString(16) : 'none'
      const chromaHash = chromaTable ? fnv1a32(chromaTable).toString(16) : 'none'
      const key = `${lumaHash}:${chromaHash}`
      const qtMatch = KNOWN_QT_FINGERPRINTS.get(key)
      if (qtMatch) {
        signals.push({
          type: 'quantization',
          platform: qtMatch.platform,
          description: `Quantization tables exactly match known ${qtMatch.platform} encoder fingerprint`,
          matchedValue: `luma=${lumaHash}, chroma=${chromaHash}`,
          confidence: qtMatch.confidence,
        })
      } else if (lumaTable) {
        // Try luma-only match (grayscale or non-standard chroma table)
        for (const [k, v] of KNOWN_QT_FINGERPRINTS) {
          if (k.split(':')[0] === lumaHash) {
            signals.push({
              type: 'quantization',
              platform: v.platform,
              description: `Luma table matches ${v.platform} fingerprint (chroma table differs)`,
              matchedValue: `luma=${lumaHash}`,
              confidence: 'medium',
            })
            break
          }
        }
      }
    }
    onProgress(55)

    // Step 4: Marker sequence fingerprinting
    if (markerSequence.length > 0) {
      const seqKey = markerSequence.join(',')
      const seqMatch = KNOWN_MARKER_SEQUENCES.get(seqKey)
      if (seqMatch) {
        signals.push({
          type: 'marker-order',
          platform: seqMatch.platform,
          description: `JPEG marker sequence matches known ${seqMatch.platform} encoding pattern`,
          matchedValue: seqKey,
          confidence: seqMatch.confidence,
        })
      } else if (markerSequence.includes('SOF2') && !markerSequence.includes('APP1')) {
        signals.push({
          type: 'marker-order',
          description: 'Progressive JPEG without EXIF APP1 — typical of social media re-encoding',
          matchedValue: seqKey,
          confidence: 'low',
        })
      }
    }
    onProgress(70)

    // Step 5: Binary string scan
    const parts: string[] = []
    const chunkSize = 65536
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, bytes.length)
      let chunk = ''
      for (let j = i; j < end; j++) {
        const b = bytes[j]
        chunk += b >= 32 && b < 127 ? String.fromCharCode(b) : ' '
      }
      parts.push(chunk)
    }
    const lower = parts.join('').toLowerCase()

    for (const plat of PLATFORM_SIGS) {
      for (const [str, conf, desc] of plat.strings) {
        const idx = lower.indexOf(str)
        if (idx !== -1) {
          signals.push({
            type: 'binary-string',
            platform: plat.platform,
            description: desc,
            matchedValue: lower.slice(idx, idx + Math.min(str.length + 30, 80)).trim(),
            offset: idx,
            confidence: conf,
          })
        }
      }
    }
    onProgress(85)

    // Step 6: Aggregate and rank
    const platMap = new Map<string, SocialMediaSignal[]>()
    for (const s of signals) {
      if (!s.platform) continue
      if (!platMap.has(s.platform)) platMap.set(s.platform, [])
      platMap.get(s.platform)!.push(s)
    }

    const candidates: SocialMediaCandidate[] = []
    for (const [platform, sigs] of platMap) {
      const conf: SignalConfidence = sigs.some((s) => s.confidence === 'high')
        ? 'high'
        : sigs.some((s) => s.confidence === 'medium')
          ? 'medium'
          : 'low'
      candidates.push({ platform, confidence: conf, signals: sigs })
    }

    const confOrder: Record<SignalConfidence, number> = { high: 0, medium: 1, low: 2 }
    candidates.sort(
      (a, b) =>
        confOrder[a.confidence] - confOrder[b.confidence] || b.signals.length - a.signals.length,
    )

    onProgress(95)

    const top = candidates[0]
    return {
      filename,
      candidates,
      topPlatform: top?.platform ?? null,
      overallConfidence: (top?.confidence ?? 'none') as SignalConfidence | 'none',
      totalSignals: signals.length,
      strippedExif,
      progressiveJpeg,
      hasJpegComment,
      markerSequence,
      qualityEquivalent,
    }
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
