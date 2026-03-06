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

export async function runChannelSeparator(
  image: { imageData: ImageData },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const colorSpace = (params['colorSpace'] as 'rgb' | 'hsv' | 'lab' | 'ycbcr') ?? 'rgb'
  const channels = (params['channels'] as string[]) ?? []
  const results = await getProxy().channelSeparator(
    Comlink.transfer(image.imageData, [image.imageData.data.buffer]),
    colorSpace,
    channels,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'channel-separator', channels: results }
}
