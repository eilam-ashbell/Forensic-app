import { useState } from 'react'
import { TOOL_REGISTRY, TOOL_CATEGORIES, getToolsByCategory } from '../../constants/tools'
import { useStore } from '../../store'
import { StatusBadge } from '../shared/StatusBadge'

export function ToolList() {
  const [query, setQuery] = useState('')
  const activeToolId = useStore((s) => s.activeToolId)
  const setActiveTool = useStore((s) => s.setActiveTool)
  const toolStates = useStore((s) => s.toolStates)
  const image = useStore((s) => s.image)

  const q = query.trim().toLowerCase()
  const filteredTools = q
    ? TOOL_REGISTRY.filter(
        (t) => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
      )
    : null

  const renderToolButton = (tool: (typeof TOOL_REGISTRY)[0]) => {
    const state = toolStates[tool.id]
    const isActive = activeToolId === tool.id
    const jpegDisabled = tool.jpegOnly && image && !image.isJpeg
    return (
      <button
        key={tool.id}
        onClick={() => setActiveTool(tool.id)}
        disabled={!!jpegDisabled}
        title={jpegDisabled ? 'JPEG only' : tool.description}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
          isActive
            ? 'bg-blue-900/50 text-blue-200'
            : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
        } ${jpegDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="truncate text-xs">{tool.label}</span>
        <StatusBadge status={state.status} />
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-2 py-2 shrink-0 border-b border-zinc-800">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            aria-label="Search tools"
            className="w-full bg-zinc-800 text-zinc-200 text-xs px-2 py-1.5 pr-6 rounded border border-zinc-700 focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-[10px]"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tool list */}
      <nav className="flex flex-col overflow-y-auto flex-1 text-sm">
        {filteredTools ? (
          filteredTools.length > 0 ? (
            filteredTools.map(renderToolButton)
          ) : (
            <p className="text-xs text-zinc-600 px-3 pt-3">No tools match "{query}"</p>
          )
        ) : (
          TOOL_CATEGORIES.map((category) => {
            const tools = getToolsByCategory(category)
            return (
              <div key={category}>
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  {category}
                </div>
                {tools.map(renderToolButton)}
              </div>
            )
          })
        )}
      </nav>
    </div>
  )
}
