import { useState } from 'react'
import { useStore } from '../../store'
import { buildZipBundle, downloadBlob } from '../../lib/export/zip'
import { buildPdfReport } from '../../lib/export/pdf'

interface Props {
  onClose: () => void
}

type ExportState = 'idle' | 'building' | 'done' | 'error'

export function ExportDialog({ onClose }: Props) {
  const [zipState, setZipState] = useState<ExportState>('idle')
  const [pdfState, setPdfState] = useState<ExportState>('idle')
  const [error, setError] = useState<string | null>(null)

  const image = useStore((s) => s.image)
  const toolStates = useStore((s) => s.toolStates)
  const sessionName = useStore((s) => s.sessionName)

  const completedCount = Object.values(toolStates).filter((t) => t.status === 'done').length

  const handleZip = async () => {
    if (!image) return
    setZipState('building')
    setError(null)
    try {
      const blob = await buildZipBundle({ image, toolStates, sessionName })
      const safeName = (sessionName || 'ifw-export').replace(/[^a-zA-Z0-9_-]/g, '_')
      downloadBlob(blob, `${safeName}.zip`)
      setZipState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setZipState('error')
    }
  }

  const handlePdf = async () => {
    if (!image) return
    setPdfState('building')
    setError(null)
    try {
      const blob = buildPdfReport({ image, toolStates, sessionName })
      const safeName = (sessionName || 'ifw-export').replace(/[^a-zA-Z0-9_-]/g, '_')
      downloadBlob(blob, `${safeName}.pdf`)
      setPdfState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPdfState('error')
    }
  }

  if (!image) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-200">Export</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xs">✕</button>
        </div>

        <p className="text-xs text-zinc-500 mb-4">
          {completedCount} tool{completedCount !== 1 ? 's' : ''} completed
        </p>

        {/* Image info */}
        <div className="bg-zinc-800 rounded p-2 mb-4 text-[10px] font-mono text-zinc-400 space-y-0.5">
          <div className="truncate">File: {image.file.name}</div>
          <div>SHA-256: <span className="text-zinc-500 break-all">{image.sha256.slice(0, 16)}…</span></div>
        </div>

        <div className="space-y-2">
          {/* ZIP export */}
          <button
            onClick={handleZip}
            disabled={zipState === 'building' || completedCount === 0}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs text-zinc-200 transition-colors"
          >
            <span>
              <span className="font-semibold">ZIP Bundle</span>
              <span className="ml-2 text-zinc-500">overlays + data + manifest</span>
            </span>
            <StateIcon state={zipState} />
          </button>

          {/* PDF export */}
          <button
            onClick={handlePdf}
            disabled={pdfState === 'building' || completedCount === 0}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs text-zinc-200 transition-colors"
          >
            <span>
              <span className="font-semibold">PDF Report</span>
              <span className="ml-2 text-zinc-500">paginated forensic report</span>
            </span>
            <StateIcon state={pdfState} />
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400 break-all">{error}</p>
        )}

        {completedCount === 0 && (
          <p className="mt-3 text-xs text-zinc-600">Run at least one tool to enable export.</p>
        )}
      </div>
    </div>
  )
}

function StateIcon({ state }: { state: ExportState }) {
  switch (state) {
    case 'building':
      return <span className="text-blue-400 animate-pulse">⏳</span>
    case 'done':
      return <span className="text-emerald-400">✓</span>
    case 'error':
      return <span className="text-red-400">✗</span>
    default:
      return <span className="text-zinc-600">↓</span>
  }
}
