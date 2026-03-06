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

export async function runFftSpectrum(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const windowFn = (params['windowFunction'] as 'none' | 'hann' | 'hamming') ?? 'hann'
  const colormap = (params['colormap'] as 'grayscale' | 'hot' | 'viridis') ?? 'hot'
  const result = await getProxy().runFftSpectrum(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    windowFn,
    colormap,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'fft-spectrum', data: result }
}
