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

export async function runNoiseMap(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const kernelSize = (params['kernelSize'] as number) ?? 3
  const amplify = (params['amplify'] as number) ?? 10
  const result = await getProxy().noiseMap(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    kernelSize,
    amplify,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'noise-map', data: result }
}
