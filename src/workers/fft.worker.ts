import * as Comlink from 'comlink'
import FFT from 'fft.js'

export interface FftEngineResult {
  spectrumDataUrl: string
  dominantFrequencies: Array<{ fx: number; fy: number; magnitude: number }>
}

export interface DctEngineResult {
  overlayDataUrl: string
  coefficientIndex: number
  histogramData: Array<{ value: number; count: number }>
}

export class FftWorker {
  /** 2D FFT spectrum of grayscale image */
  runFftSpectrum(
    imageData: ImageData,
    windowFn: 'none' | 'hann' | 'hamming',
    colormap: 'grayscale' | 'hot' | 'viridis',
    onProgress: (pct: number) => void,
  ): FftEngineResult {
    const { width, height } = imageData
    const gray = toGrayscale(imageData)
    onProgress(10)

    // Next power-of-2 dimensions
    const pw = nextPow2(width)
    const ph = nextPow2(height)

    // Apply window function and zero-pad
    const padded = new Float64Array(pw * ph)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const wx = windowFn === 'none' ? 1 : windowValue(windowFn, x, width)
        const wy = windowFn === 'none' ? 1 : windowValue(windowFn, y, height)
        padded[y * pw + x] = gray[y * width + x] * wx * wy
      }
    }
    onProgress(20)

    // 2D FFT via row-column decomposition
    // Real input → complex: interleaved [re, im, re, im, ...]
    const spectrum = fft2d(padded, pw, ph, onProgress)
    onProgress(85)

    // Log magnitude, DC shift to center
    const logMag = new Float32Array(pw * ph)
    let maxLog = 0
    for (let i = 0; i < pw * ph; i++) {
      const re = spectrum[i * 2]
      const im = spectrum[i * 2 + 1]
      const mag = Math.log1p(Math.sqrt(re * re + im * im))
      logMag[i] = mag
      if (mag > maxLog) maxLog = mag
    }

    // Shift DC to center (fftshift)
    const shifted = fftShift(logMag, pw, ph)

    // Crop to original size (centered)
    const ox = Math.floor((pw - width) / 2)
    const oy = Math.floor((ph - height) / 2)

    // Find top dominant frequencies (excluding DC center)
    const cx = Math.floor(width / 2)
    const cy = Math.floor(height / 2)
    const peaks: Array<{ fx: number; fy: number; magnitude: number }> = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx; const dy = y - cy
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) continue // skip DC
        const v = shifted[(y + oy) * pw + (x + ox)]
        if (peaks.length < 5 || v > (peaks[peaks.length - 1]?.magnitude ?? 0)) {
          peaks.push({ fx: dx, fy: dy, magnitude: v })
          peaks.sort((a, b) => b.magnitude - a.magnitude)
          if (peaks.length > 5) peaks.pop()
        }
      }
    }
    onProgress(92)

    // Render colormap
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = shifted[(y + oy) * pw + (x + ox)] / maxLog
        const [r, g, b] = applyColormap(v, colormap)
        const p = (y * width + x) * 4
        pixels[p] = r; pixels[p + 1] = g; pixels[p + 2] = b; pixels[p + 3] = 255
      }
    }
    onProgress(98)

    const spectrumDataUrl = pixelsToDataUrl(pixels, width, height)
    return { spectrumDataUrl, dominantFrequencies: peaks }
  }

  /** DCT coefficient viewer — 8×8 block DCT heatmap */
  runDctViewer(
    imageData: ImageData,
    coefficientIndex: number,
    channel: 'Y' | 'Cb' | 'Cr',
    onProgress: (pct: number) => void,
  ): DctEngineResult {
    const { width, height } = imageData
    onProgress(5)

    const plane = extractYCbCr(imageData, channel)
    const bw = Math.floor(width / 8)
    const bh = Math.floor(height / 8)
    const coeffMap = new Float32Array(bw * bh)
    const histBuckets = new Int32Array(512) // -256..255 mapped to 0..511

    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        // Extract 8x8 block
        const block = new Float64Array(64)
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            block[r * 8 + c] = plane[(by * 8 + r) * width + (bx * 8 + c)] - 128
          }
        }
        // 2D DCT-II
        const dct = dct2d(block)
        coeffMap[by * bw + bx] = dct[coefficientIndex]
        const bucket = Math.round(dct[coefficientIndex]) + 256
        if (bucket >= 0 && bucket < 512) histBuckets[bucket]++
      }
      if (by % 8 === 0) onProgress(5 + (by / bh) * 80)
    }
    onProgress(88)

    // Normalize and colorize coefficient map
    let minV = Infinity, maxV = -Infinity
    for (const v of coeffMap) { if (v < minV) minV = v; if (v > maxV) maxV = v }
    const range = maxV - minV || 1

    const pixels = new Uint8ClampedArray(bw * bh * 4)
    for (let i = 0; i < bw * bh; i++) {
      const v = (coeffMap[i] - minV) / range
      const [r, g, b] = divergingColormap(v)
      pixels[i * 4] = r; pixels[i * 4 + 1] = g; pixels[i * 4 + 2] = b; pixels[i * 4 + 3] = 255
    }
    onProgress(95)

    const histogramData = Array.from(histBuckets)
      .map((count, i) => ({ value: i - 256, count }))
      .filter((d) => d.count > 0)

    return {
      overlayDataUrl: pixelsToDataUrl(pixels, bw, bh),
      coefficientIndex,
      histogramData,
    }
  }
}

