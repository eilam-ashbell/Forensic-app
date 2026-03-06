import { useState } from 'react'
import { useStore } from '../../store'
import { TOOL_REGISTRY } from '../../constants/tools'
import { StatusBadge } from '../shared/StatusBadge'
import { OverlayResult } from './renderers/OverlayResult'
import { TableResult } from './renderers/TableResult'
import type { ToolId, ToolResult } from '../../types/tools'

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
        open ? 'h-72' : 'h-8'
      }`}
    >
      <div
        className="flex items-center gap-2 px-3 h-8 border-b border-zinc-700 cursor-pointer select-none shrink-0"
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
          <div className="w-44 border-r border-zinc-700 overflow-y-auto shrink-0">
            {completedTools.length === 0 ? (
              <p className="text-xs text-zinc-600 p-3">No results yet. Run a tool.</p>
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

          <div className="flex-1 overflow-auto p-3">
            {activeTab ? (
              <ResultContent toolId={activeTab} />
            ) : (
              <p className="text-xs text-zinc-600">Select a result on the left</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultContent({ toolId }: { toolId: ToolId }) {
  const state = useStore((s) => s.toolStates[toolId])
  if (state.status === 'error') return <p className="text-xs text-red-400">{state.error}</p>
  if (!state.result) return null
  return <ToolResultView result={state.result} />
}

function ToolResultView({ result }: { result: ToolResult }) {
  switch (result.toolId) {
    case 'metadata-viewer':
      return (
        <TableResult
          rows={result.entries.map((e) => ({
            Group: e.group,
            Key: e.key,
            Value: String(e.value ?? ''),
            Flag: e.forensicFlag ? '⚑' : '',
          }))}
          columns={['Group', 'Key', 'Value', 'Flag']}
          highlight={(row) => row['Flag'] === '⚑'}
        />
      )

    case 'file-structure-inspector':
      return (
        <TableResult
          rows={result.chunks.map((c) => ({
            Offset: `0x${c.offset.toString(16).toUpperCase()}`,
            Type: c.type,
            Length: c.length,
            Description: c.description,
          }))}
          columns={['Offset', 'Type', 'Length', 'Description']}
        />
      )

    case 'jpeg-quantization':
      return (
        <div className="space-y-4">
          {result.tables.map((t) => (
            <div key={t.id}>
              <p className="text-xs font-medium text-zinc-300 mb-1">
                Table {t.id} — Estimated quality:{' '}
                <span className="text-blue-400 font-bold">{t.estimatedQuality}%</span>
              </p>
              <div className="grid grid-cols-8 gap-px text-[9px] font-mono w-fit">
                {t.coefficients.map((v, i) => {
                  const heat = Math.min(1, v / 128)
                  return (
                    <div
                      key={i}
                      className="w-6 h-5 flex items-center justify-center"
                      style={{
                        background: `rgb(${Math.round(heat * 180)},${Math.round((1 - heat) * 80)},${Math.round((1 - heat) * 120)})`,
                        color: heat > 0.5 ? '#fff' : '#000',
                      }}
                      title={String(v)}
                    >
                      {v}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )

    case 'ela':
      return (
        <OverlayResult
          dataUrl={result.data.overlayDataUrl}
          stats={[
            { label: 'Quality used', value: result.data.params.quality },
            { label: 'Amplify factor', value: `${result.data.params.amplify}×` },
            { label: 'Max difference', value: result.data.maxDifference },
            { label: 'Mean difference', value: result.data.meanDifference },
          ]}
        />
      )

    case 'multi-quality-ela':
      return (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {result.data.results.map((r) => (
              <div key={r.quality} className="text-center">
                <img
                  src={r.overlayDataUrl}
                  alt={`Q${r.quality}`}
                  className="w-24 h-auto rounded border border-zinc-700"
                />
                <p className="text-[10px] text-zinc-400 mt-0.5">Q{r.quality} · avg {r.meanDifference}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1">Composite</p>
            <img
              src={result.data.compositeDataUrl}
              alt="Composite ELA"
              className="w-32 h-auto rounded border border-zinc-700"
            />
          </div>
        </div>
      )

    case 'noise-map':
      return (
        <OverlayResult
          dataUrl={result.data.overlayDataUrl}
          stats={[{ label: 'Mean noise level', value: result.data.meanNoise.toFixed(2) }]}
        />
      )

    case 'fft-spectrum':
      return (
        <OverlayResult
          dataUrl={result.data.spectrumDataUrl}
          stats={result.data.dominantFrequencies.slice(0, 3).map((f, i) => ({
            label: `Peak ${i + 1}`,
            value: `fx=${f.fx} fy=${f.fy} mag=${f.magnitude.toFixed(2)}`,
          }))}
        />
      )

    case 'dct-viewer':
      return (
        <OverlayResult
          dataUrl={result.data.overlayDataUrl}
          stats={[{ label: 'Coefficient index', value: result.data.coefficientIndex }]}
        />
      )

    case 'block-artifact-visualizer':
      return (
        <OverlayResult
          dataUrl={result.data.overlayDataUrl}
          stats={[{ label: 'Average boundary strength', value: result.data.averageStrength.toFixed(2) }]}
        />
      )

    case 'channel-separator':
      return (
        <div className="flex gap-2 flex-wrap">
          {result.channels.map((ch) => (
            <div key={ch.channel} className="text-center">
              <img
                src={ch.dataUrl}
                alt={ch.channel}
                className="w-20 h-auto rounded border border-zinc-700"
              />
              <p className="text-[10px] text-zinc-400 mt-0.5">{ch.channel}</p>
              <p className="text-[9px] text-zinc-600">μ={ch.mean.toFixed(1)} σ={ch.stdDev.toFixed(1)}</p>
            </div>
          ))}
        </div>
      )

    case 'histogram-analyzer': {
      const maxCount = Math.max(...result.data.bins.map((b) => Math.max(b.r, b.g, b.b)), 1)
      return (
        <div>
          <p className="text-[10px] text-zinc-500 mb-2">Histogram (256 bins)</p>
          <div className="flex items-end gap-px h-20 w-full bg-zinc-950 rounded">
            {result.data.bins.map((bin) => (
              <div key={bin.value} className="flex-1 flex flex-col-reverse gap-px items-stretch">
                <div style={{ height: `${(bin.r / maxCount) * 80}px` }} className="bg-red-500/70 min-h-px" />
                <div style={{ height: `${(bin.g / maxCount) * 80}px` }} className="bg-green-500/70 min-h-px" />
                <div style={{ height: `${(bin.b / maxCount) * 80}px` }} className="bg-blue-500/70 min-h-px" />
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-1 text-[10px]">
            <span className="text-red-400">■ R</span>
            <span className="text-green-400">■ G</span>
            <span className="text-blue-400">■ B</span>
          </div>
        </div>
      )
    }

    case 'lsb-visualizer':
      return (
        <OverlayResult
          dataUrl={result.data.overlayDataUrl}
          stats={[
            { label: 'Channel', value: result.data.channel.toUpperCase() },
            { label: 'Bit plane', value: result.data.bitPlane },
            {
              label: 'Randomness score',
              value: `${(result.data.randomnessScore * 100).toFixed(1)}% ${
                result.data.randomnessScore > 0.85 ? '⚑ Suspicious' : 'Normal'
              }`,
            },
          ]}
        />
      )

    case 'hex-viewer':
      return (
        <div className="font-mono text-[10px] overflow-auto max-h-48">
          <p className="text-zinc-500 mb-1">Total file size: {result.totalBytes.toLocaleString()} bytes</p>
          {result.lines.map((line) => (
            <div key={line.offset} className="flex gap-3 text-zinc-300 hover:bg-zinc-800/50 px-1">
              <span className="text-zinc-600 w-20 shrink-0">
                {line.offset.toString(16).toUpperCase().padStart(8, '0')}
              </span>
              <span className="text-emerald-400 flex-1 tracking-wider">{line.hex.join(' ')}</span>
              <span className="text-zinc-500 w-16 shrink-0">{line.ascii}</span>
            </div>
          ))}
        </div>
      )

    case 'string-extractor':
      return (
        <TableResult
          rows={result.strings.map((s) => ({
            Offset: `0x${s.offset.toString(16).toUpperCase()}`,
            Enc: s.encoding,
            Len: s.length,
            Value: s.value,
          }))}
          columns={['Offset', 'Enc', 'Len', 'Value']}
          maxRows={100}
        />
      )

    default:
      return (
        <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(result, null, 2)}
        </pre>
      )
  }
}
