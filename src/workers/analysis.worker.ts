import * as Comlink from 'comlink'

// ---------------------------------------------------------------------------
// Result types (inline to avoid cross-worker imports)
// ---------------------------------------------------------------------------
export interface NoiseMapResult { overlayDataUrl: string; meanNoise: number }
export interface BlockArtifactResult { overlayDataUrl: string; averageStrength: number }
export interface ChannelResult {
  channel: string; colorSpace: string; dataUrl: string
  min: number; max: number; mean: number; stdDev: number
}
export interface HistogramBin { value: number; r: number; g: number; b: number }
export interface HistogramResult { bins: HistogramBin[]; channels: string[] }
export interface LsbResult { overlayDataUrl: string; channel: string; bitPlane: number; randomnessScore: number }
export interface CaBlock { cx: number; cy: number; dx: number; dy: number; magnitude: number; isAnomalous: boolean; confidence: number }
export interface ChromaticAberrationResult { overlayDataUrl: string; blocks: CaBlock[]; consistencyScore: number; anomalyCount: number; meanMagnitude: number; blockSize: number }

export class AnalysisWorker {

  // -------------------------------------------------------------------------
  // Noise Map: Gaussian blur → subtract → amplify
  // -------------------------------------------------------------------------
  noiseMap(
    imageData: ImageData,
    kernelSize: number,
    amplify: number,
    onProgress: (p: number) => void,
  ): NoiseMapResult {
    const { width, height, data } = imageData
    onProgress(5)
    const sigma = kernelSize / 2
    const blurred = gaussianBlur(data, width, height, sigma, kernelSize)
    onProgress(60)

    const out = new Uint8ClampedArray(width * height * 4)
    let sum = 0
    const n = width * height
    for (let i = 0; i < n; i++) {
      const p = i * 4
      const dr = Math.abs(data[p] - blurred[p])
      const dg = Math.abs(data[p + 1] - blurred[p + 1])
      const db = Math.abs(data[p + 2] - blurred[p + 2])
      const noise = (dr + dg + db) / 3
      sum += noise
      const v = Math.min(255, Math.round(noise * amplify))
      out[p] = v; out[p + 1] = v; out[p + 2] = v; out[p + 3] = 255
    }
    onProgress(95)
    return { overlayDataUrl: pixelsToDataUrl(out, width, height), meanNoise: sum / n }
  }

