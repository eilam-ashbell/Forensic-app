import { useCallback, useRef } from 'react'
import { useStore } from '../store'
import type { ToolId, ToolResult } from '../types/tools'
import { getToolMeta } from '../constants/tools'

type ToolEngine = (
  image: { imageData: ImageData; arrayBuffer: ArrayBuffer; file: File },
  params: Record<string, unknown>,
  onProgress: (pct: number) => void,
) => Promise<ToolResult>

const ENGINE_REGISTRY = new Map<ToolId, ToolEngine>()

export function registerEngine(toolId: ToolId, engine: ToolEngine): void {
  ENGINE_REGISTRY.set(toolId, engine)
}

const TIMEOUT_MS = 120_000

export function useToolRunner(toolId: ToolId) {
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const store = useStore()

  const run = useCallback(async () => {
    const image = store.image
    if (!image) return

    const engine = ENGINE_REGISTRY.get(toolId)
    if (!engine) {
      store.setToolStatus(toolId, 'error', `No engine registered for ${toolId}`)
      return
    }

    // JPEG-only guard
    const meta = getToolMeta(toolId)
    if (meta.jpegOnly && !image.isJpeg) {
      store.setToolStatus(toolId, 'error', `${meta.label} requires a JPEG image`)
      return
    }

    abortRef.current?.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    abortRef.current = new AbortController()

    store.setToolStatus(toolId, 'running')
    const start = performance.now()

    // 120s timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef.current = setTimeout(() => {
        abortRef.current?.abort()
        reject(new Error(`Tool timed out after ${TIMEOUT_MS / 1000}s`))
      }, TIMEOUT_MS)
    })

    try {
      const params = store.toolStates[toolId].params
      // Clone ImageData so engines can safely transfer the buffer to workers
      const clonedPixels = new Uint8ClampedArray(image.imageData.data)
      const clonedImageData = new ImageData(clonedPixels, image.imageData.width, image.imageData.height)

      const result = await Promise.race([
        engine(
          { imageData: clonedImageData, arrayBuffer: image.arrayBuffer.slice(0), file: image.file },
          params,
          (pct) => store.setToolProgress(toolId, pct),
        ),
        timeoutPromise,
      ])

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      const executionMs = Math.round(performance.now() - start)
      store.setToolResult(toolId, result, executionMs)
      // Dev-mode heap monitor — eliminated by Vite tree-shaking in production builds
      if (import.meta.env.DEV) {
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
        if (mem) {
          console.debug(
            `[IFW] ${toolId} done in ${executionMs}ms | heap: ${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB / ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB`,
          )
        }
      }
    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      const msg = err instanceof Error ? err.message : String(err)
      store.setToolStatus(toolId, 'error', msg)
    }
  }, [toolId, store])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    store.setToolStatus(toolId, 'idle')
  }, [toolId, store])

  return { run, cancel }
}
