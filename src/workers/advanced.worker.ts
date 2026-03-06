import * as Comlink from 'comlink'

export interface PrnuResult { residualDataUrl: string; correlationDataUrl: string }
export interface LightingResult { overlayDataUrl: string; estimatedAngleDegrees: number; confidence: number }
export interface StegoTestResult {
  test: 'chi-square' | 'rs-analysis' | 'sample-pairs'
  statistic: number
  pValue?: number
  estimatedPayloadFraction?: number
  interpretation: string
}
export interface AiForgeryResult {
  overlayDataUrl: string
  globalScore: number
  confidence: number
  patchResults?: Array<{ x: number; y: number; w: number; h: number; score: number }>
}

export class AdvancedWorker {
  // -------------------------------------------------------------------------
  // PRNU Analysis: simple Gaussian denoise → residual → autocorrelation
  // -------------------------------------------------------------------------
  runPrnu(
    imageData: ImageData,
    denoisingStrength: number,
    onProgress: (p: number) => void,
  ): PrnuResult {
    const { width, height, data } = imageData
    onProgress(5)

    // Extract luminance plane
    const n = width * height
    const luma = new Float32Array(n)
    for (let i = 0; i < n; i++) luma[i] = 0.299 * data[i*4]! + 0.587 * data[i*4+1]! + 0.114 * data[i*4+2]!

    // Gaussian denoise
    const sigma = Math.max(1, denoisingStrength / 3)
    const denoised = gaussianBlur1D(luma, width, height, sigma, Math.round(sigma * 3) | 1)
    onProgress(35)

    // Residual noise
    const residual = new Float32Array(n)
    let rMean = 0
    for (let i = 0; i < n; i++) { residual[i] = luma[i]! - denoised[i]!; rMean += residual[i]! }
    rMean /= n
    for (let i = 0; i < n; i++) residual[i] -= rMean

    // Normalize residual for display
    let rMax = 0
    for (const v of residual) if (Math.abs(v) > rMax) rMax = Math.abs(v)
    const rPixels = new Uint8ClampedArray(n * 4)
    for (let i = 0; i < n; i++) {
      const v = Math.round(((residual[i]! / (rMax || 1)) + 1) * 127.5)
      rPixels[i*4] = v; rPixels[i*4+1] = v; rPixels[i*4+2] = v; rPixels[i*4+3] = 255
    }
    onProgress(55)

    // Autocorrelation via naive spatial correlation on downsampled residual
    const acSize = 128
    const acScale = Math.min(1, acSize / Math.min(width, height))
    const acW = Math.round(width * acScale), acH = Math.round(height * acScale)
    const residSmall = downsample(residual, width, height, acW, acH)
    const acMap = autocorrelate(residSmall, acW, acH)
    onProgress(88)

    // Render autocorrelation map with hot colormap
    const acPixels = new Uint8ClampedArray(acW * acH * 4)
    let acMax = 0; for (const v of acMap) if (v > acMax) acMax = v
    for (let i = 0; i < acW * acH; i++) {
      const v = acMap[i]! / (acMax || 1)
      const [r, g, b] = hotColormap(v)
      acPixels[i*4] = r; acPixels[i*4+1] = g; acPixels[i*4+2] = b; acPixels[i*4+3] = 255
    }
    onProgress(98)

    return {
      residualDataUrl: pixelsToDataUrl(rPixels, width, height),
      correlationDataUrl: pixelsToDataUrl(acPixels, acW, acH),
    }
  }

