import { useState } from 'react'
import { useStore } from '../../store'
import { TOOL_REGISTRY } from '../../constants/tools'
import { StatusBadge } from '../shared/StatusBadge'
import type { ToolId } from '../../types/tools'

export function ResultsDrawer() {
  const [open, setOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<ToolId | null>(null)
  const toolStates = useStore((s) => s.toolStates)

  const completedTools = TOOL_REGISTRY.filter(
    (t) => toolStates[t.id].status === 'done' || toolStates[t.id].status === 'error',
  )

  return (
    <div
      className={`shrink-0 bg-zinc-900 border-t border-zinc-700 flex flex-col transition-all duration-200 ${
        open ? 'h-64' : 'h-8'
      }`}
    >
      {/* Handle bar */}
      <div
        className="flex items-center gap-2 px-3 h-8 border-b border-zinc-700 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-zinc-400 text-xs">{open ? '▼' : '▲'}</span>
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Results</span>
        {completedTools.length > 0 && (
          <span className="ml-2 text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
            {completedTools.length}
          </span>
        )}
      </div>

      {open && (
        <div className="flex flex-1 overflow-hidden">
          {/* Tab list */}
          <div className="w-48 border-r border-zinc-700 overflow-y-auto shrink-0">
            {completedTools.length === 0 ? (
              <p className="text-xs text-zinc-600 p-3">No results yet</p>
            ) : (
              completedTools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                    activeTab === t.id
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  <span className="truncate">{t.label}</span>
                  <StatusBadge status={toolStates[t.id].status} />
                </button>
              ))
            )}
          </div>

          {/* Result content */}
          <div className="flex-1 overflow-auto p-3">
            {activeTab ? (
              <ResultContent toolId={activeTab} />
            ) : (
              <p className="text-xs text-zinc-600">Select a result</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultContent({ toolId }: { toolId: ToolId }) {
  const state = useStore((s) => s.toolStates[toolId])
  if (state.status === 'error') {
    return <p className="text-xs text-red-400">{state.error}</p>
  }
  if (!state.result) {
    return <p className="text-xs text-zinc-600">No result</p>
  }
  return (
    <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre-wrap break-all">
      {JSON.stringify(state.result, null, 2)}
    </pre>
  )
}
