export interface SessionSlice {
  sessionName: string
  loadedAt: string | null
  setSessionName: (name: string) => void
  setLoadedAt: (at: string) => void
  resetSession: () => void
}

export const createSessionSlice = (
  set: (fn: (state: SessionSlice) => Partial<SessionSlice>) => void,
): SessionSlice => ({
  sessionName: 'Untitled Session',
  loadedAt: null,
  setSessionName: (sessionName) => set(() => ({ sessionName })),
  setLoadedAt: (loadedAt) => set(() => ({ loadedAt })),
  resetSession: () => set(() => ({ sessionName: 'Untitled Session', loadedAt: null })),
})
