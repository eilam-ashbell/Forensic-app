import * as Comlink from 'comlink'
import { wrapWorker } from '../../workers/bridge'
import type { FftWorker } from '../../workers/fft.worker'
import type { ToolResult } from '../../types/tools'
import FftWorkerInit from '../../workers/fft.worker.ts?worker'

let proxy: Comlink.Remote<FftWorker> | null = null
function getProxy() {
  if (!proxy) proxy = wrapWorker<FftWorker>(new FftWorkerInit())
  return proxy
}

export async function runDctViewer(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const coefficientIndex = (params['coefficientIndex'] as number) ?? 1
  const channel = (params['channel'] as 'Y' | 'Cb' | 'Cr') ?? 'Y'
  const result = await getProxy().runDctViewer(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    coefficientIndex,
    channel,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'dct-viewer', data: result }
}
