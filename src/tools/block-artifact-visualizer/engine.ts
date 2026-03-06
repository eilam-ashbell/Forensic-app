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

export async function runBlockArtifact(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const threshold = (params['threshold'] as number) ?? 30
  const result = await getProxy().blockArtifact(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    threshold,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'block-artifact-visualizer', data: result }
}
