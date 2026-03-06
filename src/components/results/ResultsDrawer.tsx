import { useState } from 'react'
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useStore } from '../../store'
import { TOOL_REGISTRY } from '../../constants/tools'
import { StatusBadge } from '../shared/StatusBadge'
import { OverlayResult } from './renderers/OverlayResult'
import { TableResult } from './renderers/TableResult'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import type { ToolId, ToolResult } from '../../types/tools'

export function ResultsDrawer() {
  const [open, setOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<ToolId | null>(null)
  const toolStates = useStore((s) => s.toolStates)
  const resetToolResult = useStore((s) => s.resetToolResult)

  const completedTools = TOOL_REGISTRY.filter(
    (t) => toolStates[t.id].status === 'done' || toolStates[t.id].status === 'error',
  )

  return (
    <div
      className={`shrink-0 bg-zinc-900 border-t border-zinc-700 flex flex-col transition-all duration-200 ${
        open ? 'h-72' : 'h-8'
      }`}
    >
      <button
        className="flex items-center gap-2 px-3 h-8 border-b border-zinc-700 cursor-pointer select-none shrink-0 w-full text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Collapse results drawer' : 'Expand results drawer'}
      >
        <span className="text-zinc-400 text-xs" aria-hidden="true">{open ? '▼' : '▲'}</span>
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Results</span>
        {completedTools.length > 0 && (
          <span className="ml-2 text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded" aria-label={`${completedTools.length} results`}>
            {completedTools.length}
          </span>
        )}
      </button>

      {open && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-44 border-r border-zinc-700 overflow-y-auto shrink-0">
            {completedTools.length === 0 ? (
              <p className="text-xs text-zinc-600 p-3">No results yet. Run a tool.</p>
            ) : (
              completedTools.map((t) => (
                <div
                  key={t.id}
                  className={`w-full flex items-center text-xs transition-colors ${
                    activeTab === t.id
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  <button
                    onClick={() => setActiveTab(t.id)}
                    aria-label={`View ${t.label} result`}
                    aria-pressed={activeTab === t.id}
                    className="flex-1 flex items-center justify-between px-3 py-2 text-left min-w-0"
                  >
                    <span className="truncate">{t.label}</span>
                    <StatusBadge status={toolStates[t.id].status} />
                  </button>
                  <button
                    onClick={() => {
                      resetToolResult(t.id)
                      if (activeTab === t.id) setActiveTab(null)
                    }}
                    aria-label={`Clear ${t.label} result`}
                    title="Clear result"
                    className="shrink-0 px-2 py-2 text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex-1 overflow-auto p-3">
            {activeTab ? (
              <ErrorBoundary label={activeTab}>
                <ResultContent toolId={activeTab} />
              </ErrorBoundary>
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
  return <ToolResultView result={state.result} params={state.params} />
}

function ToolResultView({ result, params }: { result: ToolResult; params: Record<string, unknown> }) {
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
      const logScale = !!(params['logScale'])
      const chartData = result.data.bins.map((b) => ({
        value: b.value,
        r: b.r,
        g: b.g,
        b: b.b,
      }))
      return (
        <div>
          <p className="text-[10px] text-zinc-500 mb-2">Pixel value distribution (256 bins)</p>
          <ResponsiveContainer width="100%" height={140}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <XAxis
                dataKey="value"
                tick={{ fontSize: 9, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                interval={63}
              />
              <YAxis
                scale={logScale ? 'log' : 'linear'}
                domain={logScale ? ['auto', 'auto'] : [0, 'auto']}
                tick={{ fontSize: 9, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', fontSize: 10 }}
                labelFormatter={(v) => `Value: ${v}`}
                formatter={(val, name) => [Math.round(Number(val ?? 0)), String(name).toUpperCase()]}
              />
              <Area type="monotone" dataKey="r" stroke="#f87171" fill="#f87171" fillOpacity={0.3} strokeWidth={1} dot={false} />
              <Area type="monotone" dataKey="g" stroke="#4ade80" fill="#4ade80" fillOpacity={0.3} strokeWidth={1} dot={false} />
              <Area type="monotone" dataKey="b" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.3} strokeWidth={1} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
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

    // Phase 4 renderers
    case 'keypoint-clone':
    case 'block-matching-clone':
      return (
        <div className="space-y-2">
          <OverlayResult
            dataUrl={result.data.overlayDataUrl}
            stats={[
              { label: 'Matches found', value: result.data.matchCount },
              { label: 'Shown (cyan=src, magenta=dst)', value: '' },
            ]}
          />
          {result.data.matches.length > 0 && (
            <TableResult
              rows={result.data.matches.slice(0, 20).map((m) => ({
                'Src X': m.srcX, 'Src Y': m.srcY,
                'Dst X': m.dstX, 'Dst Y': m.dstY,
                Conf: m.confidence.toFixed(3),
              }))}
              columns={['Src X', 'Src Y', 'Dst X', 'Dst Y', 'Conf']}
              maxRows={20}
            />
          )}
        </div>
      )

    case 'prnu':
      return (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-zinc-500 mb-1">Noise Residual</p>
            <img src={result.data.residualDataUrl} alt="PRNU residual" className="w-full max-w-xs rounded border border-zinc-700" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 mb-1">Autocorrelation Map</p>
            <img src={result.data.correlationDataUrl} alt="Autocorrelation" className="w-32 h-auto rounded border border-zinc-700" />
          </div>
        </div>
      )

    case 'lighting-estimator':
      return (
        <OverlayResult
          dataUrl={result.data.overlayDataUrl}
          stats={[
            { label: 'Estimated angle', value: `${result.data.estimatedAngleDegrees}°` },
            { label: 'Confidence', value: `${(result.data.confidence * 100).toFixed(1)}%` },
          ]}
        />
      )

    case 'stego-stats':
      return (
        <div className="space-y-3">
          {result.tests.map((t) => (
            <div key={t.test} className="border border-zinc-800 rounded p-2">
              <p className="text-xs font-medium text-zinc-300 mb-1 capitalize">{t.test.replace(/-/g, ' ')}</p>
              <p className="text-[10px] font-mono text-zinc-400">
                Statistic: <span className="text-zinc-200">{t.statistic.toFixed(4)}</span>
                {t.pValue !== undefined && (
                  <> · p={t.pValue.toFixed(4)}</>
                )}
              </p>
              {t.estimatedPayloadFraction !== undefined && (
                <p className="text-[10px] font-mono text-zinc-400">
                  Payload: <span className={t.estimatedPayloadFraction > 0.05 ? 'text-amber-300' : 'text-emerald-400'}>
                    {(t.estimatedPayloadFraction * 100).toFixed(1)}%
                  </span>
                </p>
              )}
              <p className={`text-[10px] mt-1 ${t.interpretation.includes('suspected') || t.interpretation.includes('present') ? 'text-amber-300' : 'text-zinc-500'}`}>
                {t.interpretation}
              </p>
            </div>
          ))}
        </div>
      )

    case 'ai-forgery-detector':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded">Heuristic mode — no ONNX model loaded</span>
          </div>
          <OverlayResult
            dataUrl={result.data.overlayDataUrl}
            stats={[
              { label: 'Global score', value: `${(result.data.globalScore * 100).toFixed(1)}%` },
              { label: 'Confidence', value: `${(result.data.confidence * 100).toFixed(0)}%` },
            ]}
          />
        </div>
      )

    default:
      return (
        <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(result, null, 2)}
        </pre>
      )
  }
}
