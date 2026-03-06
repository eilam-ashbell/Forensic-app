import * as Comlink from 'comlink'

export interface CloneMatch { srcX: number; srcY: number; dstX: number; dstY: number; confidence: number }
export interface CloneDetectorResult { overlayDataUrl: string; matches: CloneMatch[]; matchCount: number }

export class CloneWorker {
  // -------------------------------------------------------------------------
  // Keypoint-based clone detection
  // Harris corners → NCC patch matching → ratio test → spatial clustering
  // -------------------------------------------------------------------------
  runKeypointClone(
    imageData: ImageData,
    maxKeypoints: number,
    ratioThreshold: number,
    minClusterSize: number,
    onProgress: (p: number) => void,
  ): CloneDetectorResult {
    const { width, height } = imageData
    const gray = toGrayscale(imageData)
    onProgress(5)

    // Downsample for speed if large image
    let w = width, h = height, scale = 1
    if (w * h > 2_000_000) {
      scale = Math.sqrt(2_000_000 / (w * h))
      w = Math.round(w * scale); h = Math.round(h * scale)
    }
    const grayS = scale < 1 ? downsample(gray, width, height, w, h) : gray
    onProgress(10)

    // Harris corner detection
    const corners = harrisCorners(grayS, w, h, maxKeypoints)
    onProgress(25)

    // Extract 16×16 normalized patches as descriptors
    const PATCH = 16
    const half = PATCH >> 1
    const valid = corners.filter(
      (c) => c.x >= half && c.x < w - half && c.y >= half && c.y < h - half,
    )
    const descriptors = valid.map((c) => extractPatch(grayS, w, c.x, c.y, half))
    onProgress(40)

    // Brute-force NCC matching (lower NCC diff = better match)
    const MIN_SPATIAL_DIST = 32 // pixels in scaled space
    const matches: CloneMatch[] = []
    const n = descriptors.length
    for (let i = 0; i < n; i++) {
      let best1 = Infinity, best2 = Infinity, bestJ = -1
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const dx = valid[i]!.x - valid[j]!.x, dy = valid[i]!.y - valid[j]!.y
        if (Math.sqrt(dx * dx + dy * dy) < MIN_SPATIAL_DIST) continue
        const dist = nccDist(descriptors[i]!, descriptors[j]!)
        if (dist < best1) { best2 = best1; best1 = dist; bestJ = j }
        else if (dist < best2) best2 = dist
      }
      // Lowe's ratio test
      if (bestJ !== -1 && best1 < ratioThreshold * best2) {
        const inv = 1 / scale
        matches.push({
          srcX: Math.round(valid[i]!.x * inv),
          srcY: Math.round(valid[i]!.y * inv),
          dstX: Math.round(valid[bestJ]!.x * inv),
          dstY: Math.round(valid[bestJ]!.y * inv),
          confidence: 1 - best1,
        })
      }
      if (i % 20 === 0) onProgress(40 + (i / n) * 40)
    }
    onProgress(82)

    // Filter: keep only clustered matches (those near other matches)
    const CLUSTER_RADIUS = 50
    const clustered = matches.filter((m) => {
      const near = matches.filter(
        (o) => Math.abs(o.srcX - m.srcX) < CLUSTER_RADIUS && Math.abs(o.srcY - m.srcY) < CLUSTER_RADIUS,
      ).length
      return near >= minClusterSize
    })
    onProgress(90)

