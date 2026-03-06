import { useStore } from '../../store'
import { getToolMeta } from '../../constants/tools'
import { useToolRunner } from '../../hooks/useToolRunner'
import { ProgressBar } from '../shared/ProgressBar'

export function ParamsPanel() {
  const activeToolId = useStore((s) => s.activeToolId)
  const toolStates = useStore((s) => s.toolStates)
  const setToolParams = useStore((s) => s.setToolParams)
  const image = useStore((s) => s.image)

  if (!activeToolId) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Select a tool
      </div>
    )
  }

  const meta = getToolMeta(activeToolId)
  const state = toolStates[activeToolId]
  const { run, cancel } = useToolRunner(activeToolId)

  const handleParamChange = (key: string, value: unknown) => {
    setToolParams(activeToolId, { ...state.params, [key]: value })
  }

  const isRunning = state.status === 'running'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Tool header */}
      <div className="px-4 py-3 border-b border-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-200">{meta.label}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{meta.description}</p>
      </div>

      {/* Parameters */}
      <div className="flex-1 px-4 py-3 space-y-3">
        <ParamFields toolId={activeToolId} params={state.params} onChange={handleParamChange} />
      </div>

      {/* Run button + progress */}
      <div className="px-4 pb-4 space-y-2">
        {isRunning && <ProgressBar progress={state.progress} />}
        {state.executionMs !== null && !isRunning && (
          <p className="text-[10px] text-zinc-500">
            Completed in {(state.executionMs / 1000).toFixed(2)}s
          </p>
        )}
        {state.error && <p className="text-xs text-red-400">{state.error}</p>}
        <button
          onClick={isRunning ? cancel : run}
          disabled={!image}
          className={`w-full py-1.5 rounded text-sm font-medium transition-colors ${
            isRunning
              ? 'bg-red-700 hover:bg-red-600 text-white'
              : image
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
          }`}
        >
          {isRunning ? 'Cancel' : 'Run'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dynamic param fields — renders basic controls for known param shapes
// ---------------------------------------------------------------------------

interface ParamFieldsProps {
  toolId: string
  params: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

function ParamFields({ params, onChange }: ParamFieldsProps) {
  if (Object.keys(params).length === 0) {
    return <p className="text-xs text-zinc-600">No parameters</p>
  }

  return (
    <>
      {Object.entries(params).map(([key, value]) => (
        <ParamField key={key} name={key} value={value} onChange={(v) => onChange(key, v)} />
      ))}
    </>
  )
}

interface ParamFieldProps {
  name: string
  value: unknown
  onChange: (value: unknown) => void
}

function ParamField({ name, value, onChange }: ParamFieldProps) {
  const label = name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())

  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-blue-500"
        />
        {label}
      </label>
    )
  }

  if (typeof value === 'number') {
    return (
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide">
          {label}: <span className="text-zinc-300">{value}</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-blue-500 mt-1"
        />
      </div>
    )
  }

  if (typeof value === 'string') {
    return (
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
        />
      </div>
    )
  }

  if (Array.isArray(value)) {
    return (
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">{label}</label>
        <p className="text-xs text-zinc-400">{JSON.stringify(value)}</p>
      </div>
    )
  }

  return null
}
