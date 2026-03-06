import * as Comlink from 'comlink'
import { wrapWorker } from '../../workers/bridge'
import type { AdvancedWorker } from '../../workers/advanced.worker'
import type { ToolResult } from '../../types/tools'
import AdvancedWorkerInit from '../../workers/advanced.worker.ts?worker'

let proxy: Comlink.Remote<AdvancedWorker> | null = null
function getProxy() {
  if (!proxy) proxy = wrapWorker<AdvancedWorker>(new AdvancedWorkerInit())
  return proxy
}

export async function runLightingEstimator(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const smoothingSigma = (params['smoothingSigma'] as number) ?? 2
  const result = await getProxy().runLightingEstimator(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    smoothingSigma,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'lighting-estimator', data: result }
}
