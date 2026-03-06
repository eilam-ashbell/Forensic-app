import { useCallback, useRef } from 'react'
import { useStore } from '../store'
import type { ToolId, ToolResult } from '../types/tools'

type ToolEngine = (
  image: { imageData: ImageData; arrayBuffer: ArrayBuffer; file: File },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
) => Promise<ToolResult>

const ENGINE_REGISTRY = new Map<ToolId, ToolEngine>()

export function registerEngine(toolId: ToolId, engine: ToolEngine): void {
  ENGINE_REGISTRY.set(toolId, engine)
}

export function useToolRunner(toolId: ToolId) {
  const abortRef = useRef<AbortController | null>(null)
  const store = useStore()

  const run = useCallback(async () => {
    const image = store.image
    if (!image) return

    const engine = ENGINE_REGISTRY.get(toolId)
    if (!engine) {
      store.setToolStatus(toolId, 'error', `No engine registered for ${toolId}`)
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    store.setToolStatus(toolId, 'running')
    const start = performance.now()

    try {
      const params = store.toolStates[toolId].params
      const result = await engine(
        { imageData: image.imageData, arrayBuffer: image.arrayBuffer, file: image.file },
        params,
        (pct) => store.setToolProgress(toolId, pct),
      )
      const executionMs = Math.round(performance.now() - start)
      store.setToolResult(toolId, result, executionMs)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      store.setToolStatus(toolId, 'error', msg)
    }
  }, [toolId, store])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    store.setToolStatus(toolId, 'idle')
  }, [toolId, store])

  return { run, cancel }
}
