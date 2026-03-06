import * as Comlink from 'comlink'
import type { ToolResult } from '../../types/tools'
import type { BinaryWorker } from '../../workers/binary.worker'
import { createWorkerProxy } from '../../workers/bridge'

let proxy: Comlink.Remote<BinaryWorker> | null = null

function getProxy(): Comlink.Remote<BinaryWorker> {
  if (!proxy) {
    proxy = createWorkerProxy<BinaryWorker>(
      new URL('../../workers/binary.worker.ts', import.meta.url),
    )
  }
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
  const lines = await getProxy().getHexLines(image.arrayBuffer.slice(0), offset, count)
  onProgress(100)
  return { toolId: 'hex-viewer', lines, totalBytes: image.arrayBuffer.byteLength }
}
