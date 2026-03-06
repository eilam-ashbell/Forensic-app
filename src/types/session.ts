import type { ToolId, ToolResult, ToolStatus } from './tools'

export interface ToolState {
  status: ToolStatus
  progress: number // 0-100
  result: ToolResult | null
  error: string | null
  executionMs: number | null
  params: Record<string, unknown>
}

export interface SessionState {
  name: string
  loadedAt: string | null
}

export type ToolStateMap = Record<ToolId, ToolState>
