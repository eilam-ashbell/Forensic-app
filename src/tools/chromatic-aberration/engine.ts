import * as Comlink from 'comlink'
import { wrapWorker } from '../../workers/bridge'
import type { AnalysisWorker } from '../../workers/analysis.worker'
import type { ToolResult } from '../../types/tools'
import AnalysisWorkerInit from '../../workers/analysis.worker.ts?worker'

let proxy: Comlink.Remote<AnalysisWorker> | null = null
function getProxy() {
  if (!proxy) proxy = wrapWorker<AnalysisWorker>(new AnalysisWorkerInit())
  return proxy
}

export async function runChromaticAberration(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const blockSize = Number(params['blockSize'] ?? 32)
  const anomalyThreshold = (params['anomalyThreshold'] as number) ?? 1.5
  const arrowScale = (params['arrowScale'] as number) ?? 10
  const result = await getProxy().chromaticAberration(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    blockSize,
    anomalyThreshold,
    arrowScale,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'chromatic-aberration', data: result }
}
