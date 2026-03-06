/**
 * Global keyboard shortcuts:
 *   R       — Run active tool (clicks the Run button by aria-label)
 *   Escape  — Cancel active tool
 *   O       — Toggle overlay visibility
 */
import { useEffect } from 'react'
import { useStore } from '../store'

export function useKeyboardShortcuts() {
  const store = useStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when focus is inside editable elements
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const key = e.key.toLowerCase()

      if (key === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        document.querySelector<HTMLButtonElement>('[aria-label="Run tool"]')?.click()
        return
      }

      if (key === 'escape') {
        e.preventDefault()
        document.querySelector<HTMLButtonElement>('[aria-label="Cancel tool"]')?.click()
        return
      }

      if (key === 'o' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        store.toggleOverlay()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [store])
}
