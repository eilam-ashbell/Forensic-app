import { ToolList } from '../tools/ToolList'

export function LeftSidebar() {
  return (
    <aside className="w-52 shrink-0 bg-zinc-900 border-r border-zinc-700 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-700 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Analysis Tools
      </div>
      <ToolList />
    </aside>
  )
}
