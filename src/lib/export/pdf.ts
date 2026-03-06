/**
 * PDF report export using jsPDF.
 * Builds a paginated report: cover page → per-tool sections.
 */
import { jsPDF } from 'jspdf'
import type { ToolId, ToolResult } from '../../types/tools'
import type { ImageRecord } from '../../types/image'
import { TOOL_REGISTRY } from '../../constants/tools'
import type { ToolState } from '../../types/session'

const PAGE_W = 210 // A4 mm
const PAGE_H = 297
const MARGIN = 15
const CONTENT_W = PAGE_W - MARGIN * 2

function hex(r: number, g: number, b: number) {
  return [r, g, b] as [number, number, number]
}

const C_BG = hex(24, 24, 27)     // zinc-900
const C_SURFACE = hex(39, 39, 42) // zinc-800
const C_ACCENT = hex(96, 165, 250) // blue-400
const C_TEXT = hex(228, 228, 231)  // zinc-200
const C_MUTED = hex(113, 113, 122) // zinc-500

/** Draw a filled rectangle */
function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: [number, number, number]) {
  doc.setFillColor(...color)
  doc.rect(x, y, w, h, 'F')
}

/** Write text with given color */
function text(
  doc: jsPDF,
  str: string,
  x: number,
  y: number,
  color: [number, number, number],
  size: number,
  style: 'normal' | 'bold' = 'normal',
) {
  doc.setTextColor(...color)
  doc.setFontSize(size)
  doc.setFont('helvetica', style)
  doc.text(str, x, y)
}

/** Add a cover page */
function addCoverPage(
  doc: jsPDF,
  image: ImageRecord,
  sessionName: string,
  completedCount: number,
) {
  fillRect(doc, 0, 0, PAGE_W, PAGE_H, C_BG)
  fillRect(doc, 0, 0, PAGE_W, 60, C_SURFACE)

  text(doc, 'IFW', MARGIN, 25, C_ACCENT, 28, 'bold')
  text(doc, 'Image Forensics Workbench', MARGIN, 35, C_TEXT, 16, 'bold')
  text(doc, 'Analysis Report', MARGIN, 44, C_MUTED, 11)

  const dateStr = new Date().toLocaleString()
  text(doc, dateStr, PAGE_W - MARGIN, 44, C_MUTED, 9)
  doc.setTextColor(...C_MUTED)
  doc.setFontSize(9)
  doc.text(dateStr, PAGE_W - MARGIN, 44, { align: 'right' })

  // Session info
  const rows = [
    ['Session', sessionName || '(unnamed)'],
    ['File', image.file.name],
    ['Dimensions', `${image.dimensions.width} × ${image.dimensions.height} px`],
    ['Megapixels', `${image.megapixels.toFixed(2)} MP`],
    ['File size', `${(image.file.size / 1024).toFixed(1)} KB`],
    ['SHA-256', image.sha256],
    ['Tools run', String(completedCount)],
  ]

  let y = 78
  for (const [label, value] of rows) {
    text(doc, label, MARGIN, y, C_MUTED, 8)
    const val = value.length > 60 ? value.slice(0, 57) + '...' : value
    text(doc, val, MARGIN + 32, y, C_TEXT, 8)
    y += 8
  }

  text(doc, 'Sections follow on subsequent pages.', MARGIN, y + 12, C_MUTED, 8)
}

/** Convert data URL to format usable by jsPDF */
function dataUrlFormat(dataUrl: string): string {
  if (dataUrl.includes('image/png')) return 'PNG'
  if (dataUrl.includes('image/jpeg')) return 'JPEG'
  return 'PNG'
}

/** Add a tool section page */
function addToolPage(
  doc: jsPDF,
  tool: { id: ToolId; label: string; description: string },
  state: ToolState,
) {
  doc.addPage()
  fillRect(doc, 0, 0, PAGE_W, PAGE_H, C_BG)

  // Section header bar
  fillRect(doc, 0, 0, PAGE_W, 20, C_SURFACE)
  text(doc, tool.label, MARGIN, 13, C_ACCENT, 12, 'bold')
  if (state.executionMs !== null) {
    text(doc, `${state.executionMs} ms`, PAGE_W - MARGIN, 13, C_MUTED, 8)
    doc.setTextColor(...C_MUTED)
    doc.setFontSize(8)
    doc.text(`${state.executionMs} ms`, PAGE_W - MARGIN, 13, { align: 'right' })
  }

  // Description
  text(doc, tool.description, MARGIN, 27, C_MUTED, 8)

  let curY = 36
  const result = state.result
  if (!result) return

  // Add overlay images
  const imgEntries = getImageEntries(result)
  for (const { label, dataUrl } of imgEntries) {
    if (curY > PAGE_H - 60) {
      doc.addPage()
      fillRect(doc, 0, 0, PAGE_W, PAGE_H, C_BG)
      curY = MARGIN
    }
    try {
      const fmt = dataUrlFormat(dataUrl)
      // Compute proportional dimensions (max width = CONTENT_W/2)
      const maxW = CONTENT_W / 2
      doc.addImage(dataUrl, fmt, MARGIN, curY, maxW, 0)
      // Get natural image height
      const props = doc.getImageProperties(dataUrl)
      const ratio = props.height / props.width
      const drawH = maxW * ratio
      curY += drawH + 4
    } catch {
      // skip if image fails
    }
    text(doc, label, MARGIN, curY, C_MUTED, 7)
    curY += 6
  }

  // Add text summary rows
  const summaryRows = getSummaryRows(result)
  if (summaryRows.length > 0) {
    if (curY > PAGE_H - 30) {
      doc.addPage()
      fillRect(doc, 0, 0, PAGE_W, PAGE_H, C_BG)
      curY = MARGIN
    }
    curY += 4
    for (const [label, value] of summaryRows) {
      if (curY > PAGE_H - 10) break
      text(doc, label + ':', MARGIN, curY, C_MUTED, 8)
      text(doc, String(value), MARGIN + 45, curY, C_TEXT, 8)
      curY += 6
    }
  }
}

