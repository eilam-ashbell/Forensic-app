import type { ImageRecord } from '../../types/image'

export interface ImageSlice {
  image: ImageRecord | null
  setImage: (image: ImageRecord) => void
  clearImage: () => void
}

export const createImageSlice = (
  set: (fn: (state: ImageSlice) => Partial<ImageSlice>) => void,
): ImageSlice => ({
  image: null,
  setImage: (image) => set(() => ({ image })),
  clearImage: () => set(() => ({ image: null })),
})
