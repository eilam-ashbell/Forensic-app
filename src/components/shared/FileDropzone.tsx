import { useCallback, useState } from 'react'
import { useImageLoader } from '../../hooks/useImageLoader'

const SUPPORTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
  'image/bmp', 'image/gif', 'image/heic', 'image/heif',
]

function validateAndLoad(file: File, loadFile: (f: File) => void, setFormatError: (msg: string | null) => void) {
  if (file.type && !SUPPORTED_TYPES.includes(file.type)) {
    setFormatError(`Unsupported format: ${file.type}. Use JPEG, PNG, WebP, TIFF, BMP, GIF, or HEIC.`)
    return
  }
  setFormatError(null)
  loadFile(file)
}

export function FileDropzone() {
  const { loadFile, loading, error } = useImageLoader()
  const [dragging, setDragging] = useState(false)
  const [formatError, setFormatError] = useState<string | null>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) validateAndLoad(file, loadFile, setFormatError)
    },
    [loadFile],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) validateAndLoad(file, loadFile, setFormatError)
    },
    [loadFile],
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-lg transition-colors ${
        dragging ? 'border-blue-400 bg-blue-950/30' : 'border-zinc-600 bg-zinc-900/50'
      }`}
    >
      <div className="text-center p-8">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-zinc-300 text-lg font-medium mb-2">Drop an image to analyze</p>
        <p className="text-zinc-500 text-sm mb-4">
          Supports JPEG, PNG, WebP, TIFF, BMP, GIF, HEIC
        </p>
        <label className="cursor-pointer">
          <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors">
            {loading ? 'Loading…' : 'Open File'}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChange}
            disabled={loading}
          />
        </label>
        {(error || formatError) && (
          <p className="mt-3 text-red-400 text-sm">{formatError ?? error}</p>
        )}
      </div>
    </div>
  )
}
