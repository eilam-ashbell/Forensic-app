import { useStore } from '../../store'
import { useImageLoader } from '../../hooks/useImageLoader'

export function TopBar() {
  const sessionName = useStore((s) => s.sessionName)
  const setSessionName = useStore((s) => s.setSessionName)
  const image = useStore((s) => s.image)
  const { loadFile } = useImageLoader()

  const handleFileOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  return (
    <header className="flex items-center gap-3 px-4 h-11 bg-zinc-900 border-b border-zinc-700 shrink-0">
      <span className="text-blue-400 font-bold text-sm tracking-wider mr-2">IFW</span>

      {/* File open */}
      <label className="cursor-pointer">
        <span className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors">
          Open
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={handleFileOpen} />
      </label>

      {/* Session name */}
      <input
        value={sessionName}
        onChange={(e) => setSessionName(e.target.value)}
        className="flex-1 max-w-xs bg-transparent text-zinc-300 text-sm border-b border-transparent hover:border-zinc-600 focus:border-blue-500 focus:outline-none px-1 py-0.5"
        placeholder="Session name"
      />

      {/* Image info */}
      {image && (
        <span className="text-zinc-500 text-xs ml-auto">
          {image.dimensions.width}×{image.dimensions.height}px &nbsp;·&nbsp;
          {image.megapixels.toFixed(1)}MP &nbsp;·&nbsp;
          {(image.file.size / 1024).toFixed(0)} KB
        </span>
      )}

      {/* About */}
      <button className="ml-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
        About
      </button>
    </header>
  )
}
