import { FC, ReactNode, Ref, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import type { User } from '../../context/AuthContext'
import AccountManager from '../AccountManager'
import NotificationPanel from '../NotificationPanel'
import SettingsPanel from '../settings/SettingsPanel'
import { ThemeToggleButton } from '../../context/ThemeProvider'
import { useOverlayController } from './useOverlayController'

type HeaderGlobalActionsProps = {
  user: User
  onLogout: () => void
  onNavigateToProfile?: () => void
  onNavigateToInbox?: () => void
  onNavigateToSettings?: () => void
  currentView?: string
  extraAction?: ReactNode
  onRefresh?: () => void
  profileButtonRef?: Ref<HTMLButtonElement>
  guardMode?: boolean
}

const HeaderGlobalActions: FC<HeaderGlobalActionsProps> = ({
  user,
  onLogout,
  onNavigateToProfile,
  onNavigateToInbox,
  onNavigateToSettings,
  currentView,
  extraAction,
  onRefresh,
  profileButtonRef,
  guardMode,
}) => {
  const settingsPanelRef = useRef<HTMLElement | null>(null)
  const overlayRefs = useMemo(() => [settingsPanelRef], [])
  const { rootRef, toggleOverlay, closeOverlay, isOverlayOpen } = useOverlayController<'inbox' | 'settings' | 'profile'>(overlayRefs)
  const [refreshing, setRefreshing] = useState(false)
  const settingsOpen = isOverlayOpen('settings')

  useEffect(() => {
    if (!refreshing) return undefined
    const timeoutId = window.setTimeout(() => setRefreshing(false), 700)
    return () => window.clearTimeout(timeoutId)
  }, [refreshing])

  const handleRefresh = () => {
    setRefreshing(true)
    if (onRefresh) {
      onRefresh()
      return
    }
    window.location.reload()
  }

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-1.5 md:gap-2">
      {!settingsOpen && !guardMode ? <ThemeToggleButton className="flex" /> : null}
      {!settingsOpen && !guardMode ? extraAction : null}

      {!settingsOpen && !guardMode ? (
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)] sm:px-3"
          aria-label="Refresh dashboard"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      ) : null}

      {!settingsOpen ? (
        <NotificationPanel
          user={user}
          isOpen={isOverlayOpen('inbox')}
          onToggle={() => toggleOverlay('inbox')}
          onClose={closeOverlay}
          onViewAll={() => {
            onNavigateToInbox?.()
            closeOverlay()
          }}
        />
      ) : null}

      {onNavigateToSettings && !guardMode ? (
        <>
          {!settingsOpen ? (
            <button
              type="button"
              onClick={() => toggleOverlay('settings')}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface-elevated px-3 py-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)] ${isOverlayOpen('settings') ? 'bg-surface-hover text-text-primary' : ''}`}
              aria-label="Open settings"
              aria-expanded={isOverlayOpen('settings')}
            >
              <SettingsIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}

          <SettingsPanel
            user={user}
            open={isOverlayOpen('settings')}
            onClose={closeOverlay}
            onOpenFullSettings={onNavigateToSettings}
            showFullSettingsAction={currentView !== 'settings'}
            panelRef={settingsPanelRef}
          />
        </>
      ) : null}

      {!settingsOpen ? (
        <AccountManager
          user={user}
          onLogout={onLogout}
          onNavigateToProfile={onNavigateToProfile}
          isOpen={isOverlayOpen('profile')}
          onToggle={() => toggleOverlay('profile')}
          onClose={closeOverlay}
          buttonRef={profileButtonRef}
        />
      ) : null}
    </div>
  )
}

export default HeaderGlobalActions