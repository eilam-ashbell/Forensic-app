import * as Comlink from 'comlink'
import { wrapWorker } from '../../workers/bridge'
import type { BinaryWorker } from '../../workers/binary.worker'
import type { ToolResult } from '../../types/tools'
import BinaryWorkerInit from '../../workers/binary.worker.ts?worker'

let proxy: Comlink.Remote<BinaryWorker> | null = null
function getProxy() {
  if (!proxy) proxy = wrapWorker<BinaryWorker>(new BinaryWorkerInit())
  return proxy
}

export async function runHexViewer(
  image: { arrayBuffer: ArrayBuffer },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const offset = (params['offset'] as number) ?? 0
  const count = (params['count'] as number) ?? 4096
  onProgress(10)
  const lines = await getProxy().getHexLines(image.arrayBuffer, offset, count)
  onProgress(100)
  return { toolId: 'hex-viewer', lines, totalBytes: image.arrayBuffer.byteLength }
}
