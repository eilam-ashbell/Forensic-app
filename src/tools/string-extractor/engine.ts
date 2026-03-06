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

export async function runStringExtractor(
  image: { arrayBuffer: ArrayBuffer },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const minLength = (params['minLength'] as number) ?? 6
  const encoding = (params['encoding'] as 'ascii' | 'utf16le') ?? 'ascii'
  onProgress(10)
  const strings = await getProxy().extractStrings(image.arrayBuffer.slice(0), minLength, encoding)
  onProgress(100)
  return { toolId: 'string-extractor', strings }
}
