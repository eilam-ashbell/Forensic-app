export interface CanvasSlice {
  zoom: number
  panX: number
  panY: number
  overlayOpacity: number
  showOverlay: boolean
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  setOverlayOpacity: (opacity: number) => void
  toggleOverlay: () => void
  resetView: () => void
}

export const createCanvasSlice = (
  set: (fn: (state: CanvasSlice) => Partial<CanvasSlice>) => void,
): CanvasSlice => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  overlayOpacity: 0.7,
  showOverlay: true,
  setZoom: (zoom) => set(() => ({ zoom: Math.max(0.1, Math.min(10, zoom)) })),
  setPan: (panX, panY) => set(() => ({ panX, panY })),
  setOverlayOpacity: (overlayOpacity) => set(() => ({ overlayOpacity })),
  toggleOverlay: () => set((s) => ({ showOverlay: !s.showOverlay })),
  resetView: () => set(() => ({ zoom: 1, panX: 0, panY: 0 })),
})