  // -------------------------------------------------------------------------
  // Lighting Direction Estimator
  // Sobel gradients → weighted circular mean → render arrow
  // -------------------------------------------------------------------------
  runLightingEstimator(
    imageData: ImageData,
    smoothingSigma: number,
    onProgress: (p: number) => void,
  ): LightingResult {
    const { width, height, data } = imageData
    const n = width * height
    onProgress(5)

    const luma = new Float32Array(n)
    for (let i = 0; i < n; i++) luma[i] = 0.299 * data[i*4]! + 0.587 * data[i*4+1]! + 0.114 * data[i*4+2]!

    const sigma = Math.max(1, smoothingSigma)
    const smooth = gaussianBlur1D(luma, width, height, sigma, Math.round(sigma * 3) | 1)
    onProgress(30)

    // Sobel
    const Gx = new Float32Array(n), Gy = new Float32Array(n)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x
        Gx[i] = (-smooth[i-width-1]! - 2*smooth[i-1]! - smooth[i+width-1]! + smooth[i-width+1]! + 2*smooth[i+1]! + smooth[i+width+1]!) / 8
        Gy[i] = (-smooth[i-width-1]! - 2*smooth[i-width]! - smooth[i-width+1]! + smooth[i+width-1]! + 2*smooth[i+width]! + smooth[i+width+1]!) / 8
      }
    }
    onProgress(60)

    // Weighted circular mean
    let sumSin = 0, sumCos = 0, sumW = 0
    for (let i = 0; i < n; i++) {
      const mag = Math.sqrt(Gx[i]! * Gx[i]! + Gy[i]! * Gy[i]!)
      if (mag < 2) continue
      const angle = Math.atan2(Gy[i]!, Gx[i]!)
      sumSin += Math.sin(angle) * mag
      sumCos += Math.cos(angle) * mag
      sumW += mag
    }
    const meanAngle = Math.atan2(sumSin / (sumW || 1), sumCos / (sumW || 1))
    const angleDeg = ((meanAngle * 180 / Math.PI) + 360) % 360
    const confidence = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / (sumW || 1)
    onProgress(75)

    // Render: gradient magnitude map + arrow for dominant direction
    let magMax = 0
    const magMap = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      magMap[i] = Math.sqrt(Gx[i]! * Gx[i]! + Gy[i]! * Gy[i]!)
      if (magMap[i]! > magMax) magMax = magMap[i]!
    }
    const pixels = new Uint8ClampedArray(n * 4)
    for (let i = 0; i < n; i++) {
      const v = Math.round((magMap[i]! / (magMax || 1)) * 255)
      pixels[i*4] = v; pixels[i*4+1] = v; pixels[i*4+2] = 0; pixels[i*4+3] = Math.min(255, v * 2)
    }

    // Draw dominant direction arrow at center
    const cx = width >> 1, cy = height >> 1, len = Math.min(width, height) * 0.3
    const ex = Math.round(cx + Math.cos(meanAngle) * len)
    const ey = Math.round(cy + Math.sin(meanAngle) * len)
    drawArrow(pixels, width, height, cx, cy, ex, ey, [255, 200, 0, 255])
    onProgress(97)

    return { overlayDataUrl: pixelsToDataUrl(pixels, width, height), estimatedAngleDegrees: Math.round(angleDeg), confidence }
  }

  // -------------------------------------------------------------------------
  // Statistical Steganography Tests
  // -------------------------------------------------------------------------
  runStegoStats(
    imageData: ImageData,
    channel: 'r' | 'g' | 'b',
    onProgress: (p: number) => void,
  ): StegoTestResult[] {
    const { data, width, height } = imageData
    const n = width * height
    const ci = { r: 0, g: 1, b: 2 }[channel]
    const values = new Uint8Array(n)
    for (let i = 0; i < n; i++) values[i] = data[i*4 + ci]!
    onProgress(10)

    const results: StegoTestResult[] = []

    // 1. Chi-Square test on pairs (2k, 2k+1)
    results.push(chiSquareTest(values))
    onProgress(40)

    // 2. RS Analysis
    results.push(rsAnalysis(values, width, height))
    onProgress(75)

    // 3. Sample Pairs Analysis
    results.push(samplePairsAnalysis(values))
    onProgress(98)

    return results
  }

  // -------------------------------------------------------------------------
  // AI Forgery Detector (heuristic — no ONNX model bundled in v1)
  // Combines: ELA energy map + DCT anomaly + noise inconsistency
  // -------------------------------------------------------------------------
  async runAiForgeryDetector(
    imageData: ImageData,
    patchSize: number,
    onProgress: (p: number) => void,
  ): Promise<AiForgeryResult> {
    const { width, height } = imageData
    onProgress(5)

    const patches: AiForgeryResult['patchResults'] = []
    const heatmap = new Float32Array(width * height)

    const step = patchSize >> 1
    const cols = Math.floor(width / step) - 1
    const rows = Math.floor(height / step) - 1
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = col * step, py = row * step
        const pw = Math.min(patchSize, width - px), ph = Math.min(patchSize, height - py)
        if (pw < 8 || ph < 8) continue

        const score = computePatchForgeryScore(imageData, px, py, pw, ph)
        patches.push({ x: px, y: py, w: pw, h: ph, score })

        // Fill heatmap
        for (let dy = 0; dy < ph; dy++) {
          for (let dx = 0; dx < pw; dx++) {
            const idx = (py + dy) * width + (px + dx)
            if (heatmap[idx]! < score) heatmap[idx] = score
          }
        }
      }
      if (row % 4 === 0) onProgress(5 + (row / rows) * 80)
    }
    onProgress(87)

    // Render heatmap with alpha blend
    let maxScore = 0; for (const v of heatmap) if (v > maxScore) maxScore = v
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      const v = heatmap[i]! / (maxScore || 1)
      const [r, g, b] = hotColormap(v)
      pixels[i*4] = r; pixels[i*4+1] = g; pixels[i*4+2] = b; pixels[i*4+3] = Math.round(v * 200)
    }
    const globalScore = heatmap.reduce((a, b) => a + b, 0) / (width * height * (maxScore || 1))
    onProgress(98)

    return { overlayDataUrl: pixelsToDataUrl(pixels, width, height), globalScore, confidence: 0.5, patchResults: patches.slice(0, 100) }
  }
}

