import { TOOL_IDS } from '../../types/tools'
import type { ToolId, ToolResult, ToolStatus } from '../../types/tools'
import type { ToolState } from '../../types/session'
import { TOOL_DEFAULT_PARAMS } from '../../constants/defaults'

export type { ToolState }

export interface ToolSlice {
  activeToolId: ToolId | null
  toolStates: Record<ToolId, ToolState>
  setActiveTool: (id: ToolId) => void
  setToolStatus: (id: ToolId, status: ToolStatus, error?: string) => void
  setToolProgress: (id: ToolId, progress: number) => void
  setToolResult: (id: ToolId, result: ToolResult, executionMs: number) => void
  setToolParams: (id: ToolId, params: Record<string, unknown>) => void
  resetToolResult: (id: ToolId) => void
  resetAllTools: () => void
}

function makeDefaultState(id: ToolId): ToolState {
  return {
    status: 'idle',
    progress: 0,
    result: null,
    error: null,
    executionMs: null,
    params: (TOOL_DEFAULT_PARAMS[id] ?? {}) as Record<string, unknown>,
  }
}

function makeDefaultStates(): Record<ToolId, ToolState> {
  return Object.fromEntries(TOOL_IDS.map((id) => [id, makeDefaultState(id)])) as Record<
    ToolId,
    ToolState
  >
}

export const createToolSlice = (
  set: (fn: (state: ToolSlice) => Partial<ToolSlice>) => void,
): ToolSlice => ({
  activeToolId: null,
  toolStates: makeDefaultStates(),

  setActiveTool: (id) => set(() => ({ activeToolId: id })),

  setToolStatus: (id, status, error) =>
    set((s) => ({
      toolStates: {
        ...s.toolStates,
        [id]: {
          ...s.toolStates[id],
          status,
          error: error ?? null,
          progress: status === 'running' ? 0 : s.toolStates[id].progress,
        },
      },
    })),

  setToolProgress: (id, progress) =>
    set((s) => ({
      toolStates: {
        ...s.toolStates,
        [id]: { ...s.toolStates[id], progress },
      },
    })),

  setToolResult: (id, result, executionMs) =>
    set((s) => ({
      toolStates: {
        ...s.toolStates,
        [id]: { ...s.toolStates[id], status: 'done', progress: 100, result, executionMs, error: null },
      },
    })),

  setToolParams: (id, params) =>
    set((s) => ({
      toolStates: {
        ...s.toolStates,
        [id]: { ...s.toolStates[id], params },
      },
    })),

  resetToolResult: (id) =>
    set((s) => ({
      toolStates: {
        ...s.toolStates,
        [id]: makeDefaultState(id),
      },
    })),

  resetAllTools: () => set(() => ({ toolStates: makeDefaultStates(), activeToolId: null })),
})
