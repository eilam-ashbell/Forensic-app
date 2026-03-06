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

export async function runBlockMatchingClone(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const blockSize = (params['blockSize'] as number) ?? 16
  const stride = (params['stride'] as number) ?? 8
  const similarityThreshold = (params['similarityThreshold'] as number) ?? 0.02
  const minOffset = (params['minOffset'] as number) ?? 32
  const result = await getProxy().runBlockMatchingClone(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    blockSize,
    stride,
    similarityThreshold,
    minOffset,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'block-matching-clone', data: result }
}
