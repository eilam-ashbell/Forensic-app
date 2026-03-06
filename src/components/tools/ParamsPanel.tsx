import { useStore } from '../../store'
import { getToolMeta } from '../../constants/tools'
import { PARAM_SCHEMAS } from '../../constants/paramSchemas'
import type { ParamField } from '../../constants/paramSchemas'
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
  const schema = PARAM_SCHEMAS[activeToolId] ?? {}

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
        {meta.jpegOnly && (
          <span className="inline-block mt-1 text-[9px] uppercase tracking-wider bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded">
            JPEG only
          </span>
        )}
      </div>

      {/* Parameters */}
      <div className="flex-1 px-4 py-3 space-y-4 overflow-y-auto">
        {Object.keys(schema).length === 0 && Object.keys(state.params).length === 0 && (
          <p className="text-xs text-zinc-600">No parameters</p>
        )}

        {Object.entries(schema).map(([key, field]) => (
          <SchemaField
            key={key}
            fieldKey={key}
            field={field}
            value={state.params[key]}
            onChange={(v) => handleParamChange(key, v)}
          />
        ))}

        {/* Fallback: show any params not covered by schema */}
        {Object.entries(state.params)
          .filter(([k]) => !(k in schema))
          .map(([key, value]) => (
            <FallbackField key={key} name={key} value={value} onChange={(v) => handleParamChange(key, v)} />
          ))}
      </div>

      {/* Run button + progress */}
      <div className="px-4 pb-4 space-y-2">
        {isRunning && <ProgressBar progress={state.progress} />}
        {state.executionMs !== null && !isRunning && (
          <p className="text-[10px] text-zinc-500">
            Completed in {(state.executionMs / 1000).toFixed(2)}s
          </p>
        )}
        {state.error && <p className="text-xs text-red-400 break-words">{state.error}</p>}
        <button
          onClick={isRunning ? cancel : run}
          disabled={!image}
          aria-label={isRunning ? 'Cancel tool' : 'Run tool'}
          className={`w-full py-1.5 rounded text-sm font-medium transition-colors ${
            isRunning
              ? 'bg-red-700 hover:bg-red-600 text-white'
              : image
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
          }`}
        >
          {isRunning ? 'Cancel' : 'Run'}
          {!isRunning && <span className="ml-2 text-zinc-400 text-[10px]">(R)</span>}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schema-driven field components
// ---------------------------------------------------------------------------

interface SchemaFieldProps {
  fieldKey: string
  field: ParamField
  value: unknown
  onChange: (value: unknown) => void
}

function SchemaField({ fieldKey: _key, field, value, onChange }: SchemaFieldProps) {
  switch (field.type) {
    case 'range': {
      const num = typeof value === 'number' ? value : field.min
      return (
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wide flex justify-between">
            <span>{field.label}</span>
            <span className="text-zinc-300">
              {num}
              {field.unit ?? ''}
            </span>
          </label>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step}
            value={num}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-blue-500 mt-1"
          />
          <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
            <span>
              {field.min}
              {field.unit ?? ''}
            </span>
            <span>
              {field.max}
              {field.unit ?? ''}
            </span>
          </div>
        </div>
      )
    }

    case 'select': {
      const str = String(value ?? field.options[0]?.value ?? '')
      return (
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">
            {field.label}
          </label>
          <select
            value={str}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
          >
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )
    }

    case 'toggle': {
      const bool = Boolean(value)
      return (
        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={bool}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-blue-500"
          />
          {field.label}
        </label>
      )
    }

    case 'number-array': {
      const arr = Array.isArray(value) ? value : []
      const displayVal = arr.join(', ')
      return (
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">
            {field.label}
          </label>
          <input
            type="text"
            defaultValue={displayVal}
            onBlur={(e) => {
              const nums = e.target.value
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => !isNaN(n) && n > 0)
              onChange(nums)
            }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
            placeholder={field.hint ?? 'Comma-separated numbers'}
          />
        </div>
      )
    }

    default:
      return null
  }
}

// Fallback for params not covered by schema (generic rendering)
function FallbackField({
  name,
  value,
  onChange,
}: {
  name: string
  value: unknown
  onChange: (v: unknown) => void
}) {
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
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide flex justify-between">
          <span>{label}</span>
          <span className="text-zinc-300">{value}</span>
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

  return null
}
