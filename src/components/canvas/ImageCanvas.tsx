import { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, FabricImage, Rect, IText, PencilBrush, Point } from 'fabric'
import { useStore } from '../../store'
import { FileDropzone } from '../shared/FileDropzone'
import { AnnotationToolbar } from './AnnotationToolbar'
import type { ToolResult } from '../../types/tools'

const UNDO_LIMIT = 50
const BASE_TAG = '__base__'
const OVERLAY_TAG = '__overlay__'

function getOverlayDataUrl(result: ToolResult): string | null {
  switch (result.toolId) {
    case 'ela':
    case 'noise-map':
    case 'dct-viewer':
    case 'block-artifact-visualizer':
    case 'lsb-visualizer':
    case 'lighting-estimator':
    case 'ai-forgery-detector':
      return result.data.overlayDataUrl
    case 'fft-spectrum':
      return result.data.spectrumDataUrl
    case 'multi-quality-ela':
      return result.data.compositeDataUrl
    case 'prnu':
      return result.data.residualDataUrl
    case 'keypoint-clone':
    case 'block-matching-clone':
      return result.data.overlayDataUrl
    default:
      return null
  }
}

function isAnnotation(o: object): boolean {
  const tagged = o as { tag?: string }
  return tagged.tag !== BASE_TAG && tagged.tag !== OVERLAY_TAG
}

