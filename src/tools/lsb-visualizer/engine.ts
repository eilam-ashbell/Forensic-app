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

export async function runLsbVisualizer(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const channel = (params['channel'] as 'r' | 'g' | 'b' | 'a') ?? 'r'
  const bitPlane = (params['bitPlane'] as number) ?? 0
  const result = await getProxy().lsbPlane(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    channel,
    bitPlane,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'lsb-visualizer', data: result }
}
