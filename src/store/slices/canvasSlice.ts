export type AnnotationMode = 'select' | 'rect' | 'freehand' | 'text' | null

export interface CanvasSlice {
  zoom: number
  panX: number
  panY: number
  overlayOpacity: number
  showOverlay: boolean
  annotationMode: AnnotationMode
  annotationColor: string
  annotationStrokeWidth: number
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  setOverlayOpacity: (opacity: number) => void
  toggleOverlay: () => void
  resetView: () => void
  setAnnotationMode: (mode: AnnotationMode) => void
  setAnnotationColor: (color: string) => void
  setAnnotationStrokeWidth: (width: number) => void
}

export const createCanvasSlice = (
  set: (fn: (state: CanvasSlice) => Partial<CanvasSlice>) => void,
): CanvasSlice => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  overlayOpacity: 0.7,
  showOverlay: true,
  annotationMode: null,
  annotationColor: '#f97316', // orange-500
  annotationStrokeWidth: 2,
  setZoom: (zoom) => set(() => ({ zoom: Math.max(0.1, Math.min(10, zoom)) })),
  setPan: (panX, panY) => set(() => ({ panX, panY })),
  setOverlayOpacity: (overlayOpacity) => set(() => ({ overlayOpacity })),
  toggleOverlay: () => set((s) => ({ showOverlay: !s.showOverlay })),
  resetView: () => set(() => ({ zoom: 1, panX: 0, panY: 0 })),
  setAnnotationMode: (annotationMode) => set(() => ({ annotationMode })),
  setAnnotationColor: (annotationColor) => set(() => ({ annotationColor })),
  setAnnotationStrokeWidth: (annotationStrokeWidth) => set(() => ({ annotationStrokeWidth })),
})