  // -------------------------------------------------------------------------
  // Block Artifact Visualizer: Sobel gradient at 8px boundaries
  // -------------------------------------------------------------------------
  blockArtifact(
    imageData: ImageData,
    threshold: number,
    onProgress: (p: number) => void,
  ): BlockArtifactResult {
    const { width, height, data } = imageData
    const gray = new Float32Array(width * height)
    for (let i = 0; i < width * height; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    }
    onProgress(20)

    const out = new Uint8ClampedArray(width * height * 4)
    let sumStrength = 0, count = 0

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const atBoundary = (x % 8 === 0) || (y % 8 === 0)
        if (!atBoundary) continue

        // Sobel magnitude
        const gx =
          -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] +
          -2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] +
          -gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)]
        const gy =
          -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
          gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)]
        const mag = Math.sqrt(gx * gx + gy * gy)

        sumStrength += mag; count++
        const v = Math.min(255, Math.round(mag * (255 / (threshold * 4 || 120))))
        const p = (y * width + x) * 4
        out[p] = v; out[p + 1] = 0; out[p + 2] = 0; out[p + 3] = v > 20 ? 200 : 0
      }
      if (y % 32 === 0) onProgress(20 + (y / height) * 70)
    }
    onProgress(98)
    return { overlayDataUrl: pixelsToDataUrl(out, width, height), averageStrength: count ? sumStrength / count : 0 }
  }

  // -------------------------------------------------------------------------
  // Channel Separator
  // -------------------------------------------------------------------------
  channelSeparator(
    imageData: ImageData,
    colorSpace: 'rgb' | 'hsv' | 'lab' | 'ycbcr',
    channels: string[],
    onProgress: (p: number) => void,
  ): ChannelResult[] {
    const { width, height, data } = imageData
    const n = width * height
    onProgress(5)

    const results: ChannelResult[] = []
    const allChannels = getChannelNames(colorSpace)

    for (let ci = 0; ci < allChannels.length; ci++) {
      const name = allChannels[ci]
      if (channels.length > 0 && !channels.includes(name.toLowerCase())) continue

      const plane = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
        plane[i] = getChannel(r, g, b, colorSpace, ci)
      }

      let min = Infinity, max = -Infinity, sum = 0, sum2 = 0
      for (const v of plane) {
        if (v < min) min = v; if (v > max) max = v
        sum += v; sum2 += v * v
      }
      const mean = sum / n
      const stdDev = Math.sqrt(sum2 / n - mean * mean)

      // Normalize to 0-255 for display
      const range = max - min || 1
      const pixels = new Uint8ClampedArray(n * 4)
      for (let i = 0; i < n; i++) {
        const v = Math.round(((plane[i] - min) / range) * 255)
        pixels[i * 4] = v; pixels[i * 4 + 1] = v; pixels[i * 4 + 2] = v; pixels[i * 4 + 3] = 255
      }

      onProgress(5 + ((ci + 1) / allChannels.length) * 90)
      results.push({ channel: name, colorSpace, dataUrl: pixelsToDataUrl(pixels, width, height), min, max, mean, stdDev })
    }

    return results
  }

  // -------------------------------------------------------------------------
  // Histogram Analyzer
  // -------------------------------------------------------------------------
  histogram(imageData: ImageData, onProgress: (p: number) => void): HistogramResult {
    const { data, width, height } = imageData
    const n = width * height
    const rBins = new Uint32Array(256)
    const gBins = new Uint32Array(256)
    const bBins = new Uint32Array(256)

    for (let i = 0; i < n; i++) {
      rBins[data[i * 4]]++
      gBins[data[i * 4 + 1]]++
      bBins[data[i * 4 + 2]]++
    }
    onProgress(90)

    const bins: HistogramBin[] = []
    for (let v = 0; v < 256; v++) bins.push({ value: v, r: rBins[v], g: gBins[v], b: bBins[v] })
    return { bins, channels: ['r', 'g', 'b'] }
  }

  // -------------------------------------------------------------------------
  // LSB Plane Visualizer
  // -------------------------------------------------------------------------
  lsbPlane(
    imageData: ImageData,
    channel: 'r' | 'g' | 'b' | 'a',
    bitPlane: number,
    onProgress: (p: number) => void,
  ): LsbResult {
    const { width, height, data } = imageData
    const n = width * height
    const ci = { r: 0, g: 1, b: 2, a: 3 }[channel]
    const out = new Uint8ClampedArray(n * 4)

    let ones = 0
    for (let i = 0; i < n; i++) {
      const bit = (data[i * 4 + ci] >> bitPlane) & 1
      const v = bit * 255
      ones += bit
      out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255
    }
    onProgress(90)

    // Randomness score: proportion of 1s (0.5 = perfectly random)
    const proportion = ones / n
    const randomnessScore = 1 - Math.abs(proportion - 0.5) * 2

    return { overlayDataUrl: pixelsToDataUrl(out, width, height), channel, bitPlane, randomnessScore }
  }

  // -------------------------------------------------------------------------
  // Chromatic Aberration Analyzer: block-wise gradient centroid shift (R vs G)
  // Inconsistent CA vectors across blocks indicate retouched or composited regions.
  // -------------------------------------------------------------------------
  chromaticAberration(
    imageData: ImageData,
    blockSize: number,
    anomalyThreshold: number,
    arrowScale: number,
    onProgress: (p: number) => void,
  ): ChromaticAberrationResult {
    const { width, height, data } = imageData
    onProgress(5)

    const cols = Math.ceil(width / blockSize)
    const rows = Math.ceil(height / blockSize)
    const blocks: CaBlock[] = []

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const bx = col * blockSize
        const by = row * blockSize
        const bw = Math.min(blockSize, width - bx)
        const bh = Math.min(blockSize, height - by)

        // Gradient-weighted centroid for R and G channels
        let sumWR = 0, sumWX_R = 0, sumWY_R = 0
        let sumWG = 0, sumWX_G = 0, sumWY_G = 0

        for (let py = by; py < by + bh; py++) {
          for (let px = bx; px < bx + bw; px++) {
            const idx = (py * width + px) * 4

            // R channel (offset 0) gradient via finite differences
            const rL = px > 0 ? data[idx - 4]! : data[idx]!
            const rR = px < width - 1 ? data[idx + 4]! : data[idx]!
            const rU = py > 0 ? data[idx - width * 4]! : data[idx]!
            const rD = py < height - 1 ? data[idx + width * 4]! : data[idx]!
            const wR = Math.abs(rR - rL) + Math.abs(rD - rU)
            sumWR += wR; sumWX_R += wR * px; sumWY_R += wR * py

            // G channel (offset 1) gradient
            const gL = px > 0 ? data[idx - 3]! : data[idx + 1]!
            const gRr = px < width - 1 ? data[idx + 5]! : data[idx + 1]!
            const gU = py > 0 ? data[idx - width * 4 + 1]! : data[idx + 1]!
            const gD = py < height - 1 ? data[idx + width * 4 + 1]! : data[idx + 1]!
            const wG = Math.abs(gRr - gL) + Math.abs(gD - gU)
            sumWG += wG; sumWX_G += wG * px; sumWY_G += wG * py
          }
        }

        const cx = bx + bw / 2
        const cy = by + bh / 2
        let dx = 0, dy = 0
        if (sumWR > 0 && sumWG > 0) {
          dx = sumWX_R / sumWR - sumWX_G / sumWG
          dy = sumWY_R / sumWR - sumWY_G / sumWG
        }
        const magnitude = Math.sqrt(dx * dx + dy * dy)
        const confidence = Math.min(1, sumWG / (bw * bh * 10))

        blocks.push({ cx, cy, dx, dy, magnitude, isAnomalous: false, confidence })
      }
      onProgress(5 + 60 * (row + 1) / rows)
    }

    onProgress(68)

    // Anomaly detection: flag blocks whose CA vector deviates from the median
    const goodBlocks = blocks.filter(b => b.confidence > 0.05)
    let anomalyCount = 0
    let meanMagnitude = 0
    let consistencyScore = 1

    if (goodBlocks.length > 0) {
      const dxArr = goodBlocks.map(b => b.dx).slice().sort((a, b) => a - b)
      const dyArr = goodBlocks.map(b => b.dy).slice().sort((a, b) => a - b)
      const mid = Math.floor(goodBlocks.length / 2)
      const medDx = goodBlocks.length % 2 === 0
        ? (dxArr[mid - 1]! + dxArr[mid]!) / 2 : dxArr[mid]!
      const medDy = goodBlocks.length % 2 === 0
        ? (dyArr[mid - 1]! + dyArr[mid]!) / 2 : dyArr[mid]!

      for (const b of goodBlocks) {
        const devX = b.dx - medDx
        const devY = b.dy - medDy
        b.isAnomalous = Math.sqrt(devX * devX + devY * devY) > anomalyThreshold
        if (b.isAnomalous) anomalyCount++
      }

      meanMagnitude = goodBlocks.reduce((s, b) => s + b.magnitude, 0) / goodBlocks.length
      consistencyScore = 1 - anomalyCount / goodBlocks.length
    }

    onProgress(78)

    // Render overlay: transparent background, red fill for anomalous blocks, coloured arrows
    const out = new Uint8ClampedArray(width * height * 4) // all zeros = fully transparent

    // Semi-transparent red highlight for anomalous blocks
    for (const b of blocks) {
      if (!b.isAnomalous) continue
      const x0 = Math.max(0, Math.round(b.cx - blockSize / 2))
      const y0 = Math.max(0, Math.round(b.cy - blockSize / 2))
      const x1 = Math.min(width - 1, x0 + blockSize - 1)
      const y1 = Math.min(height - 1, y0 + blockSize - 1)
      for (let oy = y0; oy <= y1; oy++) {
        for (let ox = x0; ox <= x1; ox++) {
          const idx = (oy * width + ox) * 4
          out[idx] = 200; out[idx + 1] = 30; out[idx + 2] = 30; out[idx + 3] = 50
        }
      }
    }

    // Draw CA arrows using Bresenham lines
    for (const b of blocks) {
      if (b.confidence <= 0.05) continue
      const ax1 = Math.round(b.cx)
      const ay1 = Math.round(b.cy)
      const ax2 = Math.round(b.cx + b.dx * arrowScale)
      const ay2 = Math.round(b.cy + b.dy * arrowScale)
      const alpha = Math.max(140, Math.min(255, Math.round(b.confidence * 255)))
      const cr = b.isAnomalous ? 255 : 80
      const cg = b.isAnomalous ? 80 : 220
      const cb = 80
      caDrawLine(out, width, height, ax1, ay1, ax2, ay2, cr, cg, cb, alpha)
      // Center dot
      if (ax1 >= 0 && ax1 < width && ay1 >= 0 && ay1 < height) {
        const di = (ay1 * width + ax1) * 4
        out[di] = cr; out[di + 1] = cg; out[di + 2] = cb; out[di + 3] = alpha
      }
    }

    onProgress(95)

    return {
      overlayDataUrl: pixelsToDataUrl(out, width, height),
      blocks,
      consistencyScore,
      anomalyCount,
      meanMagnitude,
      blockSize,
    }
  }
}

