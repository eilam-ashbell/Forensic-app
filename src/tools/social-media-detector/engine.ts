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

export async function runSocialMediaDetector(
  image: { arrayBuffer: ArrayBuffer; file: File },
  _params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  const data = await getProxy().detectSocialMediaSource(
    image.arrayBuffer,
    image.file.name,
    Comlink.proxy(onProgress),
  )
  return { toolId: 'social-media-detector', data }
}
