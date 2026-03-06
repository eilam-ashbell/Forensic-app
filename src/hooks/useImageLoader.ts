import { useCallback, useState } from 'react'
import { loadImageFile, ImageLoadError } from '../lib/image/loader'
import { useStore } from '../store'

export function useImageLoader() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setImage = useStore((s) => s.setImage)
  const setLoadedAt = useStore((s) => s.setLoadedAt)
  const resetAllTools = useStore((s) => s.resetAllTools)
  const setSessionName = useStore((s) => s.setSessionName)

  const loadFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
      try {
        const record = await loadImageFile(file)
        resetAllTools()
        setImage(record)
        setLoadedAt(new Date().toISOString())
        setSessionName(file.name.replace(/\.[^.]+$/, ''))
      } catch (err) {
        const msg = err instanceof ImageLoadError ? err.message : 'Failed to load image.'
        setError(msg)
      } finally {
        setLoading(false)
      }
    },
    [setImage, setLoadedAt, resetAllTools, setSessionName],
  )

  return { loadFile, loading, error }
}
