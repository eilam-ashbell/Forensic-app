import type { ToolStatus } from '../../types/tools'

interface Props {
  status: ToolStatus
}

const CONFIG: Record<ToolStatus, { label: string; className: string }> = {
  idle: { label: 'idle', className: 'bg-zinc-700 text-zinc-400' },
  running: { label: 'running', className: 'bg-blue-900 text-blue-300 animate-pulse' },
  done: { label: 'done', className: 'bg-emerald-900 text-emerald-300' },
  error: { label: 'error', className: 'bg-red-900 text-red-300' },
}

export function StatusBadge({ status }: Props) {
  const { label, className } = CONFIG[status]
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${className}`}>{label}</span>
  )
}
