// ---------------------------------------------------------------------------
// Tool identifiers — the canonical list of all 20 tools
// ---------------------------------------------------------------------------

export const TOOL_IDS = [
  'metadata-viewer',
  'file-structure-inspector',
  'jpeg-quantization',
  'block-artifact-visualizer',
  'ela',
  'multi-quality-ela',
  'noise-map',
  'prnu',
  'fft-spectrum',
  'dct-viewer',
  'keypoint-clone',
  'block-matching-clone',
  'channel-separator',
  'chromatic-aberration',
  'lighting-estimator',
  'histogram-analyzer',
  'lsb-visualizer',
  'stego-stats',
  'ai-forgery-detector',
  'hex-viewer',
  'string-extractor',
] as const

export type ToolId = (typeof TOOL_IDS)[number]

// ---------------------------------------------------------------------------
// Tool status
// ---------------------------------------------------------------------------

export type ToolStatus = 'idle' | 'running' | 'done' | 'error'

// ---------------------------------------------------------------------------
// Per-tool result shapes (discriminated union keyed by toolId)
// ---------------------------------------------------------------------------

export interface MetadataEntry {
  key: string
  value: string | number | boolean | null
  group: string
  forensicFlag?: boolean
}

export interface FileChunk {
  offset: number
  length: number
  type: string
  description: string
  raw?: string
}

export interface QuantizationTable {
  id: number
  coefficients: number[] // 64 values (8x8 flattened)
  estimatedQuality: number
  encoderHint?: string
}

export interface BlockArtifactResult {
  overlayDataUrl: string
  averageStrength: number
}

export interface ElaResult {
  overlayDataUrl: string
  maxDifference: number
  meanDifference: number
  params: { quality: number; amplify: number }
}

export interface MultiElaResult {
  results: Array<{ quality: number; overlayDataUrl: string; meanDifference: number }>
  compositeDataUrl: string
}

export interface NoiseMapResult {
  overlayDataUrl: string
  meanNoise: number
}

export interface PrnuResult {
  residualDataUrl: string
  correlationDataUrl: string
}

export interface FftResult {
  spectrumDataUrl: string
  dominantFrequencies: Array<{ fx: number; fy: number; magnitude: number }>
}

export interface DctResult {
  overlayDataUrl: string
  coefficientIndex: number
  histogramData: Array<{ value: number; count: number }>
}

export interface CloneMatch {
  srcX: number
  srcY: number
  dstX: number
  dstY: number
  confidence: number
}

export interface CloneDetectorResult {
  overlayDataUrl: string
  matches: CloneMatch[]
  matchCount: number
}

export interface ChannelResult {
  channel: string
  colorSpace: string
  dataUrl: string
  min: number
  max: number
  mean: number
  stdDev: number
}

export interface HistogramBin {
  value: number
  r: number
  g: number
  b: number
  gray?: number
}

export interface HistogramResult {
  bins: HistogramBin[]
  channels: string[]
}

export interface CaBlock {
  cx: number
  cy: number
  dx: number
  dy: number
  magnitude: number
  isAnomalous: boolean
  confidence: number
}

export interface ChromaticAberrationResult {
  overlayDataUrl: string
  blocks: CaBlock[]
  consistencyScore: number
  anomalyCount: number
  meanMagnitude: number
  blockSize: number
}

export interface LightingResult {
  overlayDataUrl: string
  estimatedAngleDegrees: number
  confidence: number
}

export interface LsbResult {
  overlayDataUrl: string
  channel: string
  bitPlane: number
  randomnessScore: number
}

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

export interface HexLine {
  offset: number
  hex: string[]
  ascii: string
}

export interface StringMatch {
  offset: number
  encoding: 'ascii' | 'utf16le'
  value: string
  length: number
}

// Discriminated union of all tool results

export type ToolResult =
  | { toolId: 'metadata-viewer'; entries: MetadataEntry[] }
  | { toolId: 'file-structure-inspector'; chunks: FileChunk[] }
  | { toolId: 'jpeg-quantization'; tables: QuantizationTable[] }
  | { toolId: 'block-artifact-visualizer'; data: BlockArtifactResult }
  | { toolId: 'ela'; data: ElaResult }
  | { toolId: 'multi-quality-ela'; data: MultiElaResult }
  | { toolId: 'noise-map'; data: NoiseMapResult }
  | { toolId: 'prnu'; data: PrnuResult }
  | { toolId: 'fft-spectrum'; data: FftResult }
  | { toolId: 'dct-viewer'; data: DctResult }
  | { toolId: 'keypoint-clone'; data: CloneDetectorResult }
  | { toolId: 'block-matching-clone'; data: CloneDetectorResult }
  | { toolId: 'channel-separator'; channels: ChannelResult[] }
  | { toolId: 'chromatic-aberration'; data: ChromaticAberrationResult }
  | { toolId: 'lighting-estimator'; data: LightingResult }
  | { toolId: 'histogram-analyzer'; data: HistogramResult }
  | { toolId: 'lsb-visualizer'; data: LsbResult }
  | { toolId: 'stego-stats'; tests: StegoTestResult[] }
  | { toolId: 'ai-forgery-detector'; data: AiForgeryResult }
  | { toolId: 'hex-viewer'; lines: HexLine[]; totalBytes: number }
  | { toolId: 'string-extractor'; strings: StringMatch[] }