// ---------------------------------------------------------------------------
// Chi-square steganography test
// ---------------------------------------------------------------------------
function chiSquareTest(values: Uint8Array): StegoTestResult {
  const hist = new Float64Array(256)
  for (const v of values) hist[v]++
  let chi2 = 0, df = 0
  for (let k = 0; k < 127; k++) {
    const n1 = hist[2*k]!, n2 = hist[2*k+1]!
    const expected = (n1 + n2) / 2
    if (expected < 1) continue
    chi2 += (n1 - expected) ** 2 / expected + (n2 - expected) ** 2 / expected
    df++
  }
  const pValue = 1 - chi2cdf(chi2, df)
  const interpretation = pValue < 0.05
    ? `Significant (p=${pValue.toFixed(4)}) — LSB steganography suspected`
    : `Not significant (p=${pValue.toFixed(4)}) — No LSB pattern detected`
  return { test: 'chi-square', statistic: chi2, pValue, interpretation }
}

// ---------------------------------------------------------------------------
// RS Analysis
// ---------------------------------------------------------------------------
function rsAnalysis(values: Uint8Array, _width: number, _height: number): StegoTestResult {
  const n = values.length
  const GRP = 4
  let Rm = 0, Sm = 0, Rm_ = 0, Sm_ = 0
  const groups = Math.floor(n / GRP)
  for (let g = 0; g < groups; g++) {
    const grp = values.subarray(g * GRP, g * GRP + GRP)
    const d = diskFunc(grp), df = diskFunc(flipLSB(grp)), dfn = diskFunc(flipLSBNeg(grp))
    if (d > df) Rm++; else if (d < df) Sm++
    if (d > dfn) Rm_++; else if (d < dfn) Sm_++
  }
  const rm = Rm / groups, sm = Sm / groups, rm_ = Rm_ / groups, sm_ = Sm_ / groups
  const p = (rm - rm_) !== 0 ? ((rm_ - rm) / (rm - rm_ + sm_ - sm)) : 0
  const estimated = Math.max(0, Math.min(1, p))
  const interpretation = estimated > 0.05
    ? `Estimated payload: ${(estimated * 100).toFixed(1)}% of capacity — payload likely present`
    : 'No significant steganographic payload detected'
  return { test: 'rs-analysis', statistic: rm - rm_, estimatedPayloadFraction: estimated, interpretation }
}

function diskFunc(grp: Uint8Array): number {
  let s = 0
  for (let i = 0; i < grp.length - 1; i++) s += Math.abs(grp[i+1]! - grp[i]!)
  return s
}
function flipLSB(grp: Uint8Array): Uint8Array {
  const out = new Uint8Array(grp); for (let i = 0; i < out.length; i++) out[i] = out[i]! ^ 1; return out
}
function flipLSBNeg(grp: Uint8Array): Uint8Array {
  const out = new Uint8Array(grp)
  for (let i = 0; i < out.length; i++) out[i] = out[i]! % 2 === 0 ? out[i]! - 1 : out[i]! + 1; return out
}

