/**
 * Central engine registration — import this once at app startup.
 * Each engine module registers itself with useToolRunner via registerEngine().
 */
import { registerEngine } from '../hooks/useToolRunner'
import { runMetadataViewer } from './metadata-viewer/engine'
import { runFileStructureInspector } from './file-structure-inspector/engine'
import { runJpegQuantization } from './jpeg-quantization/engine'
import { runHexViewer } from './hex-viewer/engine'
import { runStringExtractor } from './string-extractor/engine'

// Phase 2 — File & Metadata / Raw Inspection tools
registerEngine('metadata-viewer', (img, params, onProgress) =>
  runMetadataViewer(img, params, onProgress),
)
registerEngine('file-structure-inspector', (img, params, onProgress) =>
  runFileStructureInspector(img, params, onProgress),
)
registerEngine('jpeg-quantization', (img, params, onProgress) =>
  runJpegQuantization(img, params, onProgress),
)
registerEngine('hex-viewer', (img, params, onProgress) =>
  runHexViewer(img, params, onProgress),
)
registerEngine('string-extractor', (img, params, onProgress) =>
  runStringExtractor(img, params, onProgress),
)
