import * as Comlink from 'comlink'
import { wrapWorker } from '../../workers/bridge'
import type { ElaWorker } from '../../workers/ela.worker'
import type { ToolResult } from '../../types/tools'
import ElaWorkerInit from '../../workers/ela.worker.ts?worker'

let proxy: Comlink.Remote<ElaWorker> | null = null
function getProxy() {
  if (!proxy) proxy = wrapWorker<ElaWorker>(new ElaWorkerInit())
  return proxy
}

export async function runMultiEla(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const qualities = (params['qualities'] as number[]) ?? [70, 75, 80, 85, 90]
  const amplify = (params['amplify'] as number) ?? 10
  const result = await getProxy().runMultiEla(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    qualities,
    amplify,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'multi-quality-ela', data: result }
}