    const overlay = renderMatchOverlay(clustered, width, height)
    return { overlayDataUrl: pixelsToDataUrl(overlay, width, height), matches: clustered.slice(0, 200), matchCount: clustered.length }
  }

  // -------------------------------------------------------------------------
  // Block-matching clone detection
  // Exhaustive SSD on downsampled image
  // -------------------------------------------------------------------------
  runBlockMatchingClone(
    imageData: ImageData,
    blockSize: number,
    stride: number,
    similarityThreshold: number,
    minOffset: number,
    onProgress: (p: number) => void,
  ): CloneDetectorResult {
    const { width, height } = imageData

    // Cap at 512×512
    let w = width, h = height, scale = 1
    if (w > 512 || h > 512) {
      scale = Math.min(512 / w, 512 / h)
      w = Math.round(w * scale); h = Math.round(h * scale)
    }
    const gray = toGrayscale(imageData)
    const grayS = scale < 1 ? downsample(gray, width, height, w, h) : gray
    onProgress(8)

    const bw = Math.floor((w - blockSize) / stride)
    const bh = Math.floor((h - blockSize) / stride)
    const matches: CloneMatch[] = []
    const MIN_OFFSET_S = Math.round(minOffset * scale)

    for (let bi = 0; bi < bh; bi++) {
      const y1 = bi * stride
      for (let bj = 0; bj < bw; bj++) {
        const x1 = bj * stride
        const blockA = extractBlock(grayS, w, x1, y1, blockSize)
        const normA = normalizeBlock(blockA)

        let bestSSD = Infinity, bestX = -1, bestY = -1
        for (let ci = 0; ci < bh; ci++) {
          const y2 = ci * stride
          for (let cj = 0; cj < bw; cj++) {
            const x2 = cj * stride
            const dx = x2 - x1, dy = y2 - y1
            if (Math.sqrt(dx * dx + dy * dy) < MIN_OFFSET_S) continue
            const blockB = extractBlock(grayS, w, x2, y2, blockSize)
            const normB = normalizeBlock(blockB)
            const ssd = computeSSD(normA, normB)
            if (ssd < bestSSD) { bestSSD = ssd; bestX = x2; bestY = y2 }
          }
        }

        if (bestSSD < similarityThreshold && bestX !== -1) {
          const inv = 1 / scale
          matches.push({
            srcX: Math.round(x1 * inv), srcY: Math.round(y1 * inv),
            dstX: Math.round(bestX * inv), dstY: Math.round(bestY * inv),
            confidence: 1 - bestSSD,
          })
        }
      }
      if (bi % 4 === 0) onProgress(8 + (bi / bh) * 82)
    }
    onProgress(92)

    const overlay = renderMatchOverlay(matches, width, height)
    return { overlayDataUrl: pixelsToDataUrl(overlay, width, height), matches: matches.slice(0, 200), matchCount: matches.length }
  }
}

// ---------------------------------------------------------------------------
// Harris corner detection
// ---------------------------------------------------------------------------
function harrisCorners(gray: Float32Array, w: number, h: number, maxK: number): Array<{x:number;y:number;score:number}> {
  const Ix = new Float32Array(w * h), Iy = new Float32Array(w * h)
  // Sobel
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      Ix[i] = (-gray[i - w - 1]! - 2 * gray[i - 1]! - gray[i + w - 1]! +
                 gray[i - w + 1]! + 2 * gray[i + 1]! + gray[i + w + 1]!) / 8
      Iy[i] = (-gray[i - w - 1]! - 2 * gray[i - w]! - gray[i - w + 1]! +
                 gray[i + w - 1]! + 2 * gray[i + w]! + gray[i + w + 1]!) / 8
    }
  }
  // Harris response R = det(M) - k*trace(M)^2
  const k = 0.04, WIN = 2
  const R = new Float32Array(w * h)
  for (let y = WIN; y < h - WIN; y++) {
    for (let x = WIN; x < w - WIN; x++) {
      let xx = 0, yy = 0, xy = 0
      for (let dy = -WIN; dy <= WIN; dy++) {
        for (let dx = -WIN; dx <= WIN; dx++) {
          const i = (y + dy) * w + (x + dx)
          xx += Ix[i]! * Ix[i]!; yy += Iy[i]! * Iy[i]!; xy += Ix[i]! * Iy[i]!
        }
      }
      R[y * w + x] = xx * yy - xy * xy - k * (xx + yy) * (xx + yy)
    }
  }
  // Non-maximum suppression (3x3 window) + threshold
  const thresh = R.reduce((a, b) => Math.max(a, b), 0) * 0.01
  const corners: Array<{x:number;y:number;score:number}> = []
  for (let y = WIN + 1; y < h - WIN - 1; y++) {
    for (let x = WIN + 1; x < w - WIN - 1; x++) {
      const r = R[y * w + x]!
      if (r < thresh) continue
      let isMax = true
      for (let dy = -1; dy <= 1 && isMax; dy++)
        for (let dx = -1; dx <= 1 && isMax; dx++)
          if (dy !== 0 || dx !== 0) if (R[(y+dy)*w+(x+dx)]! >= r) isMax = false
      if (isMax) corners.push({ x, y, score: r })
    }
  }
  corners.sort((a, b) => b.score - a.score)
  return corners.slice(0, maxK)
}

