interface Row {
  [key: string]: string | number | boolean | null
}

interface Props {
  rows: Row[]
  columns: string[]
  highlight?: (row: Row) => boolean
  maxRows?: number
}

export function TableResult({ rows, columns, highlight, maxRows = 200 }: Props) {
  const visible = rows.slice(0, maxRows)
  return (
    <div className="overflow-auto max-h-48">
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} className="text-left text-zinc-500 font-medium pb-1 pr-4 border-b border-zinc-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-zinc-800/50 ${highlight?.(row) ? 'text-amber-300' : 'text-zinc-300'}`}
            >
              {columns.map((col) => (
                <td key={col} className="py-0.5 pr-4 font-mono truncate max-w-xs">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p className="text-[10px] text-zinc-600 mt-1">
          Showing {maxRows} of {rows.length} rows
        </p>
      )}
    </div>
  )
}
