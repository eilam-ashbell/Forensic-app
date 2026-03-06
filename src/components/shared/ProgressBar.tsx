interface Props {
  progress: number // 0-100
  className?: string
}

export function ProgressBar({ progress, className = '' }: Props) {
  return (
    <div className={`w-full bg-zinc-800 rounded-full h-1 ${className}`}>
      <div
        className="bg-blue-500 h-1 rounded-full transition-all duration-200"
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
  )
}