// ---------------------------------------------------------------------------
// DSP helpers
// ---------------------------------------------------------------------------

function toGrayscale(img: ImageData): Float32Array {
  const n = img.width * img.height
  const gray = new Float32Array(n)
  const d = img.data
  for (let i = 0; i < n; i++) {
    gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
  }
  return gray
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

function windowValue(fn: 'hann' | 'hamming', i: number, n: number): number {
  const t = (2 * Math.PI * i) / (n - 1)
  return fn === 'hann' ? 0.5 * (1 - Math.cos(t)) : 0.54 - 0.46 * Math.cos(t)
}

function fft2d(real: Float64Array, w: number, h: number, onProgress: (p: number) => void): Float64Array {
  const out = new Float64Array(w * h * 2)
  const fftW = new FFT(w)
  const fftH = new FFT(h)
  const rowBuf = fftW.createComplexArray()
  const colBuf = fftH.createComplexArray()

  // Row FFTs
  for (let y = 0; y < h; y++) {
    const rowIn = new Float64Array(w * 2)
    for (let x = 0; x < w; x++) rowIn[x * 2] = real[y * w + x]
    fftW.transform(rowBuf, rowIn)
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 2] = rowBuf[x * 2]
      out[(y * w + x) * 2 + 1] = rowBuf[x * 2 + 1]
    }
    if (y % 32 === 0) onProgress(20 + (y / h) * 30)
  }

  // Column FFTs
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      colBuf[y * 2] = out[(y * w + x) * 2]
      colBuf[y * 2 + 1] = out[(y * w + x) * 2 + 1]
    }
    const colOut = fftH.createComplexArray()
    fftH.transform(colOut, colBuf)
    for (let y = 0; y < h; y++) {
      out[(y * w + x) * 2] = colOut[y * 2]
      out[(y * w + x) * 2 + 1] = colOut[y * 2 + 1]
    }
    if (x % 32 === 0) onProgress(50 + (x / w) * 35)
  }

  return out
}

function fftShift(mag: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  const hw = Math.floor(w / 2), hh = Math.floor(h / 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ny = (y + hh) % h
      const nx = (x + hw) % w
      out[ny * w + nx] = mag[y * w + x]
    }
  }
  return out
}

// DCT-II (8x8)
const DCT_MATRIX = (() => {
  const N = 8
  const m = new Float64Array(N * N)
  for (let k = 0; k < N; k++) {
    for (let n = 0; n < N; n++) {
      const s = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N)
      m[k * N + n] = s * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N))
    }
  }
  return m
})()

function dct2d(block: Float64Array): Float64Array {
  const N = 8
  const tmp = new Float64Array(N * N)
  const out = new Float64Array(N * N)
  // Row DCT
  for (let r = 0; r < N; r++) {
    for (let k = 0; k < N; k++) {
      let s = 0
      for (let n = 0; n < N; n++) s += DCT_MATRIX[k * N + n]! * block[r * N + n]
      tmp[r * N + k] = s
    }
  }
  // Column DCT
  for (let c = 0; c < N; c++) {
    for (let k = 0; k < N; k++) {
      let s = 0
      for (let n = 0; n < N; n++) s += DCT_MATRIX[k * N + n]! * tmp[n * N + c]
      out[k * N + c] = s
    }
  }
  return out
}