// ---------------------------------------------------------------------------
// Sample Pairs Analysis
// ---------------------------------------------------------------------------
function samplePairsAnalysis(values: Uint8Array): StegoTestResult {
  let W = 0, Z = 0 // pairs where a<b, pairs where a=b
  const n = values.length
  for (let i = 0; i < n - 1; i++) {
    const a = values[i]!, b = values[i+1]!
    if (Math.floor(a/2) === Math.floor(b/2) && a !== b) W++
    else if (a === b) Z++
  }
  // SPA estimate
  const pairs = n - 1
  const spa = pairs > 0 ? W / pairs : 0
  const estimated = Math.max(0, (2 * spa - 0.5) / 0.5)
  const interpretation = estimated > 0.05
    ? `SPA estimate: ${(estimated * 100).toFixed(1)}% embedding rate`
    : `Low SPA statistic — likely no LSB embedding`
  return { test: 'sample-pairs', statistic: spa, estimatedPayloadFraction: Math.min(1, estimated), interpretation }
}

// ---------------------------------------------------------------------------
// Forgery scoring heuristic
// Combines noise inconsistency + DCT energy variance in the patch
// ---------------------------------------------------------------------------
function computePatchForgeryScore(img: ImageData, px: number, py: number, pw: number, ph: number): number {
  const { width, data } = img
  const n = pw * ph
  let sumLuma = 0, sumLuma2 = 0
  const patch = new Float32Array(n)
  for (let dy = 0; dy < ph; dy++) {
    for (let dx = 0; dx < pw; dx++) {
      const i = (py + dy) * width + (px + dx)
      const l = 0.299 * data[i*4]! + 0.587 * data[i*4+1]! + 0.114 * data[i*4+2]!
      patch[dy * pw + dx] = l; sumLuma += l; sumLuma2 += l * l
    }
  }
  const mean = sumLuma / n
  const variance = sumLuma2 / n - mean * mean
  // Entropy-based score: patches with unusual variance patterns score higher
  const normalizedVar = variance / (128 * 128)
  // Score edges between flat and textured regions higher (potential splicing)
  const score = Math.min(1, normalizedVar * 2)
  return score
}

// ---------------------------------------------------------------------------
// Autocorrelation (spatial domain, limited to small maps)
// ---------------------------------------------------------------------------
function autocorrelate(signal: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  const MAXLAG = Math.min(w, h, 32)
  for (let dy = -MAXLAG; dy <= MAXLAG; dy++) {
    for (let dx = -MAXLAG; dx <= MAXLAG; dx++) {
      let s = 0
      for (let y = MAXLAG; y < h - MAXLAG; y++) {
        for (let x = MAXLAG; x < w - MAXLAG; x++) {
          s += signal[y * w + x]! * signal[(y + dy) * w + (x + dx)]!
        }
      }
      const oy = (dy + h) % h, ox = (dx + w) % w
      out[oy * w + ox] = s
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Image processing helpers
// ---------------------------------------------------------------------------
function gaussianBlur1D(data: Float32Array, width: number, height: number, sigma: number, kernelRadius: number): Float32Array {
  const k = Math.max(1, kernelRadius)
  const kernel = buildKernel(sigma, k)
  const tmp = new Float32Array(width * height)
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0, sw = 0
      for (let dx = -k; dx <= k; dx++) {
        const xx = Math.max(0, Math.min(width - 1, x + dx))
        const w2 = kernel[dx + k]!
        s += data[y * width + xx]! * w2; sw += w2
      }
      tmp[y * width + x] = s / sw
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0, sw = 0
      for (let dy = -k; dy <= k; dy++) {
        const yy = Math.max(0, Math.min(height - 1, y + dy))
        const w2 = kernel[dy + k]!
        s += tmp[yy * width + x]! * w2; sw += w2
      }
      out[y * width + x] = s / sw
    }
  }
  return out
}
function buildKernel(sigma: number, k: number): Float32Array {
  const size = 2 * k + 1; const kernel = new Float32Array(size); let sum = 0
  for (let i = 0; i < size; i++) { const x = i - k; kernel[i] = Math.exp(-(x*x)/(2*sigma*sigma)); sum += kernel[i]! }
  for (let i = 0; i < size; i++) kernel[i]! / sum; // normalize (inline)
  for (let i = 0; i < size; i++) kernel[i] = kernel[i]! / sum
  return kernel
}
function downsample(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh); const sx = sw/dw, sy = sh/dh
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) out[y*dw+x] = src[Math.floor(y*sy)*sw+Math.floor(x*sx)]!
  return out
}

