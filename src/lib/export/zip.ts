/**
 * ZIP export — bundles all completed tool results into a downloadable ZIP:
 *   manifest.json, original image, overlays/<tool>.png, data/<tool>.json
 */
import JSZip from 'jszip'
import type { ToolId, ToolResult } from '../../types/tools'
import type { ImageRecord } from '../../types/image'
import { TOOL_REGISTRY } from '../../constants/tools'
import type { ToolState } from '../../types/session'

/** Extract overlay/image data URLs from a result (returns empty array if none) */
function extractDataUrls(result: ToolResult): Array<{ name: string; dataUrl: string }> {
  const out: Array<{ name: string; dataUrl: string }> = []

  switch (result.toolId) {
    case 'ela':
      out.push({ name: 'overlay', dataUrl: result.data.overlayDataUrl })
      break
    case 'multi-quality-ela':
      result.data.results.forEach((r) =>
        out.push({ name: `q${r.quality}`, dataUrl: r.overlayDataUrl }),
      )
      out.push({ name: 'composite', dataUrl: result.data.compositeDataUrl })
      break
    case 'noise-map':
    case 'dct-viewer':
    case 'block-artifact-visualizer':
    case 'lsb-visualizer':
    case 'lighting-estimator':
    case 'ai-forgery-detector':
      out.push({ name: 'overlay', dataUrl: result.data.overlayDataUrl })
      break
    case 'fft-spectrum':
      out.push({ name: 'spectrum', dataUrl: result.data.spectrumDataUrl })
      break
    case 'prnu':
      out.push({ name: 'residual', dataUrl: result.data.residualDataUrl })
      out.push({ name: 'correlation', dataUrl: result.data.correlationDataUrl })
      break
    case 'keypoint-clone':
    case 'block-matching-clone':
      out.push({ name: 'overlay', dataUrl: result.data.overlayDataUrl })
      break
    case 'channel-separator':
      result.channels.forEach((ch) =>
        out.push({ name: ch.channel.toLowerCase(), dataUrl: ch.dataUrl }),
      )
      break
    default:
      break
  }

  return out
}

/** Convert a base64 data URL to a Uint8Array */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Strip data URLs from result JSON (they're saved separately as PNGs) */
function stripDataUrls(obj: unknown): unknown {
  if (typeof obj === 'string' && obj.startsWith('data:')) return '[data-url omitted — see overlays/]'
  if (Array.isArray(obj)) return obj.map(stripDataUrls)
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, stripDataUrls(v)]),
    )
  }
  return obj
}

export interface ExportBundleOptions {
  image: ImageRecord
  toolStates: Record<ToolId, ToolState>
  sessionName: string
}

export async function buildZipBundle(opts: ExportBundleOptions): Promise<Blob> {
  const { image, toolStates, sessionName } = opts
  const zip = new JSZip()
  const timestamp = new Date().toISOString()

  // Original image
  const imgBytes = new Uint8Array(image.arrayBuffer)
  const ext = image.isJpeg ? 'jpg' : image.isPng ? 'png' : 'bin'
  zip.file(`original.${ext}`, imgBytes)

  const completedTools = TOOL_REGISTRY.filter(
    (t) => toolStates[t.id].status === 'done' && toolStates[t.id].result !== null,
  )

  const overlaysFolder = zip.folder('overlays')!
  const dataFolder = zip.folder('data')!

  const manifestTools: Array<{
    id: ToolId
    label: string
    status: string
    executionMs: number | null
    overlays: string[]
  }> = []

  for (const tool of completedTools) {
    const state = toolStates[tool.id]
    const result = state.result!

    // Save data JSON (strip data URLs)
    const cleanResult = stripDataUrls(result)
    dataFolder.file(`${tool.id}.json`, JSON.stringify(cleanResult, null, 2))

    // Save overlay images
    const urls = extractDataUrls(result)
    const overlayNames: string[] = []
    for (const { name, dataUrl } of urls) {
      const filename = `${tool.id}__${name}.png`
      overlaysFolder.file(filename, dataUrlToBytes(dataUrl))
      overlayNames.push(filename)
    }

    manifestTools.push({
      id: tool.id,
      label: tool.label,
      status: state.status,
      executionMs: state.executionMs,
      overlays: overlayNames,
    })
  }

  // manifest.json
  const manifest = {
    version: '1.0',
    generatedAt: timestamp,
    sessionName,
    image: {
      name: image.file.name,
      size: image.file.size,
      type: image.file.type,
      dimensions: image.dimensions,
      megapixels: image.megapixels,
      sha256: image.sha256,
      md5: image.md5,
    },
    tools: manifestTools,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
