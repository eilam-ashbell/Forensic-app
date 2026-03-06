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

export async function runEla(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const quality = (params['quality'] as number) ?? 75
  const amplify = (params['amplify'] as number) ?? 10
  const result = await getProxy().runEla(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    quality,
    amplify,
    Comlink.proxy(onProgress),
  )
  return {
    toolId: 'ela',
    data: {
      overlayDataUrl: result.overlayDataUrl,
      maxDifference: result.maxDifference,
      meanDifference: result.meanDifference,
      params: { quality, amplify },
    },
  }
}