// ---------------------------------------------------------------------------
// Image processing helpers
// ---------------------------------------------------------------------------

function gaussianBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sigma: number,
  kernelSize: number,
): Uint8ClampedArray {
  const k = Math.max(1, Math.floor(kernelSize / 2))
  const kernel = buildGaussianKernel(sigma, k)
  const tmp = new Float32Array(width * height * 4)
  const out = new Uint8ClampedArray(width * height * 4)

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sr = 0, sg = 0, sb = 0, sw = 0
      for (let dx = -k; dx <= k; dx++) {
        const xx = Math.max(0, Math.min(width - 1, x + dx))
        const w = kernel[dx + k]!
        const p = (y * width + xx) * 4
        sr += data[p] * w; sg += data[p + 1] * w; sb += data[p + 2] * w; sw += w
      }
      const p = (y * width + x) * 4
      tmp[p] = sr / sw; tmp[p + 1] = sg / sw; tmp[p + 2] = sb / sw; tmp[p + 3] = data[p + 3]
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sr = 0, sg = 0, sb = 0, sw = 0
      for (let dy = -k; dy <= k; dy++) {
        const yy = Math.max(0, Math.min(height - 1, y + dy))
        const w = kernel[dy + k]!
        const p = (yy * width + x) * 4
        sr += tmp[p] * w; sg += tmp[p + 1] * w; sb += tmp[p + 2] * w; sw += w
      }
      const p = (y * width + x) * 4
      out[p] = sr / sw; out[p + 1] = sg / sw; out[p + 2] = sb / sw; out[p + 3] = 255
    }
  }
  return out
}

