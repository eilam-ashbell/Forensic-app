import { useEffect, useRef } from 'react'
import { Canvas, FabricImage } from 'fabric'
import { useStore } from '../../store'
import { FileDropzone } from '../shared/FileDropzone'

export function ImageCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const image = useStore((s) => s.image)
  const { zoom, setZoom } = useStore((s) => ({ zoom: s.zoom, setZoom: s.setZoom }))

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

  // Load image onto canvas when image record changes
  useEffect(() => {
    const fabric = fabricRef.current
    if (!fabric) return

    fabric.clear()
    fabric.backgroundColor = '#18181b'

    if (!image) {
      fabric.renderAll()
      return
    }

    // Convert ImageData to data URL via OffscreenCanvas
    const oc = new OffscreenCanvas(image.imageData.width, image.imageData.height)
    const ctx = oc.getContext('2d')!
    ctx.putImageData(image.imageData, 0, 0)
    oc.convertToBlob({ type: 'image/png' }).then(async (blob) => {
      const url = URL.createObjectURL(blob)
      const img = await FabricImage.fromURL(url)
      URL.revokeObjectURL(url)

      // Scale to fit canvas
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
    </div>
  )
}