function getImageEntries(result: ToolResult): Array<{ label: string; dataUrl: string }> {
  switch (result.toolId) {
    case 'ela':
      return [{ label: 'ELA Overlay', dataUrl: result.data.overlayDataUrl }]
    case 'multi-quality-ela':
      return [
        ...result.data.results.map((r) => ({
          label: `ELA Q${r.quality}`,
          dataUrl: r.overlayDataUrl,
        })),
        { label: 'Composite', dataUrl: result.data.compositeDataUrl },
      ]
    case 'noise-map':
      return [{ label: 'Noise Map', dataUrl: result.data.overlayDataUrl }]
    case 'fft-spectrum':
      return [{ label: 'FFT Spectrum', dataUrl: result.data.spectrumDataUrl }]
    case 'dct-viewer':
      return [{ label: 'DCT Overlay', dataUrl: result.data.overlayDataUrl }]
    case 'block-artifact-visualizer':
      return [{ label: 'Block Artifacts', dataUrl: result.data.overlayDataUrl }]
    case 'lsb-visualizer':
      return [{ label: `LSB ${result.data.channel.toUpperCase()} plane ${result.data.bitPlane}`, dataUrl: result.data.overlayDataUrl }]
    case 'lighting-estimator':
      return [{ label: 'Lighting Direction', dataUrl: result.data.overlayDataUrl }]
    case 'ai-forgery-detector':
      return [{ label: 'Forgery Heatmap', dataUrl: result.data.overlayDataUrl }]
    case 'prnu':
      return [
        { label: 'PRNU Residual', dataUrl: result.data.residualDataUrl },
        { label: 'Autocorrelation', dataUrl: result.data.correlationDataUrl },
      ]
    case 'keypoint-clone':
    case 'block-matching-clone':
      return [{ label: 'Clone Detection Overlay', dataUrl: result.data.overlayDataUrl }]
    case 'channel-separator':
      return result.channels.map((ch) => ({ label: ch.channel, dataUrl: ch.dataUrl }))
    default:
      return []
  }
}

function getSummaryRows(result: ToolResult): Array<[string, string | number]> {
  switch (result.toolId) {
    case 'ela':
      return [
        ['Quality', result.data.params.quality],
        ['Amplify', `${result.data.params.amplify}×`],
        ['Max diff', result.data.maxDifference],
        ['Mean diff', result.data.meanDifference],
      ]
    case 'noise-map':
      return [['Mean noise', result.data.meanNoise.toFixed(2)]]
    case 'fft-spectrum':
      return result.data.dominantFrequencies.slice(0, 3).map((f, i) => [
        `Peak ${i + 1}`,
        `fx=${f.fx} fy=${f.fy} mag=${f.magnitude.toFixed(2)}`,
      ])
    case 'block-artifact-visualizer':
      return [['Avg boundary strength', result.data.averageStrength.toFixed(2)]]
    case 'lsb-visualizer':
      return [
        ['Channel', result.data.channel.toUpperCase()],
        ['Bit plane', result.data.bitPlane],
        ['Randomness', `${(result.data.randomnessScore * 100).toFixed(1)}%`],
      ]
    case 'lighting-estimator':
      return [
        ['Estimated angle', `${result.data.estimatedAngleDegrees}°`],
        ['Confidence', `${(result.data.confidence * 100).toFixed(1)}%`],
      ]
    case 'keypoint-clone':
    case 'block-matching-clone':
      return [['Matches found', result.data.matchCount]]
    case 'ai-forgery-detector':
      return [
        ['Global score', `${(result.data.globalScore * 100).toFixed(1)}%`],
        ['Confidence', `${(result.data.confidence * 100).toFixed(0)}%`],
      ]
    case 'stego-stats':
      return result.tests.map((t) => [
        t.test,
        t.interpretation,
      ])
    case 'metadata-viewer':
      return [['Entries', result.entries.length], ['Flagged', result.entries.filter((e) => e.forensicFlag).length]]
    case 'jpeg-quantization':
      return result.tables.map((t) => [`Table ${t.id} quality`, `${t.estimatedQuality}%`])
    default:
      return []
  }
}

export interface PdfExportOptions {
  image: ImageRecord
  toolStates: Record<ToolId, ToolState>
  sessionName: string
}

export function buildPdfReport(opts: PdfExportOptions): Blob {
  const { image, toolStates, sessionName } = opts
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const completedTools = TOOL_REGISTRY.filter(
    (t) => toolStates[t.id].status === 'done' && toolStates[t.id].result !== null,
  )

  addCoverPage(doc, image, sessionName, completedTools.length)

  for (const tool of completedTools) {
    addToolPage(doc, tool, toolStates[tool.id])
  }

  return doc.output('blob')
}
