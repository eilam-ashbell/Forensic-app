import { useEffect } from 'react'

interface Props {
  onClose: () => void
}

export function AboutDialog({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="About Image Forensics Workbench"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-blue-400 tracking-wider">IFW</h2>
          <button
            onClick={onClose}
            autoFocus
            aria-label="Close about dialog"
            className="text-zinc-500 hover:text-zinc-300 text-xs"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-zinc-300 font-semibold mb-1">Image Forensics Workbench</p>
        <p className="text-[11px] text-zinc-500 mb-4">
          Browser-based, offline-capable tool for forensic analysis of digital images.
          Runs entirely in your browser — no data is sent to any server.
        </p>

        <div className="space-y-1 text-[10px] text-zinc-500 border-t border-zinc-800 pt-3">
          <p className="font-semibold text-zinc-400 mb-2">Keyboard Shortcuts</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span><kbd className="bg-zinc-800 px-1 rounded">R</kbd> Run tool</span>
            <span><kbd className="bg-zinc-800 px-1 rounded">Esc</kbd> Cancel / exit mode</span>
            <span><kbd className="bg-zinc-800 px-1 rounded">O</kbd> Toggle overlay</span>
            <span><kbd className="bg-zinc-800 px-1 rounded">V</kbd> Select annotations</span>
            <span><kbd className="bg-zinc-800 px-1 rounded">D</kbd> Freehand draw</span>
            <span><kbd className="bg-zinc-800 px-1 rounded">T</kbd> Place text</span>
            <span><kbd className="bg-zinc-800 px-1 rounded">Ctrl+Z</kbd> Undo</span>
            <span><kbd className="bg-zinc-800 px-1 rounded">scroll</kbd> Zoom</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-800 text-[10px] text-zinc-600">
          20 analysis tools · ZIP + PDF export · Annotation toolbar
        </div>
      </div>
    </div>
  )
}
