import { FC, Ref, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { User } from '../../context/AuthContext'
import RoleSettingsContent from './RoleSettingsContent'

type SettingsPanelProps = {
  user: User
  open: boolean
  onClose: () => void
  onOpenFullSettings?: () => void
  showFullSettingsAction?: boolean
  panelRef?: Ref<HTMLElement>
}

const SettingsPanel: FC<SettingsPanelProps> = ({ user, open, onClose, onOpenFullSettings, showFullSettingsAction = true, panelRef }) => {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 flex" style={{ zIndex: 2147483000 }} role="presentation">
      <button
        type="button"
        className="flex-1 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="settings-panel-title" className="soc-settings-drawer relative z-[1] flex h-full w-full max-w-2xl flex-col border-l border-border-elevated bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Global Settings</p>
            <h2 id="settings-panel-title" className="text-xl font-bold text-text-primary">Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            {showFullSettingsAction && onOpenFullSettings ? (
              <button
                type="button"
                onClick={() => {
                  onOpenFullSettings()
                  onClose()
                }}
                className="hidden min-h-11 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover sm:inline-flex"
              >
                View Full Settings
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface-elevated text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
              aria-label="Close settings"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="soc-scroll-area flex-1 overflow-y-auto px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-6">
          <RoleSettingsContent user={user} compact />
        </div>
      </aside>
    </div>,
    document.body,
  )
}

export default SettingsPanel