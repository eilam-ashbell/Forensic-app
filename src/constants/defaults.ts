import type { ToolId } from '../types/tools'

export const TOOL_DEFAULT_PARAMS: Partial<Record<ToolId, Record<string, unknown>>> = {
  ela: { quality: 75, amplify: 10 },
  'multi-quality-ela': { qualities: [70, 75, 80, 85, 90], amplify: 10 },
  'noise-map': { filterType: 'gaussian', kernelSize: 3, amplify: 10 },
  prnu: { denoisingStrength: 10, windowSize: 64 },
  'fft-spectrum': { windowFunction: 'hann', colormap: 'hot' },
  'dct-viewer': { coefficientIndex: 1, channel: 'Y', showGrid: true },
  'block-artifact-visualizer': { threshold: 30, channel: 'gray' },
  'keypoint-clone': { maxKeypoints: 2000, ratioThreshold: 0.75, minClusterSize: 3 },
  'block-matching-clone': { blockSize: 16, stride: 8, similarityThreshold: 0.02, minOffset: 32 },
  'channel-separator': { colorSpace: 'rgb', channels: ['r', 'g', 'b'] },
  'chromatic-aberration': { blockSize: 32, anomalyThreshold: 1.5, arrowScale: 10 },
  'lighting-estimator': { smoothingSigma: 2 },
  'histogram-analyzer': { logScale: false, channels: ['r', 'g', 'b'] },
  'lsb-visualizer': { channel: 'r', bitPlane: 0 },
  'stego-stats': { channel: 'r' },
  'ai-forgery-detector': { threshold: 0.5, patchMode: 'sliding', patchSize: 256 },
  'hex-viewer': { offset: 0, count: 4096 },
  'string-extractor': { minLength: 6, encoding: 'ascii' },
  'social-media-detector': {},
}