function extractYCbCr(img: ImageData, channel: 'Y' | 'Cb' | 'Cr'): Float32Array {
  const n = img.width * img.height
  const d = img.data
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]
    if (channel === 'Y') out[i] = 16 + 0.257 * r + 0.504 * g + 0.098 * b
    else if (channel === 'Cb') out[i] = 128 - 0.148 * r - 0.291 * g + 0.439 * b
    else out[i] = 128 + 0.439 * r - 0.368 * g - 0.071 * b
  }
  return out
}

// Colormaps
function applyColormap(v: number, map: 'grayscale' | 'hot' | 'viridis'): [number, number, number] {
  v = Math.max(0, Math.min(1, v))
  if (map === 'grayscale') { const c = Math.round(v * 255); return [c, c, c] }
  if (map === 'hot') {
    const r = Math.min(1, v * 3)
    const g = Math.min(1, Math.max(0, v * 3 - 1))
    const b = Math.min(1, Math.max(0, v * 3 - 2))
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
  }
  // viridis (simplified 4-stop)
  const stops: Array<[number, number, number]> = [[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]]
  const t = v * (stops.length - 1)
  const lo = Math.floor(t), hi = Math.min(lo + 1, stops.length - 1)
  const f = t - lo
  const [r1,g1,b1] = stops[lo]!; const [r2,g2,b2] = stops[hi]!
  return [Math.round(r1 + (r2-r1)*f), Math.round(g1 + (g2-g1)*f), Math.round(b1 + (b2-b1)*f)]
}

function divergingColormap(v: number): [number, number, number] {
  // Blue → White → Red
  if (v < 0.5) { const t = v * 2; return [Math.round(t*255), Math.round(t*255), 255] }
  const t = (v - 0.5) * 2; return [255, Math.round((1-t)*255), Math.round((1-t)*255)]
}

// Reuse PNG encoder from ela.worker approach
function pixelsToDataUrl(pixels: Uint8ClampedArray, width: number, height: number): string {
  const png = encodePng(pixels, width, height)
  return `data:image/png;base64,${uint8ToBase64(png)}`
}

function encodePng(pixels: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const rowSize = width * 4 + 1
  const raw = new Uint8Array(rowSize * height)
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0
    raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * rowSize + 1)
  }
  const deflated = zlibStore(raw)
  const sig = new Uint8Array([137,80,78,71,13,10,26,10])
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, width); dv.setUint32(4, height)
  ihdr[8]=8; ihdr[9]=6
  const chunks = [sig, makeChunk('IHDR',ihdr), makeChunk('IDAT',deflated), makeChunk('IEND',new Uint8Array(0))]
  let total=0; for(const c of chunks) total+=c.length
  const out=new Uint8Array(total); let off=0
  for(const c of chunks){out.set(c,off);off+=c.length}
  return out
}
function makeChunk(type:string,data:Uint8Array):Uint8Array{
  const c=new Uint8Array(12+data.length); const dv=new DataView(c.buffer)
  dv.setUint32(0,data.length)
  c[4]=type.charCodeAt(0);c[5]=type.charCodeAt(1);c[6]=type.charCodeAt(2);c[7]=type.charCodeAt(3)
  c.set(data,8); dv.setUint32(8+data.length,crc32(c.subarray(4,8+data.length))); return c
}
function zlibStore(data:Uint8Array):Uint8Array{
  const B=65535,blocks=Math.ceil(data.length/B)||1
  const out=new Uint8Array(2+blocks*5+data.length+4)
  out[0]=0x78;out[1]=0x01
  let pos=2,dp=0
  for(let b=0;b<blocks;b++){
    const last=b===blocks-1,bl=Math.min(B,data.length-dp)
    out[pos++]=last?1:0;out[pos++]=bl&0xff;out[pos++]=(bl>>8)&0xff
    out[pos++]=(~bl)&0xff;out[pos++]=((~bl)>>8)&0xff
    out.set(data.subarray(dp,dp+bl),pos);pos+=bl;dp+=bl
  }
  let s1=1,s2=0; for(const b of data){s1=(s1+b)%65521;s2=(s2+s1)%65521}
  out[pos++]=(s2>>8)&0xff;out[pos++]=s2&0xff;out[pos++]=(s1>>8)&0xff;out[pos]=s1&0xff
  return out
}
const CT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c}return t})()
function crc32(b:Uint8Array):number{let c=0xffffffff;for(const x of b)c=CT[(c^x)&0xff]!^(c>>>8);return(c^0xffffffff)>>>0}
function uint8ToBase64(b:Uint8Array):string{let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s)}

Comlink.expose(new FftWorker())
