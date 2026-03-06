import { useEffect, useRef } from 'react'
import { Canvas, FabricImage } from 'fabric'
import { useStore } from '../../store'
import { FileDropzone } from '../shared/FileDropzone'
import type { ToolResult } from '../../types/tools'

/** Extract the primary overlay data URL from a tool result (if any) */
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

export function ImageCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<FabricImage | null>(null)

  const image = useStore((s) => s.image)
  const { zoom, setZoom } = useStore((s) => ({ zoom: s.zoom, setZoom: s.setZoom }))
  const { overlayOpacity, showOverlay, toggleOverlay } = useStore((s) => ({
    overlayOpacity: s.overlayOpacity,
    showOverlay: s.showOverlay,
    toggleOverlay: s.toggleOverlay,
  }))
  const activeToolId = useStore((s) => s.activeToolId)
  const toolStates = useStore((s) => s.toolStates)

  // Active tool overlay data URL
  const activeOverlay = (() => {
    if (!activeToolId) return null
    const state = toolStates[activeToolId]
    if (state.status !== 'done' || !state.result) return null
    return getOverlayDataUrl(state.result)
  })()

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const container = containerRef.current
    const fabric = new Canvas(canvasRef.current, {
      backgroundColor: '#18181b',
      selection: false,
    })
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
    }
  }, [])

  // Load base image onto canvas
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric) return

    fabric.clear()
    fabric.backgroundColor = '#18181b'
    overlayRef.current = null

    if (!image) {
      fabric.renderAll()
      return
    }

    const oc = new OffscreenCanvas(image.imageData.width, image.imageData.height)
    const ctx = oc.getContext('2d')!
    ctx.putImageData(image.imageData, 0, 0)
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
        selectable: false,
        evented: false,
      })
      fabric.add(img)
      fabric.renderAll()
    })
  }, [image])

  // Sync overlay when active tool result changes
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric || !image) return

    // Remove old overlay
    if (overlayRef.current) {
      fabric.remove(overlayRef.current)
      overlayRef.current = null
    }

    if (!activeOverlay || !showOverlay) {
      fabric.renderAll()
      return
    }

    FabricImage.fromURL(activeOverlay).then((img) => {
      const cw = fabric.width ?? 800
      const ch = fabric.height ?? 600
      const scale = Math.min(cw / img.width!, ch / img.height!, 1)
      img.scale(scale)
      img.set({
        left: (cw - img.getScaledWidth()) / 2,
        top: (ch - img.getScaledHeight()) / 2,
        selectable: false,
        evented: false,
        opacity: overlayOpacity,
      })
      fabric.add(img)
      overlayRef.current = img
      fabric.renderAll()
    })
  }, [activeOverlay, showOverlay, overlayOpacity, image])

  // Zoom
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric) return
    const center = fabric.getCenterPoint()
    fabric.zoomToPoint(center, zoom)
  }, [zoom])

  // Mouse wheel zoom
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(zoom * delta)
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [zoom, setZoom])

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-zinc-950">
      {!image && (
        <div className="absolute inset-0 z-10">
          <FileDropzone />
        </div>
      )}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Overlay toggle button */}
      {image && activeOverlay && (
        <button
          onClick={toggleOverlay}
          className={`absolute bottom-2 right-2 z-20 px-2 py-1 text-[10px] rounded transition-colors ${
            showOverlay
              ? 'bg-blue-700 text-white hover:bg-blue-600'
              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
          }`}
          title="Toggle overlay (O)"
        >
          {showOverlay ? 'Overlay ON' : 'Overlay OFF'}
        </button>
      )}
    </div>
  )
}
