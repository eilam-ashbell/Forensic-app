import * as Comlink from 'comlink'
import { wrapWorker } from '../../workers/bridge'
import type { MetadataWorker } from '../../workers/metadata.worker'
import type { ToolResult } from '../../types/tools'
import MetadataWorkerInit from '../../workers/metadata.worker.ts?worker'

let proxy: Comlink.Remote<MetadataWorker> | null = null
function getProxy() {
  if (!proxy) proxy = wrapWorker<MetadataWorker>(new MetadataWorkerInit())
  return proxy
}

export async function runMetadataViewer(
  image: { file: File },
  _params: Record<string, unknown>,
  onProgress: (pct: number) => void,
): Promise<ToolResult> {
  onProgress(10)
  const entries = await getProxy().extractMetadata(image.file)
  onProgress(100)
  return { toolId: 'metadata-viewer', entries }
}
