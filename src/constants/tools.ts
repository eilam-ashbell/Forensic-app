import type { ToolId } from '../types/tools'

export type ToolCategory =
  | 'File & Metadata'
  | 'Compression Analysis'
  | 'Error Level Analysis'
  | 'Noise Analysis'
  | 'Frequency Domain'
  | 'Clone & Copy-Move'
  | 'Color & Lighting'
  | 'Steganography'
  | 'AI Detection'
  | 'Raw Inspection'

export interface ToolMeta {
  id: ToolId
  label: string
  category: ToolCategory
  description: string
  jpegOnly?: boolean
}

export const TOOL_REGISTRY: ToolMeta[] = [
  // File & Metadata
  {
    id: 'metadata-viewer',
    label: 'Metadata Viewer',
    category: 'File & Metadata',
    description: 'Extract EXIF, GPS, IPTC, XMP, and makernote fields',
  },
  {
    id: 'file-structure-inspector',
    label: 'File Structure Inspector',
    category: 'File & Metadata',
    description: 'Raw bytes, file signatures, chunk maps, entropy visualization',
  },
  // Compression Analysis
  {
    id: 'jpeg-quantization',
    label: 'JPEG Quantization Tables',
    category: 'Compression Analysis',
    description: 'Extract & fingerprint quantization tables, detect double-compression',
    jpegOnly: true,
  },
  {
    id: 'block-artifact-visualizer',
    label: 'Block Artifact Visualizer',
    category: 'Compression Analysis',
    description: 'Visualize JPEG 8×8 DCT block boundaries and artifact strength',
    jpegOnly: true,
  },
  // Error Level Analysis
  {
    id: 'ela',
    label: 'ELA',
    category: 'Error Level Analysis',
    description: 'Re-compress at known quality to reveal inconsistent regions',
  },
  {
    id: 'multi-quality-ela',
    label: 'Multi-Quality ELA',
    category: 'Error Level Analysis',
    description: 'Run ELA at multiple quality levels simultaneously',
  },
  // Noise Analysis
  {
    id: 'noise-map',
    label: 'Noise Map Visualizer',
    category: 'Noise Analysis',
    description: 'Extract & visualize noise residual, detect sensor inconsistencies',
  },
  {
    id: 'prnu',
    label: 'PRNU Analysis',
    category: 'Noise Analysis',
    description: 'Extract sensor fingerprint for camera identification or consistency',
  },
  // Frequency Domain
  {
    id: 'fft-spectrum',
    label: 'FFT Spectrum Analyzer',
    category: 'Frequency Domain',
    description: 'Visualize frequency spectrum, detect periodic patterns and resampling',
  },
  {
    id: 'dct-viewer',
    label: 'DCT Coefficient Viewer',
    category: 'Frequency Domain',
    description: 'Inspect DCT coefficient distributions, detect double compression',
  },
  // Clone & Copy-Move
  {
    id: 'keypoint-clone',
    label: 'Keypoint Clone Detector',
    category: 'Clone & Copy-Move',
    description: 'Feature point matching (ORB/AKAZE) to detect cloned regions',
  },
  {
    id: 'block-matching-clone',
    label: 'Block-Matching Clone Detector',
    category: 'Clone & Copy-Move',
    description: 'Dense block-based approach for textured regions',
  },
  // Color & Lighting
  {
    id: 'channel-separator',
    label: 'Channel Separator',
    category: 'Color & Lighting',
    description: 'Split and analyze RGB/HSV/LAB/YCbCr channels',
  },
  {
    id: 'lighting-estimator',
    label: 'Lighting Direction Estimator',
    category: 'Color & Lighting',
    description: 'Estimate light source direction per region to detect compositing',
  },
  {
    id: 'histogram-analyzer',
    label: 'Histogram Analyzer',
    category: 'Color & Lighting',
    description: 'Deep histogram analysis across channels and color spaces',
  },
  // Steganography
  {
    id: 'lsb-visualizer',
    label: 'LSB Plane Visualizer',
    category: 'Steganography',
    description: 'Visualize bit planes to detect LSB steganography',
  },
  {
    id: 'stego-stats',
    label: 'Statistical Stego Tests',
    category: 'Steganography',
    description: 'Chi-Square, RS Analysis, Sample Pairs tests',
  },
  // AI Detection
  {
    id: 'ai-forgery-detector',
    label: 'AI Forgery Detector',
    category: 'AI Detection',
    description: 'Pre-trained CNN model (ONNX, CPU) for per-region forgery probability',
  },
  // Raw Inspection
  {
    id: 'hex-viewer',
    label: 'Hex / Binary Viewer',
    category: 'Raw Inspection',
    description: 'Inspect raw file bytes with search and bookmarking',
  },
  {
    id: 'string-extractor',
    label: 'String Extractor',
    category: 'Raw Inspection',
    description: 'Extract printable strings from raw file',
  },
]

export const TOOL_CATEGORIES: ToolCategory[] = [
  'File & Metadata',
  'Compression Analysis',
  'Error Level Analysis',
  'Noise Analysis',
  'Frequency Domain',
  'Clone & Copy-Move',
  'Color & Lighting',
  'Steganography',
  'AI Detection',
  'Raw Inspection',
]

export function getToolsByCategory(category: ToolCategory): ToolMeta[] {
  return TOOL_REGISTRY.filter((t) => t.category === category)
}

export function getToolMeta(id: ToolId): ToolMeta {
  const meta = TOOL_REGISTRY.find((t) => t.id === id)
  if (!meta) throw new Error(`Unknown tool id: ${id}`)
  return meta
}
