import { ParamsPanel } from '../tools/ParamsPanel'

export function RightSidebar() {
  return (
    <aside className="w-60 shrink-0 bg-zinc-900 border-l border-zinc-700 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-700 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Parameters
      </div>
      <div className="flex-1 overflow-hidden">
        <ParamsPanel />
      </div>
    </aside>
  )
}
