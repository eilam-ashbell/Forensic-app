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

export async function runFileStructureInspector(
  image: { arrayBuffer: ArrayBuffer },
  _params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  onProgress(10)
  const chunks = await getProxy().inspectFileStructure(Comlink.transfer(image.arrayBuffer.slice(0), [image.arrayBuffer.slice(0)]))
  onProgress(100)
  return { toolId: 'file-structure-inspector', chunks }
}