function extractPatch(gray: Float32Array, w: number, cx: number, cy: number, half: number): Float32Array {
  const size = half * 2
  const patch = new Float32Array(size * size)
  let sum = 0, sum2 = 0
  for (let dy = -half; dy < half; dy++)
    for (let dx = -half; dx < half; dx++) {
      const v = gray[(cy + dy) * w + (cx + dx)]!
      const i = (dy + half) * size + (dx + half)
      patch[i] = v; sum += v; sum2 += v * v
    }
  const n = size * size, mean = sum / n, std = Math.sqrt(Math.max(0, sum2 / n - mean * mean)) || 1
  for (let i = 0; i < n; i++) patch[i] = (patch[i]! - mean) / std
  return patch
}

function nccDist(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!
  return 1 - Math.max(-1, Math.min(1, dot / a.length))
}

// ---------------------------------------------------------------------------
// Block matching helpers
// ---------------------------------------------------------------------------
function extractBlock(gray: Float32Array, w: number, x: number, y: number, size: number): Float32Array {
  const b = new Float32Array(size * size)
  for (let r = 0; r < size; r++) b.set(gray.subarray((y + r) * w + x, (y + r) * w + x + size), r * size)
  return b
}
function normalizeBlock(b: Float32Array): Float32Array {
  let s = 0, s2 = 0
  for (const v of b) { s += v; s2 += v * v }
  const n = b.length, mean = s / n, std = Math.sqrt(Math.max(0, s2 / n - mean * mean)) || 1
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = (b[i]! - mean) / std
  return out
}
function computeSSD(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) { const d = a[i]! - b[i]!; s += d * d }
  return s / a.length
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderMatchOverlay(matches: CloneMatch[], w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  for (const m of matches) {
    // Draw source region (cyan)
    drawRect(out, w, h, m.srcX - 8, m.srcY - 8, 16, 16, [0, 255, 255, 200])
    // Draw destination region (magenta)
    drawRect(out, w, h, m.dstX - 8, m.dstY - 8, 16, 16, [255, 0, 255, 200])
  }
  return out
}
function drawRect(out: Uint8ClampedArray, w: number, h: number, x: number, y: number, rw: number, rh: number, color: [number,number,number,number]) {
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      const px = x + dx, py = y + dy
      if (px < 0 || px >= w || py < 0 || py >= h) continue
      const onBorder = dx === 0 || dy === 0 || dx === rw - 1 || dy === rh - 1
      if (!onBorder) continue
      const p = (py * w + px) * 4
      out[p] = color[0]; out[p+1] = color[1]; out[p+2] = color[2]; out[p+3] = color[3]
    }
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function toGrayscale(img: ImageData): Float32Array {
  const n = img.width * img.height, d = img.data, g = new Float32Array(n)
  for (let i = 0; i < n; i++) g[i] = 0.299 * d[i*4]! + 0.587 * d[i*4+1]! + 0.114 * d[i*4+2]!
  return g
}
function downsample(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh)
  const sx = sw / dw, sy = sh / dh
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const ox = Math.floor(x * sx), oy = Math.floor(y * sy)
      out[y * dw + x] = src[oy * sw + ox]!
    }
  }
  return out
}

// PNG encoder (reused pattern)
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

Comlink.expose(new CloneWorker())
