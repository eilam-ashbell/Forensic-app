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

export async function runHistogram(
  image: { imageData: ImageData },
  _params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const result = await getProxy().histogram(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    Comlink.proxy(onProgress),
  )
  return { toolId: 'histogram-analyzer', data: result }
}
