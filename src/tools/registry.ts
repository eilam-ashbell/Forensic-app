/**
 * Central engine registration — import this once at app startup.
 */
import { registerEngine } from '../hooks/useToolRunner'

// Phase 2 — File & Metadata / Raw Inspection
import { runMetadataViewer } from './metadata-viewer/engine'
import { runFileStructureInspector } from './file-structure-inspector/engine'
import { runJpegQuantization } from './jpeg-quantization/engine'
import { runHexViewer } from './hex-viewer/engine'
import { runStringExtractor } from './string-extractor/engine'

// Phase 3 — Core Analysis
import { runEla } from './ela/engine'
import { runMultiEla } from './multi-quality-ela/engine'
import { runNoiseMap } from './noise-map/engine'
import { runFftSpectrum } from './fft-spectrum/engine'
import { runDctViewer } from './dct-viewer/engine'
import { runBlockArtifact } from './block-artifact-visualizer/engine'
import { runChannelSeparator } from './channel-separator/engine'
import { runHistogram } from './histogram-analyzer/engine'
import { runLsbVisualizer } from './lsb-visualizer/engine'

registerEngine('metadata-viewer', runMetadataViewer)
registerEngine('file-structure-inspector', runFileStructureInspector)
registerEngine('jpeg-quantization', runJpegQuantization)
registerEngine('hex-viewer', runHexViewer)
registerEngine('string-extractor', runStringExtractor)

registerEngine('ela', runEla)
registerEngine('multi-quality-ela', runMultiEla)
registerEngine('noise-map', runNoiseMap)
registerEngine('fft-spectrum', runFftSpectrum)
registerEngine('dct-viewer', runDctViewer)
registerEngine('block-artifact-visualizer', runBlockArtifact)
registerEngine('channel-separator', runChannelSeparator)
registerEngine('histogram-analyzer', runHistogram)
registerEngine('lsb-visualizer', runLsbVisualizer)
