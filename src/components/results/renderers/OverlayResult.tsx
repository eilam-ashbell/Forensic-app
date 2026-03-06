/** Renders a tool result that produces an overlay image + stats */
interface Props {
  dataUrl: string
  stats?: Array<{ label: string; value: string | number }>
}

export function OverlayResult({ dataUrl, stats }: Props) {
  return (
    <div className="space-y-3">
      <img
        src={dataUrl}
        alt="Analysis overlay"
        className="w-full max-w-sm rounded border border-zinc-700 object-contain"
        style={{ imageRendering: 'pixelated' }}
      />
      {stats && stats.length > 0 && (
        <table className="text-xs w-full">
          <tbody>
            {stats.map(({ label, value }) => (
              <tr key={label} className="border-b border-zinc-800">
                <td className="py-1 pr-4 text-zinc-500 w-40">{label}</td>
                <td className="py-1 text-zinc-200 font-mono">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
