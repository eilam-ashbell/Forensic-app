import { useStore } from '../../store'
import type { AnnotationMode } from '../../store/slices/canvasSlice'

interface Props {
  onUndo: () => void
  onClear: () => void
  canUndo: boolean
}

interface ToolButton {
  mode: AnnotationMode
  label: string
  title: string
  icon: string
}

const TOOLS: ToolButton[] = [
  { mode: 'select', label: 'Select', title: 'Select / move annotations (V)', icon: '↖' },
  { mode: 'rect', label: 'Rect', title: 'Draw rectangle (R)', icon: '▭' },
  { mode: 'freehand', label: 'Draw', title: 'Freehand draw (D)', icon: '✏' },
  { mode: 'text', label: 'Text', title: 'Place text (T)', icon: 'A' },
]

const STROKE_WIDTHS = [1, 2, 4, 8]

export function AnnotationToolbar({ onUndo, onClear, canUndo }: Props) {
  const annotationMode = useStore((s) => s.annotationMode)
  const annotationColor = useStore((s) => s.annotationColor)
  const annotationStrokeWidth = useStore((s) => s.annotationStrokeWidth)
  const setAnnotationMode = useStore((s) => s.setAnnotationMode)
  const setAnnotationColor = useStore((s) => s.setAnnotationColor)
  const setAnnotationStrokeWidth = useStore((s) => s.setAnnotationStrokeWidth)

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border-b border-zinc-700"
      role="toolbar"
      aria-label="Annotation tools"
    >
      {/* Tool buttons */}
      {TOOLS.map((t) => (
        <button
          key={t.mode}
          onClick={() => setAnnotationMode(annotationMode === t.mode ? null : t.mode)}
          title={t.title}
          aria-label={t.title}
          aria-pressed={annotationMode === t.mode}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            annotationMode === t.mode
              ? 'bg-blue-600 text-white'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          <span aria-hidden="true">{t.icon}</span>
          <span className="sr-only">{t.label}</span>
        </button>
      ))}

      <div className="w-px h-4 bg-zinc-700 mx-1" aria-hidden="true" />

      {/* Color picker */}
      <label className="flex items-center gap-1 cursor-pointer" title="Annotation color" aria-label="Annotation color">
        <span className="text-[10px] text-zinc-500">Color</span>
        <input
          type="color"
          value={annotationColor}
          onChange={(e) => setAnnotationColor(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
          aria-label="Pick annotation color"
        />
      </label>

      <div className="w-px h-4 bg-zinc-700 mx-1" aria-hidden="true" />

      {/* Stroke width */}
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Stroke width">
        <span className="text-[10px] text-zinc-500">Width</span>
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => setAnnotationStrokeWidth(w)}
            title={`${w}px stroke`}
            aria-label={`${w}px stroke width`}
            aria-pressed={annotationStrokeWidth === w}
            className={`w-5 h-5 flex items-center justify-center rounded text-[9px] transition-colors ${
              annotationStrokeWidth === w
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {w}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-zinc-700 mx-1" aria-hidden="true" />

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo last annotation"
        className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
      >
        ↩ Undo
      </button>

      {/* Clear */}
      <button
        onClick={onClear}
        title="Clear all annotations"
        aria-label="Clear all annotations"
        className="px-2 py-1 text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors"
      >
        ✕ Clear
      </button>
    </div>
  )
}