export function ImageCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<FabricImage | null>(null)
  const isDrawingRectRef = useRef(false)
  const rectOriginRef = useRef<{ x: number; y: number } | null>(null)
  const activeRectRef = useRef<Rect | null>(null)
  const isPanningRef = useRef(false)
  const panLastRef = useRef<{ x: number; y: number } | null>(null)

  const [undoStack, setUndoStack] = useState<string[]>([])

  const image = useStore((s) => s.image)
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)
  const overlayOpacity = useStore((s) => s.overlayOpacity)
  const setOverlayOpacity = useStore((s) => s.setOverlayOpacity)
  const showOverlay = useStore((s) => s.showOverlay)
  const toggleOverlay = useStore((s) => s.toggleOverlay)
  const annotationMode = useStore((s) => s.annotationMode)
  const annotationColor = useStore((s) => s.annotationColor)
  const annotationStrokeWidth = useStore((s) => s.annotationStrokeWidth)
  const setAnnotationMode = useStore((s) => s.setAnnotationMode)
  const activeToolId = useStore((s) => s.activeToolId)
  const toolStates = useStore((s) => s.toolStates)

  const activeOverlay = (() => {
    if (!activeToolId) return null
    const state = toolStates[activeToolId]
    if (state.status !== 'done' || !state.result) return null
    return getOverlayDataUrl(state.result)
  })()

  const getAnnotations = useCallback(() => {
    return (fabricRef.current?.getObjects() ?? []).filter(isAnnotation)
  }, [])

  const pushUndo = useCallback(() => {
    const snap = JSON.stringify(getAnnotations().map((o) => o.toObject(['tag'])))
    setUndoStack((prev) => {
      const next = [...prev, snap]
      return next.length > UNDO_LIMIT ? next.slice(-UNDO_LIMIT) : next
    })
  }, [getAnnotations])

  const handleUndo = useCallback(() => {
    const fabric = fabricRef.current
    if (!fabric || undoStack.length === 0) return
    getAnnotations().forEach((o) => fabric.remove(o))
    const restore = undoStack.length >= 2 ? undoStack[undoStack.length - 2] : '[]'
    const parsed: object[] = JSON.parse(restore)
    if (parsed.length > 0) {
      fabric.loadFromJSON({ version: '6.0.0', objects: parsed }).then(() => fabric.renderAll())
    } else {
      fabric.renderAll()
    }
    setUndoStack((prev) => prev.slice(0, -1))
  }, [undoStack, getAnnotations])

  const handleClear = useCallback(() => {
    const fabric = fabricRef.current
    if (!fabric) return
    pushUndo()
    getAnnotations().forEach((o) => fabric.remove(o))
    fabric.renderAll()
  }, [pushUndo, getAnnotations])

  // Init canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const container = containerRef.current
    const fabric = new Canvas(canvasRef.current, { backgroundColor: '#09090b', selection: false })
    fabricRef.current = fabric
    const resize = () => {
      fabric.setDimensions({ width: container.clientWidth, height: container.clientHeight })
      fabric.renderAll()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    return () => {
      observer.disconnect()
      fabric.dispose()
      fabricRef.current = null
      overlayRef.current = null
    }
  }, [])

  // Load base image
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric) return
    fabric.clear()
    fabric.backgroundColor = '#09090b'
    overlayRef.current = null
    setUndoStack([])
    if (!image) { fabric.renderAll(); return }
    const oc = new OffscreenCanvas(image.imageData.width, image.imageData.height)
    oc.getContext('2d')!.putImageData(image.imageData, 0, 0)
    oc.convertToBlob({ type: 'image/png' }).then(async (blob) => {
      const url = URL.createObjectURL(blob)
      const img = await FabricImage.fromURL(url)
      URL.revokeObjectURL(url)
      const cw = fabric.width ?? 800
      const ch = fabric.height ?? 600
      const scale = Math.min(cw / img.width!, ch / img.height!, 1)
      img.scale(scale)
      img.set({
        left: (cw - img.getScaledWidth()) / 2,
        top: (ch - img.getScaledHeight()) / 2,
        selectable: false, evented: false,
        tag: BASE_TAG,
      })
      fabric.add(img)
      fabric.renderAll()
    })
  }, [image])

  // Sync overlay
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric || !image) return
    if (overlayRef.current) { fabric.remove(overlayRef.current); overlayRef.current = null }
    if (!activeOverlay || !showOverlay) { fabric.renderAll(); return }
    FabricImage.fromURL(activeOverlay).then((img) => {
      const cw = fabric.width ?? 800
      const ch = fabric.height ?? 600
      const scale = Math.min(cw / img.width!, ch / img.height!, 1)
      img.scale(scale)
      img.set({
        left: (cw - img.getScaledWidth()) / 2,
        top: (ch - img.getScaledHeight()) / 2,
        selectable: false, evented: false, opacity: overlayOpacity,
        tag: OVERLAY_TAG,
      })
      fabric.add(img)
      fabric.moveObjectTo(img, Math.min(1, fabric.getObjects().length - 1))
      overlayRef.current = img
      fabric.renderAll()
    })
  }, [activeOverlay, showOverlay, overlayOpacity, image])

  // Annotation mode config
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric) return
    fabric.isDrawingMode = false
    fabric.selection = annotationMode === 'select'
    getAnnotations().forEach((o) => {
      o.set({ selectable: annotationMode === 'select', evented: annotationMode === 'select' })
    })
    if (annotationMode === 'freehand') {
      fabric.isDrawingMode = true
      const brush = new PencilBrush(fabric)
      brush.color = annotationColor
      brush.width = annotationStrokeWidth
      fabric.freeDrawingBrush = brush
    }
    fabric.renderAll()
  }, [annotationMode, annotationColor, annotationStrokeWidth, getAnnotations])

  // Rectangle events
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric || annotationMode !== 'rect') return
    const onDown = (opt: { e: Event & { clientX?: number; clientY?: number } }) => {
      const p = fabric.getViewportPoint(opt.e as PointerEvent) // eslint-disable-line
      isDrawingRectRef.current = true
      rectOriginRef.current = p
      const r = new Rect({
        left: p.x, top: p.y, width: 0, height: 0,
        fill: 'transparent', stroke: annotationColor,
        strokeWidth: annotationStrokeWidth, selectable: false, evented: false,
      })
      fabric.add(r)
      activeRectRef.current = r
    }
    const onMove = (opt: { e: Event & { clientX?: number; clientY?: number } }) => {
      if (!isDrawingRectRef.current || !rectOriginRef.current || !activeRectRef.current) return
      const p = fabric.getViewportPoint(opt.e as PointerEvent) // eslint-disable-line
      const { x: ox, y: oy } = rectOriginRef.current
      activeRectRef.current.set({
        left: Math.min(ox, p.x), top: Math.min(oy, p.y),
        width: Math.abs(p.x - ox), height: Math.abs(p.y - oy),
      })
      fabric.renderAll()
    }
    const onUp = () => {
      if (!isDrawingRectRef.current) return
      isDrawingRectRef.current = false
      rectOriginRef.current = null
      if (activeRectRef.current) {
        const r = activeRectRef.current
        activeRectRef.current = null
        if ((r.width ?? 0) < 4 && (r.height ?? 0) < 4) fabric.remove(r)
        else pushUndo()
      }
      fabric.renderAll()
    }
    fabric.on('mouse:down', onDown)
    fabric.on('mouse:move', onMove)
    fabric.on('mouse:up', onUp)
    return () => { fabric.off('mouse:down', onDown); fabric.off('mouse:move', onMove); fabric.off('mouse:up', onUp) }
  }, [annotationMode, annotationColor, annotationStrokeWidth, pushUndo])

  // Text events
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric || annotationMode !== 'text') return
    const onDbl = (opt: { e: Event & { clientX?: number; clientY?: number } }) => {
      const p = fabric.getViewportPoint(opt.e as PointerEvent) // eslint-disable-line
      const txt = new IText('Label', {
        left: p.x, top: p.y, fill: annotationColor,
        fontSize: 14, fontFamily: 'monospace', selectable: true, evented: true,
      })
      fabric.add(txt)
      fabric.setActiveObject(txt)
      txt.enterEditing()
      pushUndo()
    }
    fabric.on('mouse:dblclick', onDbl)
    return () => { fabric.off('mouse:dblclick', onDbl) }
  }, [annotationMode, annotationColor, pushUndo])

  // Freehand path → undo
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric) return
    const onPath = () => pushUndo()
    fabric.on('path:created', onPath)
    return () => { fabric.off('path:created', onPath) }
  }, [pushUndo])

  // Pan (drag) — only when no annotation mode is active
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric || annotationMode !== null) return
    const onDown = (opt: { e: Event }) => {
      if (!image) return
      isPanningRef.current = true
      const e = opt.e as PointerEvent
      panLastRef.current = { x: e.clientX, y: e.clientY }
      fabric.setCursor('grab')
    }
    const onMove = (opt: { e: Event }) => {
      if (!isPanningRef.current || !panLastRef.current) return
      const e = opt.e as PointerEvent
      const dx = e.clientX - panLastRef.current.x
      const dy = e.clientY - panLastRef.current.y
      fabric.relativePan(new Point(dx, dy))
      panLastRef.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => {
      isPanningRef.current = false
      panLastRef.current = null
      fabric.setCursor('default')
    }
    fabric.on('mouse:down', onDown)
    fabric.on('mouse:move', onMove)
    fabric.on('mouse:up', onUp)
    return () => {
      fabric.off('mouse:down', onDown)
      fabric.off('mouse:move', onMove)
      fabric.off('mouse:up', onUp)
    }
  }, [annotationMode, image])

  // Zoom
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric) return
    const center = fabric.getCenterPoint(); fabric.zoomToPoint(new Point(center.x, center.y), zoom)
  }, [zoom])

  // Mouse wheel zoom
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(zoom * (e.deltaY > 0 ? 0.9 : 1.1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, setZoom])

  // Ctrl+Z + annotation hotkeys (V/D/T)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); return }
      if (!image) return
      const k = e.key.toLowerCase()
      if (k === 'v') { e.preventDefault(); setAnnotationMode('select') }
      if (k === 'd') { e.preventDefault(); setAnnotationMode('freehand') }
      if (k === 't') { e.preventDefault(); setAnnotationMode('text') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, image, setAnnotationMode])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {image && (
        <AnnotationToolbar onUndo={handleUndo} onClear={handleClear} canUndo={undoStack.length > 0} />
      )}
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-zinc-950">
        {!image && <div className="absolute inset-0 z-10"><FileDropzone /></div>}
        <canvas ref={canvasRef} className="absolute inset-0" aria-label="Image analysis canvas" role="img" />
        {image && activeOverlay && (
          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-2">
            {showOverlay && (
              <label className="flex items-center gap-1.5 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-700">
                <span className="text-[9px] text-zinc-400">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  className="w-16 h-1 accent-blue-500"
                  aria-label="Overlay opacity"
                />
                <span className="text-[9px] text-zinc-500 w-6">{Math.round(overlayOpacity * 100)}%</span>
              </label>
            )}
            <button
              onClick={toggleOverlay}
              aria-label={showOverlay ? 'Hide tool overlay' : 'Show tool overlay'}
              title="Toggle overlay (O)"
              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                showOverlay ? 'bg-blue-700 text-white hover:bg-blue-600' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
              }`}
            >
              {showOverlay ? 'Overlay ON' : 'Overlay OFF'}
            </button>
          </div>
        )}
        {annotationMode && (
          <div aria-live="polite" className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 text-[10px] bg-zinc-900/90 text-blue-300 rounded border border-blue-800 pointer-events-none">
            {annotationMode === 'rect' && 'Drag to draw rectangle'}
            {annotationMode === 'freehand' && 'Click and drag to draw'}
            {annotationMode === 'text' && 'Double-click to place text'}
            {annotationMode === 'select' && 'Click to select annotations'}
            <span className="ml-2 opacity-60">· Esc to exit · Ctrl+Z undo</span>
          </div>
        )}
      </div>
    </div>
  )
}
