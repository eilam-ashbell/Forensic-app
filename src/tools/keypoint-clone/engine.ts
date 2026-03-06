import * as Comlink from 'comlink'
import { wrapWorker } from '../../workers/bridge'
import type { CloneWorker } from '../../workers/clone.worker'
import type { ToolResult } from '../../types/tools'
import CloneWorkerInit from '../../workers/clone.worker.ts?worker'

let proxy: Comlink.Remote<CloneWorker> | null = null
function getProxy() {
  if (!proxy) proxy = wrapWorker<CloneWorker>(new CloneWorkerInit())
  return proxy
}

export async function runKeypointClone(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const maxKeypoints = (params['maxKeypoints'] as number) ?? 2000
  const ratioThreshold = (params['ratioThreshold'] as number) ?? 0.75
  const minClusterSize = (params['minClusterSize'] as number) ?? 3
  const result = await getProxy().runKeypointClone(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    maxKeypoints,
    ratioThreshold,
    minClusterSize,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'keypoint-clone', data: result }
}
