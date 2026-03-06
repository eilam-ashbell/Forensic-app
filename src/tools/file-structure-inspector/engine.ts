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

export async function runFileStructureInspector(
  image: { arrayBuffer: ArrayBuffer },
  _params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  onProgress(10)
  const chunks = await getProxy().inspectFileStructure(image.arrayBuffer)
  onProgress(100)
  return { toolId: 'file-structure-inspector', chunks }
}
