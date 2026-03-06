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

export async function runStringExtractor(
  image: { arrayBuffer: ArrayBuffer },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const minLength = (params['minLength'] as number) ?? 6
  const encoding = (params['encoding'] as 'ascii' | 'utf16le') ?? 'ascii'
  onProgress(10)
  const strings = await getProxy().extractStrings(image.arrayBuffer, minLength, encoding)
  onProgress(100)
  return { toolId: 'string-extractor', strings }
}
