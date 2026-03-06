import { TOOL_CATEGORIES, getToolsByCategory } from '../../constants/tools'
import { useStore } from '../../store'
import { StatusBadge } from '../shared/StatusBadge'

export function ToolList() {
  const activeToolId = useStore((s) => s.activeToolId)
  const setActiveTool = useStore((s) => s.setActiveTool)
  const toolStates = useStore((s) => s.toolStates)
  const image = useStore((s) => s.image)

  return (
    <nav className="flex flex-col overflow-y-auto h-full text-sm">
      {TOOL_CATEGORIES.map((category) => {
        const tools = getToolsByCategory(category)
        return (
          <div key={category}>
            <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {category}
            </div>
            {tools.map((tool) => {
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
            })}
          </div>
        )
      })}
    </nav>
  )
}
