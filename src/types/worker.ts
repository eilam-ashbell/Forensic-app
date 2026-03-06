import type { ToolId } from './tools'

export interface WorkerProgressMessage {
  type: 'progress'
  toolId: ToolId
  pct: number
}

export interface WorkerRequest<P = Record<string, unknown>> {
  taskId: string
  toolId: ToolId
  params: P
  imageData?: ImageData
  arrayBuffer?: ArrayBuffer
}

export interface WorkerResponse<R = unknown> {
  taskId: string
  toolId: ToolId
  result?: R
  error?: string
}