function buildGaussianKernel(sigma: number, k: number): Float32Array {
  const size = 2 * k + 1
  const kernel = new Float32Array(size)
  let sum = 0
  for (let i = 0; i < size; i++) {
    const x = i - k
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma))
    sum += kernel[i]
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum
  return kernel
}

function getChannelNames(cs: string): string[] {
  switch (cs) {
    case 'rgb': return ['R', 'G', 'B']
    case 'hsv': return ['H', 'S', 'V']
    case 'lab': return ['L', 'A', 'B']
    case 'ycbcr': return ['Y', 'Cb', 'Cr']
    default: return ['R', 'G', 'B']
  }
}

function getChannel(r: number, g: number, b: number, cs: string, ci: number): number {
  const rn = r / 255, gn = g / 255, bn = b / 255
  if (cs === 'rgb') return [r, g, b][ci] ?? 0
  if (cs === 'hsv') {
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min
    const v = max
    const s = max === 0 ? 0 : d / max
    let h = 0
    if (d > 0) {
      if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
      else if (max === gn) h = ((bn - rn) / d + 2) / 6
      else h = ((rn - gn) / d + 4) / 6
    }
    return ([h * 360, s * 255, v * 255])[ci] ?? 0
  }
  if (cs === 'lab') {
    // sRGB → linear → XYZ → Lab
    const [rl, gl, bl2] = [rn, gn, bn].map((c) => c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92)
    const X = (rl! * 0.4124 + gl! * 0.3576 + bl2! * 0.1805) / 0.95047
    const Y = (rl! * 0.2126 + gl! * 0.7152 + bl2! * 0.0722) / 1.00000
    const Z = (rl! * 0.0193 + gl! * 0.1192 + bl2! * 0.9505) / 1.08883
    const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
    const L = 116 * f(Y) - 16
    const A = 500 * (f(X) - f(Y))
    const B = 200 * (f(Y) - f(Z))
    return ([L, A + 128, B + 128])[ci] ?? 0
  }
  if (cs === 'ycbcr') {
    const Y = 16 + 0.257 * r + 0.504 * g + 0.098 * b
    const Cb = 128 - 0.148 * r - 0.291 * g + 0.439 * b
    const Cr = 128 + 0.439 * r - 0.368 * g - 0.071 * b
    return ([Y, Cb, Cr])[ci] ?? 0
  }
  return 0
}

