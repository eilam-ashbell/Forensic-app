/**
 * Per-tool parameter schemas that drive the ParamsPanel UI.
 * Each field descriptor tells the panel how to render and validate the param.
 */
import type { ToolId } from '../types/tools'

export type ParamField =
  | { type: 'range'; label: string; min: number; max: number; step: number; unit?: string }
  | { type: 'select'; label: string; options: Array<{ value: string; label: string }> }
  | { type: 'toggle'; label: string }
  | { type: 'number-array'; label: string; hint?: string }

export type ParamSchema = Record<string, ParamField>

export const PARAM_SCHEMAS: Partial<Record<ToolId, ParamSchema>> = {
  ela: {
    quality: { type: 'range', label: 'Re-encode quality', min: 40, max: 99, step: 1, unit: '%' },
    amplify: { type: 'range', label: 'Amplify', min: 1, max: 30, step: 1, unit: '×' },
  },
  'multi-quality-ela': {
    amplify: { type: 'range', label: 'Amplify', min: 1, max: 30, step: 1, unit: '×' },
    qualities: { type: 'number-array', label: 'Quality levels', hint: 'e.g. 70,75,80,85,90' },
  },
  'noise-map': {
    filterType: {
      type: 'select',
      label: 'Filter type',
      options: [
        { value: 'gaussian', label: 'Gaussian' },
        { value: 'median', label: 'Median' },
      ],
    },
    kernelSize: { type: 'range', label: 'Kernel size', min: 1, max: 9, step: 2 },
    amplify: { type: 'range', label: 'Amplify', min: 1, max: 30, step: 1, unit: '×' },
  },
  prnu: {
    denoisingStrength: { type: 'range', label: 'Denoising strength', min: 1, max: 30, step: 1 },
    windowSize: {
      type: 'select',
      label: 'Window size',
      options: [
        { value: '32', label: '32 px' },
        { value: '64', label: '64 px' },
        { value: '128', label: '128 px' },
      ],
    },
  },
  'fft-spectrum': {
    windowFunction: {
      type: 'select',
      label: 'Window function',
      options: [
        { value: 'hann', label: 'Hann' },
        { value: 'hamming', label: 'Hamming' },
        { value: 'none', label: 'None (rectangular)' },
      ],
    },
    colormap: {
      type: 'select',
      label: 'Colormap',
      options: [
        { value: 'hot', label: 'Hot' },
        { value: 'viridis', label: 'Viridis' },
        { value: 'grayscale', label: 'Grayscale' },
      ],
    },
  },
  'dct-viewer': {
    channel: {
      type: 'select',
      label: 'Channel',
      options: [
        { value: 'Y', label: 'Y (Luma)' },
        { value: 'Cb', label: 'Cb (Blue diff)' },
        { value: 'Cr', label: 'Cr (Red diff)' },
      ],
    },
    coefficientIndex: {
      type: 'range',
      label: 'DCT coefficient index',
      min: 0,
      max: 63,
      step: 1,
    },
    showGrid: { type: 'toggle', label: 'Show 8×8 grid' },
  },
  'block-artifact-visualizer': {
    threshold: { type: 'range', label: 'Threshold', min: 1, max: 100, step: 1 },
    channel: {
      type: 'select',
      label: 'Channel',
      options: [
        { value: 'gray', label: 'Grayscale' },
        { value: 'r', label: 'Red' },
        { value: 'g', label: 'Green' },
        { value: 'b', label: 'Blue' },
      ],
    },
  },
  'keypoint-clone': {
    maxKeypoints: { type: 'range', label: 'Max keypoints', min: 200, max: 5000, step: 100 },
    ratioThreshold: {
      type: 'range',
      label: "Lowe's ratio",
      min: 0.5,
      max: 0.95,
      step: 0.05,
    },
    minClusterSize: { type: 'range', label: 'Min cluster size', min: 2, max: 20, step: 1 },
  },
  'block-matching-clone': {
    blockSize: { type: 'range', label: 'Block size', min: 8, max: 64, step: 8, unit: 'px' },
    stride: { type: 'range', label: 'Stride', min: 4, max: 32, step: 4, unit: 'px' },
    similarityThreshold: {
      type: 'range',
      label: 'Similarity threshold',
      min: 0.005,
      max: 0.1,
      step: 0.005,
    },
    minOffset: { type: 'range', label: 'Min offset', min: 8, max: 128, step: 8, unit: 'px' },
  },
  'channel-separator': {
    colorSpace: {
      type: 'select',
      label: 'Color space',
      options: [
        { value: 'rgb', label: 'RGB' },
        { value: 'hsv', label: 'HSV' },
        { value: 'lab', label: 'CIE-LAB' },
        { value: 'ycbcr', label: 'YCbCr' },
      ],
    },
  },
  'lighting-estimator': {
    smoothingSigma: { type: 'range', label: 'Smoothing σ', min: 0.5, max: 10, step: 0.5 },
  },
  'histogram-analyzer': {
    logScale: { type: 'toggle', label: 'Log scale' },
  },
  'lsb-visualizer': {
    channel: {
      type: 'select',
      label: 'Channel',
      options: [
        { value: 'r', label: 'Red' },
        { value: 'g', label: 'Green' },
        { value: 'b', label: 'Blue' },
        { value: 'a', label: 'Alpha' },
      ],
    },
    bitPlane: { type: 'range', label: 'Bit plane', min: 0, max: 7, step: 1 },
  },
  'stego-stats': {
    channel: {
      type: 'select',
      label: 'Channel',
      options: [
        { value: 'r', label: 'Red' },
        { value: 'g', label: 'Green' },
        { value: 'b', label: 'Blue' },
      ],
    },
  },
  'ai-forgery-detector': {
    threshold: { type: 'range', label: 'Detection threshold', min: 0.1, max: 0.9, step: 0.05 },
    patchSize: {
      type: 'select',
      label: 'Patch size',
      options: [
        { value: '128', label: '128 px' },
        { value: '256', label: '256 px' },
        { value: '512', label: '512 px' },
      ],
    },
  },
  'hex-viewer': {
    count: {
      type: 'select',
      label: 'Bytes to show',
      options: [
        { value: '1024', label: '1 KB' },
        { value: '4096', label: '4 KB' },
        { value: '16384', label: '16 KB' },
      ],
    },
  },
  'string-extractor': {
    minLength: { type: 'range', label: 'Min string length', min: 3, max: 20, step: 1 },
    encoding: {
      type: 'select',
      label: 'Encoding',
      options: [
        { value: 'ascii', label: 'ASCII' },
        { value: 'utf8', label: 'UTF-8' },
      ],
    },
  },
}
