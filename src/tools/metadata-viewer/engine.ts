import * as Comlink from 'comlink'
import type { ToolResult } from '../../types/tools'
import type { MetadataWorker } from '../../workers/metadata.worker'
import { createWorkerProxy } from '../../workers/bridge'

let proxy: Comlink.Remote<MetadataWorker> | null = null

function getProxy(): Comlink.Remote<MetadataWorker> {
  if (!proxy) {
    proxy = createWorkerProxy<MetadataWorker>(
      new URL('../../workers/metadata.worker.ts', import.meta.url),
    )
  }
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