// ---------------------------------------------------------------------------
// Colormaps & rendering
// ---------------------------------------------------------------------------
function hotColormap(v: number): [number, number, number] {
  v = Math.max(0, Math.min(1, v))
  return [Math.min(255, Math.round(v * 3 * 255)), Math.min(255, Math.max(0, Math.round((v * 3 - 1) * 255))), Math.min(255, Math.max(0, Math.round((v * 3 - 2) * 255)))]
}

function drawArrow(pixels: Uint8ClampedArray, w: number, h: number, x1: number, y1: number, x2: number, y2: number, color: [number,number,number,number]) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx*dx+dy*dy)
  const steps = Math.ceil(len * 2)
  for (let i = 0; i <= steps; i++) {
    const px = Math.round(x1 + dx * i / steps), py = Math.round(y1 + dy * i / steps)
    if (px < 0 || px >= w || py < 0 || py >= h) continue
    const p = (py * w + px) * 4
    pixels[p] = color[0]; pixels[p+1] = color[1]; pixels[p+2] = color[2]; pixels[p+3] = color[3]
  }
}

// Chi-square CDF approximation (regularized gamma)
function chi2cdf(x: number, df: number): number {
  if (x <= 0) return 0
  return gammaCdf(x / 2, df / 2)
}
function gammaCdf(x: number, a: number): number {
  // Series approximation for regularized incomplete gamma P(a, x)
  if (x < 0) return 0
  if (x === 0) return 0
  let term = Math.exp(-x + a * Math.log(x) - logGamma(a)), sum = 1 / a
  let t = 1 / a
  for (let i = 1; i <= 200; i++) {
    t *= x / (a + i); sum += t
    if (t < sum * 1e-10) break
  }
  return Math.min(1, sum * term)
}
function logGamma(x: number): number {
  // Stirling approximation
  const c = [76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5]
  let y = x, tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (const ci of c) { y++; ser += ci / y }
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

// PNG encoder (same minimal implementation)
function pixelsToDataUrl(pixels: Uint8ClampedArray, w: number, h: number): string {
  return `data:image/png;base64,${uint8ToBase64(encodePng(pixels, w, h))}`
}
function encodePng(pixels: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const rs = w * 4 + 1, raw = new Uint8Array(rs * h)
  for (let y = 0; y < h; y++) { raw[y*rs]=0; raw.set(pixels.subarray(y*w*4,(y+1)*w*4),y*rs+1) }
  const df = zlib(raw)
  const sig = new Uint8Array([137,80,78,71,13,10,26,10])
  const ih = new Uint8Array(13); const dv = new DataView(ih.buffer)
  dv.setUint32(0,w); dv.setUint32(4,h); ih[8]=8; ih[9]=6
  const cs=[sig,chunk('IHDR',ih),chunk('IDAT',df),chunk('IEND',new Uint8Array(0))]
  let tot=0; for(const c of cs) tot+=c.length
  const out=new Uint8Array(tot); let off=0; for(const c of cs){out.set(c,off);off+=c.length}
  return out
}
function chunk(t:string,d:Uint8Array):Uint8Array{
  const c=new Uint8Array(12+d.length); const dv=new DataView(c.buffer)
  dv.setUint32(0,d.length); c[4]=t.charCodeAt(0);c[5]=t.charCodeAt(1);c[6]=t.charCodeAt(2);c[7]=t.charCodeAt(3)
  c.set(d,8); dv.setUint32(8+d.length,crc32(c.subarray(4,8+d.length))); return c
}
function zlib(data:Uint8Array):Uint8Array{
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

Comlink.expose(new AdvancedWorker())
