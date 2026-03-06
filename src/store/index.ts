import { create } from 'zustand'
import { createImageSlice, type ImageSlice } from './slices/imageSlice'
import { createToolSlice, type ToolSlice } from './slices/toolSlice'
import { createCanvasSlice, type CanvasSlice } from './slices/canvasSlice'
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice'

export type AppStore = ImageSlice & ToolSlice & CanvasSlice & SessionSlice

export const useStore = create<AppStore>()((set) => ({
  ...createImageSlice(set as Parameters<typeof createImageSlice>[0]),
  ...createToolSlice(set as Parameters<typeof createToolSlice>[0]),
  ...createCanvasSlice(set as Parameters<typeof createCanvasSlice>[0]),
  ...createSessionSlice(set as Parameters<typeof createSessionSlice>[0]),
}))

// Convenience typed selectors
export const useImage = () => useStore((s) => s.image)
export const useActiveTool = () => useStore((s) => s.activeToolId)
export const useToolState = (id: Parameters<AppStore['setToolStatus']>[0]) =>
  useStore((s) => s.toolStates[id])
export const useCanvasState = () =>
  useStore((s) => ({
    zoom: s.zoom,
    panX: s.panX,
    panY: s.panY,
    overlayOpacity: s.overlayOpacity,
    showOverlay: s.showOverlay,
  }))