// PNG encoder (same as ela.worker)
function pixelsToDataUrl(pixels: Uint8ClampedArray, w: number, h: number): string {
  return `data:image/png;base64,${uint8ToBase64(encodePng(pixels, w, h))}`
}
function encodePng(pixels: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const rs = w * 4 + 1; const raw = new Uint8Array(rs * h)
  for (let y = 0; y < h; y++) { raw[y * rs] = 0; raw.set(pixels.subarray(y * w * 4, (y + 1) * w * 4), y * rs + 1) }
  const df = zlibStore(raw)
  const sig = new Uint8Array([137,80,78,71,13,10,26,10])
  const ih = new Uint8Array(13); const dv = new DataView(ih.buffer)
  dv.setUint32(0, w); dv.setUint32(4, h); ih[8]=8; ih[9]=6
  const cs = [sig, mc('IHDR',ih), mc('IDAT',df), mc('IEND',new Uint8Array(0))]
  let tot=0; for(const c of cs) tot+=c.length
  const out=new Uint8Array(tot); let off=0; for(const c of cs){out.set(c,off);off+=c.length}; return out
}
function mc(t:string,d:Uint8Array):Uint8Array{
  const c=new Uint8Array(12+d.length); const dv=new DataView(c.buffer)
  dv.setUint32(0,d.length); c[4]=t.charCodeAt(0);c[5]=t.charCodeAt(1);c[6]=t.charCodeAt(2);c[7]=t.charCodeAt(3)
  c.set(d,8); dv.setUint32(8+d.length,crc32(c.subarray(4,8+d.length))); return c
}
function zlibStore(data:Uint8Array):Uint8Array{
  const B=65535,bk=Math.ceil(data.length/B)||1
  const out=new Uint8Array(2+bk*5+data.length+4); out[0]=0x78;out[1]=0x01
  let pos=2,dp=0
  for(let b=0;b<bk;b++){
    const last=b===bk-1,bl=Math.min(B,data.length-dp)
    out[pos++]=last?1:0;out[pos++]=bl&0xff;out[pos++]=(bl>>8)&0xff
    out[pos++]=(~bl)&0xff;out[pos++]=((~bl)>>8)&0xff
    out.set(data.subarray(dp,dp+bl),pos);pos+=bl;dp+=bl
  }
  let s1=1,s2=0; for(const b of data){s1=(s1+b)%65521;s2=(s2+s1)%65521}
  out[pos++]=(s2>>8)&0xff;out[pos++]=s2&0xff;out[pos++]=(s1>>8)&0xff;out[pos]=s1&0xff; return out
}
const CT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c}return t})()
function crc32(b:Uint8Array):number{let c=0xffffffff;for(const x of b)c=CT[(c^x)&0xff]!^(c>>>8);return(c^0xffffffff)>>>0}
function uint8ToBase64(b:Uint8Array):string{let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s)}

// Bresenham line drawing into an RGBA Uint8ClampedArray (used by chromaticAberration)
function caDrawLine(
  buf: Uint8ClampedArray, w: number, h: number,
  x0: number, y0: number, x1: number, y1: number,
  r: number, g: number, b: number, a: number,
): void {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  for (;;) {
    if (x0 >= 0 && x0 < w && y0 >= 0 && y0 < h) {
      const idx = (y0 * w + x0) * 4
      buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = a
    }
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx) { err += dx; y0 += sy }
  }
}

Comlink.expose(new AnalysisWorker())
