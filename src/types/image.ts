export interface Dimensions {
  width: number
  height: number
}

export interface ImageRecord {
  /** Original File object — kept for binary/raw tools */
  file: File
  /** Decoded pixel data (RGBA) */
  imageData: ImageData
  /** Original file ArrayBuffer — kept for binary parsing */
  arrayBuffer: ArrayBuffer
  dimensions: Dimensions
  /** Estimated megapixel count */
  megapixels: number
  /** Whether the file is a JPEG (enables JPEG-specific tools) */
  isJpeg: boolean
  /** Whether the file is a PNG */
  isPng: boolean
  /** SHA-256 hash (hex) — computed on load */
  sha256: string
  /** MD5 hash (hex) — computed on load */
  md5: string
}
