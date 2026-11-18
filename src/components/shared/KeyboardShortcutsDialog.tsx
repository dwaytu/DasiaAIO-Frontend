import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export type KeyboardShortcut = { keys: string[]; label: string; view?: string }

interface KeyboardShortcutsDialogProps {
  shortcuts: KeyboardShortcut[]
  onClose: () => void
}

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function KeyboardShortcutsDialog({ shortcuts, onClose }: KeyboardShortcutsDialogProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const closeButton = panelRef.current?.querySelector<HTMLElement>('button')
    closeButton?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-(--color-overlay) p-4 backdrop-blur-sm" role="presentation">
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="keyboard-shortcuts-title" className="soc-modal-surface w-full max-w-lg rounded-lg border border-border-elevated bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div>
            <h2 id="keyboard-shortcuts-title" className="text-lg font-bold text-text-primary">Tactical Keyboard Shortcuts</h2>
            <p className="mt-1 text-sm text-text-secondary">Shortcuts available to your current role.</p>
          </div>
          <button type="button" onClick={onClose} className="soc-btn soc-btn-neutral soc-btn-icon min-h-11 min-w-11" aria-label="Close tactical keyboard shortcuts"><X className="h-4 w-4" aria-hidden="true" /></button>
        </header>
        <div className="max-h-[60dvh] overflow-y-auto p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Navigation</h3>
          <ul className="mt-2 space-y-2">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.label} className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-elevated px-3 py-2 text-sm text-text-primary">
                <span>{shortcut.label}</span>
                <span className="flex items-center gap-1">{shortcut.keys.map((key) => <kbd key={key} className="rounded border border-border-subtle bg-surface-elevated px-2 py-1 font-mono text-xs font-semibold text-text-primary shadow-xs">{key}</kbd>)}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-text-tertiary">Actions</h3>
          <ul className="mt-2 space-y-2 text-sm text-text-primary">
            <li><kbd className="rounded border border-border-subtle bg-surface-elevated px-2 py-1 font-mono text-xs font-semibold text-text-primary shadow-xs">Cmd/Ctrl + K</kbd> <span className="ml-2">Command Palette</span></li>
            <li><kbd className="rounded border border-border-subtle bg-surface-elevated px-2 py-1 font-mono text-xs font-semibold text-text-primary shadow-xs">/</kbd> <span className="ml-2">Command Palette</span></li>
            <li><kbd className="rounded border border-border-subtle bg-surface-elevated px-2 py-1 font-mono text-xs font-semibold text-text-primary shadow-xs">?</kbd> <span className="ml-2">Keyboard Help</span></li>
            <li><kbd className="rounded border border-border-subtle bg-surface-elevated px-2 py-1 font-mono text-xs font-semibold text-text-primary shadow-xs">Esc</kbd> <span className="ml-2">Close Overlay</span></li>
          </ul>
        </div>
      </section>
    </div>
  )
}
