import { useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { LayoutDashboard, ClipboardCheck, Calendar, Bell, MoreHorizontal, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUI } from '../../hooks/useUI'
import { useLocationConsent } from '../../hooks/useLocationConsent'
import { normalizeRole } from '../../types/auth'
import { APP_VERSION } from '../../config'
import { getSidebarNav } from '../../config/navigation'
import { getLocationConsentStatus } from '../../utils/location'
import { VIEW_TO_ROUTE } from '../../router/routes'
import ToastContainer from '../shared/ToastContainer'

export default function AppShell() {
  const {
    user,
    isLoggedIn,
    isLoading,
    hasAcceptedToa,
    toaChecked,
    toaError,
    acceptToa,
    declineToa,
    setToaChecked,
    setToaError,
  } = useAuth()

  const {
    releasePrompt,
    whatsNewPrompt,
    isNetworkOnline,
    isBackendReachable,
    dismissReleasePrompt,
    dismissWhatsNewPrompt,
    downloadUpdate,
    checkForUpdates,
  } = useUI()

  const {
    hasLocationConsent,
    locationConsentChecked: locationConsentPersisted,
    geoPermissionState,
    geoNotice,
    locationBannerDismissed,
    grantLocationConsent,
    denyLocationConsent,
    dismissLocationBanner,
    requestGeoPermission,
  } = useLocationConsent()

  const navigate = useNavigate()
  const location = useLocation()
  const activeView = location.pathname.replace(/^\//, '') || 'dashboard'

  // Local checkbox state for the ToA location consent check (UI-only, not persisted yet)
  const [localLocationConsent, setLocalLocationConsent] = useState(locationConsentPersisted)
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)

  const normalizedRole = normalizeRole(user?.role)

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-screen overflow-hidden w-full flex items-center justify-center bg-background">
        <div className="w-full max-w-xl px-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 rounded-lg bg-surface-elevated" />
            <div className="h-24 rounded-lg bg-surface-elevated" />
            <div className="h-24 rounded-lg bg-surface-elevated" />
            <div className="h-24 rounded-lg bg-surface-elevated" />
          </div>
          <p className="mt-4 text-sm text-center text-text-secondary">Loading security operations workspace...</p>
        </div>
      </div>
    )
  }

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const showLocationConsentUpgrade =
    isLoggedIn && hasAcceptedToa && !hasLocationConsent && getLocationConsentStatus() === ''
  const showConnectivityBanner = isLoggedIn && (!isNetworkOnline || !isBackendReachable)
  const hasBlockingOverlay =
    isLoggedIn &&
    (!hasAcceptedToa ||
      showLocationConsentUpgrade ||
      Boolean(whatsNewPrompt) ||
      Boolean(releasePrompt))

  const isGuardWorkspaceView =
    normalizedRole === 'guard' && !['inbox', 'settings', 'profile'].includes(activeView)

  const isElevatedRole = normalizedRole !== null && normalizedRole !== 'guard'
  const operationalShellViews = new Set([
    'dashboard',
    'approvals',
    'schedule',
    'inbox',
    'support',
    'notifications',
    'missions',
    'trips',
    'performance',
    'merit',
    'firearms',
    'allocation',
    'permits',
    'maintenance',
    'armored-cars',
    'analytics',
    'audit',
    'calendar',
    'profile',
    'settings',
  ])
  const showAppShellMobileNav = isElevatedRole && !operationalShellViews.has(activeView)

  const mobileBottomTabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'approvals', label: 'Approvals', icon: ClipboardCheck },
    { key: 'schedule', label: 'Schedule', icon: Calendar },
    { key: 'inbox', label: 'Alerts', icon: Bell },
  ]

  const bottomTabKeys = new Set(['dashboard', 'approvals', 'schedule', 'inbox'])
  const moreNavItems = isElevatedRole
    ? getSidebarNav(normalizedRole).filter(item => !bottomTabKeys.has(item.view))
    : []

  const mobileSafeBottomOffset = 'calc(5rem + env(safe-area-inset-bottom, 0px))'
  const guardStickySafeBottomOffset = isGuardWorkspaceView
    ? 'calc(var(--guard-sticky-region-height) + 1rem + env(safe-area-inset-bottom, 0px))'
    : mobileSafeBottomOffset

  const handleToaAccept = async () => {
    if (!toaChecked) {
      setToaError('Please confirm that you have read and agree to the Terms of Agreement.')
      return
    }
    if (!localLocationConsent) {
      setToaError('Please provide location consent so live tracking can operate in the field.')
      return
    }
    await acceptToa()
    grantLocationConsent()
  }

  return (
    <div
      className={`h-[100dvh] w-full overflow-hidden bg-background ${showAppShellMobileNav ? 'pb-24 md:pb-0' : 'pb-4 md:pb-0'}`}
    >
      <Outlet />

      {/* ── Check for updates button ─────────────────────────────────────── */}
      {isLoggedIn && !import.meta.env.DEV && !hasBlockingOverlay && normalizedRole !== 'guard' ? (
        <button
          type="button"
          onClick={() => {
            void checkForUpdates(true)
          }}
          className="fixed bottom-4 right-4 z-[var(--z-floating)] hidden min-h-9 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-medium text-text-secondary shadow-sm backdrop-blur transition-all hover:bg-surface hover:text-text-primary hover:shadow-md md:block"
          aria-label="Check for updates"
        >
          Check for Updates
        </button>
      ) : null}

      {/* ── Connectivity banner ──────────────────────────────────────────── */}
      {showConnectivityBanner && !hasBlockingOverlay ? (
        <div
          className={`pointer-events-none fixed left-[calc(1rem+env(safe-area-inset-left,0px))] right-[calc(1rem+env(safe-area-inset-right,0px))] top-[calc(1rem+env(safe-area-inset-top,0px))] z-[var(--z-toast)] rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger-text shadow-lg ${
            isGuardWorkspaceView
              ? 'lg:left-[calc(1rem+env(safe-area-inset-left,0px))] lg:right-auto lg:top-[calc(5rem+env(safe-area-inset-top,0px))] lg:bottom-auto lg:w-[min(24rem,calc(100vw-2rem))]'
              : 'lg:left-[calc(18rem+1rem)] lg:right-auto lg:top-auto lg:bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] lg:w-[min(24rem,calc(100vw-20rem))]'
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Disconnected</p>
          <p className="mt-1">
            {!isNetworkOnline
              ? 'Network connection is offline. Reconnect to continue syncing SENTINEL data.'
              : 'Backend is unreachable right now. Retrying automatically in the background.'}
          </p>
        </div>
      ) : null}

      {/* ── Location permission banner ───────────────────────────────────── */}
      {isLoggedIn &&
      hasAcceptedToa &&
      hasLocationConsent &&
      geoPermissionState !== 'granted' &&
      !hasBlockingOverlay &&
      !locationBannerDismissed ? (
        <div
          className={`soc-warning-banner fixed left-4 right-4 z-[var(--z-banner)] rounded-lg p-3 text-sm shadow-lg ${
            isGuardWorkspaceView
              ? 'md:left-4 md:right-auto md:w-[min(24rem,calc(100vw-2rem))]'
              : 'md:left-auto md:right-4 md:w-[min(28rem,calc(100vw-2rem))]'
          }`}
          style={{ bottom: guardStickySafeBottomOffset }}
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Location access is not active.</p>
          <p className="mt-1">
            {geoNotice ||
              'Live tracking requires location permission. Tap the button below to request access or continue with IP fallback.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void requestGeoPermission()
              }}
              className="soc-btn-primary min-h-11 rounded-md px-3 py-1.5 text-xs font-semibold"
            >
              Prompt Location Access
            </button>
            <button
              type="button"
              onClick={dismissLocationBanner}
              className="min-h-11 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary"
              aria-label="Dismiss location banner for 24 hours"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {/* ── ToA modal (full-screen blocking) ────────────────────────────── */}
      {isLoggedIn && !hasAcceptedToa ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: 'var(--color-overlay)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="toa-title"
            aria-describedby="toa-summary"
            className="soc-modal-panel w-full max-w-3xl rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-7"
          >
            <h1 id="toa-title" className="text-2xl font-bold text-text-primary">
              Terms of Agreement
            </h1>
            <p id="toa-summary" className="mt-2 text-sm text-text-secondary">
              Before using SENTINEL on Web, Desktop, or Mobile, you must agree to these terms. This
              prompt is shown once per app install/browser profile.
            </p>

            <p className="mt-2 text-sm text-text-secondary">
              Review the legal documents:{' '}
              <a
                href="https://github.com/dwaytu/Capstone-Main/blob/main/TermsOfAgreement.md"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-info underline"
              >
                Terms of Agreement
              </a>
              ,{' '}
              <a
                href="https://github.com/dwaytu/Capstone-Main/blob/main/PrivacyPolicy.md"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-info underline"
              >
                Privacy Policy
              </a>
              , and{' '}
              <a
                href="https://github.com/dwaytu/Capstone-Main/blob/main/AcceptableUsePolicy.md"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-info underline"
              >
                Acceptable Use Policy
              </a>
              .
            </p>

            <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border-subtle bg-surface-elevated p-4 text-sm text-text-secondary">
              <p>You agree to use SENTINEL only for authorized security operations.</p>
              <p>
                You agree to protect credentials and not share access with unauthorized individuals.
              </p>
              <p>
                You acknowledge that operational actions, tracking events, and key system updates may
                be logged for audit, compliance, and safety purposes.
              </p>
              <p>
                You agree that location-based features require device and browser permission and
                should only be enabled for legitimate operational duties.
              </p>
              <p>
                You understand that violating policy or applicable law may result in account
                suspension and administrative review.
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-border-subtle bg-surface-elevated p-3">
              <label
                htmlFor="toa-agree"
                className="flex cursor-pointer items-start gap-3 text-sm text-text-primary"
              >
                <input
                  id="toa-agree"
                  type="checkbox"
                  checked={toaChecked}
                  onChange={(event) => {
                    setToaChecked(event.target.checked)
                    if (event.target.checked) setToaError('')
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-border-elevated"
                />
                <span>I have read and agree to the Terms of Agreement.</span>
              </label>
              <label
                htmlFor="location-consent"
                className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-text-primary"
              >
                <input
                  id="location-consent"
                  type="checkbox"
                  checked={localLocationConsent}
                  onChange={(event) => {
                    setLocalLocationConsent(event.target.checked)
                    if (event.target.checked) setToaError('')
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-border-elevated"
                />
                <span>I consent to location processing for live guard and mission tracking.</span>
              </label>
            </div>

            {toaError ? (
              <p
                className="mt-3 rounded-md border border-danger-border bg-danger-bg p-2 text-sm text-danger-text"
                role="alert"
              >
                {toaError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={declineToa}
                className="min-h-11 rounded-md border border-border-elevated bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleToaAccept()
                }}
                className="min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!toaChecked || !localLocationConsent}
              >
                Agree and Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* ── Location consent upgrade modal (legacy users) ────────────────── */}
      {showLocationConsentUpgrade ? (
        <div
          className="fixed inset-0 z-[var(--z-modal-profile)] flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: 'var(--color-overlay)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-consent-title"
            className="soc-modal-panel w-full max-w-lg rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-6"
          >
            <h2 id="location-consent-title" className="text-xl font-bold text-text-primary">
              Location Tracking Consent
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              SENTINEL can use device location for live guard tracking and operational safety. If you
              decline, location heartbeat updates remain disabled.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={denyLocationConsent}
                className="min-h-11 rounded-md border border-border-elevated bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={grantLocationConsent}
                className="min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
              >
                Allow tracking
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* ── What's new modal ─────────────────────────────────────────────── */}
      {whatsNewPrompt && !releasePrompt ? (
        <div
          className="fixed inset-0 z-[var(--z-modal-settings)] flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: 'var(--color-overlay)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="whats-new-title"
            className="soc-modal-panel w-full max-w-xl rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-6"
          >
            <h2 id="whats-new-title" className="text-xl font-bold text-text-primary">
              What's New in {whatsNewPrompt.version}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">Highlights from your current release.</p>
            <p className="mt-3 whitespace-pre-line text-sm text-text-primary">
              {whatsNewPrompt.notes}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={dismissWhatsNewPrompt}
                className="min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* ── Release update modal ─────────────────────────────────────────── */}
      {releasePrompt ? (
        <div
          className="fixed inset-0 z-[var(--z-modal-inbox)] flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: 'var(--color-overlay)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-title"
            className="soc-modal-panel w-full max-w-lg rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-6"
          >
            <h2 id="update-title" className="text-xl font-bold text-text-primary">
              New update available
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Version {releasePrompt.tag} is available. You are currently using {APP_VERSION}.
              Download the latest update to continue with new fixes and features.
            </p>
            {releasePrompt.changelog ? (
              <p className="mt-2 text-xs text-text-secondary">{releasePrompt.changelog}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={dismissReleasePrompt}
                className="min-h-11 rounded-md border border-border-elevated bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  void downloadUpdate()
                }}
                className="min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
              >
                {releasePrompt.platform === 'tauri' ? 'Update now' : 'Download update'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* ── Mobile bottom nav (elevated roles only) ──────────────────────── */}
      {showAppShellMobileNav ? (
        <>
          {/* More overlay */}
          {moreDrawerOpen ? (
            <div className="fixed inset-0 z-[63] md:hidden" onClick={() => setMoreDrawerOpen(false)}>
              <div className="absolute inset-0 bg-black/40" />
              <div
                className="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-2 right-2 rounded-xl border border-border bg-surface p-2 shadow-lg"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-3 py-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">More</span>
                  <button type="button" onClick={() => setMoreDrawerOpen(false)} className="p-1 text-text-secondary hover:text-text-primary">
                    <X className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Close menu</span>
                  </button>
                </div>
                <ul className="grid grid-cols-3 gap-1">
                  {moreNavItems.map(item => {
                    const itemRoute = VIEW_TO_ROUTE[item.view] || `/${item.view}`
                    return (
                      <li key={item.view}>
                        <button
                          type="button"
                          onClick={() => { navigate(itemRoute); setMoreDrawerOpen(false) }}
                          className="min-h-11 w-full rounded-lg px-2 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
                        >
                          {item.label}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ) : null}

          {/* Bottom tab bar */}
          <nav
            aria-label="Mobile navigation"
            className="fixed bottom-0 left-0 right-0 z-[var(--z-mobile-nav)] border-t border-border-elevated bg-surface/95 backdrop-blur-md px-2 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] pt-1 md:hidden"
          >
            <ul className="grid grid-cols-5 gap-0.5">
              {mobileBottomTabs.map(tab => {
                const tabRoute = VIEW_TO_ROUTE[tab.key] || `/${tab.key}`
                const isActive = location.pathname === tabRoute
                const Icon = tab.icon
                return (
                  <li key={tab.key}>
                    <button
                      type="button"
                      onClick={() => navigate(tabRoute)}
                      className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md py-1 text-[10px] font-semibold transition-colors ${
                        isActive ? 'text-[var(--color-info)]' : 'text-text-secondary'
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      {tab.label}
                    </button>
                  </li>
                )
              })}
              {/* More tab */}
              <li>
                <button
                  type="button"
                  onClick={() => setMoreDrawerOpen(prev => !prev)}
                  className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md py-1 text-[10px] font-semibold transition-colors ${
                    moreDrawerOpen ? 'text-[var(--color-info)]' : 'text-text-secondary'
                  }`}
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                  More
                </button>
              </li>
            </ul>
          </nav>
        </>
      ) : null}

      {/* ── Toast notifications ──────────────────────────────────────────── */}
      <ToastContainer />
    </div>
  )
}
