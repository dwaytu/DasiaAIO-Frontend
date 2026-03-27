import { useState, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import SuperadminDashboard from './components/SuperadminDashboard'
import UserDashboard from './components/UserDashboard'
import PerformanceDashboard from './components/PerformanceDashboard'
import FirearmInventory from './components/FirearmInventory'
import FirearmAllocation from './components/FirearmAllocation'
import GuardFirearmPermits from './components/GuardFirearmPermits'
import FirearmMaintenance from './components/FirearmMaintenance'
import ArmoredCarDashboard from './components/ArmoredCarDashboard'
import ProfileDashboard from './components/ProfileDashboard'
import MeritScoreDashboard from './components/MeritScoreDashboard'
import CalendarDashboard from './components/CalendarDashboard'
import { API_BASE_URL, APP_VERSION, LATEST_RELEASE_API_URL, RELEASE_DOWNLOAD_URL, detectRuntimePlatform } from './config'
import { normalizeRole, isLegacyRole, Role } from './types/auth'
import { can, Permission } from './utils/permissions'
import { getRequiredAccuracyMeters, getTrackingAccuracyMode } from './utils/trackingPolicy'
import { clearAuthSession, fetchJsonOrThrow, getAuthToken, getRefreshToken, hydrateAuthSession } from './utils/api'
import {
  getLocationConsentStatus,
  getLocationPermissionState,
  hasAcceptedLocationConsent,
  requestRuntimeLocationPermission,
  resolveLocationWithFallback,
  setLocationConsentStatus,
} from './utils/location'

export interface User {
  id: string
  email: string
  username: string
  role: Role
  [key: string]: any
}

const TOA_ACCEPTANCE_KEY = 'dasi.toa.accepted.v1'
const TOA_ACCEPTANCE_VALUE = 'accepted'
const UPDATE_DISMISS_KEY_PREFIX = 'dasi.update.dismissed.'

type ReleasePrompt = {
  tag: string
  url: string
}

function parseSemverVersion(value: string): [number, number, number] | null {
  const normalized = value.trim().replace(/^v/i, '')
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function isReleaseNewer(latestTag: string, currentVersion: string): boolean {
  const latest = parseSemverVersion(latestTag)
  const current = parseSemverVersion(currentVersion)
  if (!latest || !current) return false

  if (latest[0] !== current[0]) return latest[0] > current[0]
  if (latest[1] !== current[1]) return latest[1] > current[1]
  return latest[2] > current[2]
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [user, setUser] = useState<User | null>(null)
  const [activeView, setActiveView] = useState<string>('users')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [hasAcceptedToa, setHasAcceptedToa] = useState<boolean>(false)
  const [hasLocationConsent, setHasLocationConsent] = useState<boolean>(false)
  const [toaChecked, setToaChecked] = useState<boolean>(false)
  const [locationConsentChecked, setLocationConsentChecked] = useState<boolean>(false)
  const [toaError, setToaError] = useState<string>('')
  const [releasePrompt, setReleasePrompt] = useState<ReleasePrompt | null>(null)
  const [geoPermissionState, setGeoPermissionState] = useState<'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'>('unknown')
  const [geoNotice, setGeoNotice] = useState<string>('')
  const [globalError, setGlobalError] = useState<string>('')

  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const storedToa = localStorage.getItem(TOA_ACCEPTANCE_KEY)
        setHasAcceptedToa(storedToa === TOA_ACCEPTANCE_VALUE)

        const consentAccepted = hasAcceptedLocationConsent()
        setHasLocationConsent(consentAccepted)
        setLocationConsentChecked(consentAccepted)

        await hydrateAuthSession()
        const storedUser = localStorage.getItem('user')
        const storedToken = getAuthToken()

        if (storedUser && storedToken) {
          const parsedUser = JSON.parse(storedUser)
          parsedUser.role = normalizeRole(parsedUser.role)
          setUser(parsedUser)
          setIsLoggedIn(true)
        }
      } catch (error) {
        console.error('Failed to restore authentication:', error)
        clearAuthSession()
        localStorage.removeItem('user')
        setHasAcceptedToa(false)
        setHasLocationConsent(false)
      } finally {
        setIsLoading(false)
      }
    }

    void restoreAuth()
  }, [])

  useEffect(() => {
    const handleTokenExpiry = () => {
      clearAuthSession()
      localStorage.removeItem('user')
      setUser(null)
      setIsLoggedIn(false)
      setActiveView('users')
    }

    window.addEventListener('auth:token-expired', handleTokenExpiry)
    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpiry)
    }
  }, [])

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      const message = event.message?.trim()
      if (message) setGlobalError(message)
    }

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      if (reason instanceof Error && reason.message) {
        setGlobalError(reason.message)
      } else if (typeof reason === 'string' && reason.trim()) {
        setGlobalError(reason)
      } else {
        setGlobalError('An unexpected error occurred. Please refresh and try again.')
      }
    }

    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handlePromiseRejection)

    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handlePromiseRejection)
    }
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) return

    let isCancelled = false

    const checkForUpdates = async () => {
      try {
        const response = await fetch(LATEST_RELEASE_API_URL, {
          headers: { Accept: 'application/vnd.github+json' },
        })

        if (!response.ok) return

        const data = await response.json() as { tag_name?: string; html_url?: string }
        const latestTag = (data.tag_name || '').trim()
        if (!latestTag) return

        if (!isReleaseNewer(latestTag, APP_VERSION)) return

        const dismissedKey = `${UPDATE_DISMISS_KEY_PREFIX}${latestTag}`
        if (localStorage.getItem(dismissedKey) === 'true') return

        if (!isCancelled) {
          setReleasePrompt({
            tag: latestTag,
            url: data.html_url || RELEASE_DOWNLOAD_URL,
          })
        }
      } catch {
        // Ignore transient release-check failures.
      }
    }

    void checkForUpdates()
    const interval = window.setInterval(() => {
      void checkForUpdates()
    }, 1000 * 60 * 60 * 6)

    return () => {
      isCancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const handleLogin = (userData: User) => {
    if (!isLegacyRole(userData.role)) {
      console.error('Invalid role:', userData.role)
      return
    }

    const typedUser: User = {
      ...userData,
      role: normalizeRole(userData.role),
    }

    localStorage.setItem('user', JSON.stringify(typedUser))
    setUser(typedUser)
    setIsLoggedIn(true)
    setActiveView(typedUser.role === 'guard' ? 'overview' : 'dashboard')
  }

  const handleLogout = () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      void fetch(`${API_BASE_URL}/api/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
    }

    clearAuthSession()
    localStorage.removeItem('user')

    setUser(null)
    setIsLoggedIn(false)
    setActiveView('users')
  }

  const handleProfilePhotoUpdate = (photoUrl: string) => {
    if (!user) return

    setUser({
      ...user,
      profilePhoto: photoUrl,
    })
  }

  const normalizedRole = normalizeRole(user?.role)

  const handleAcceptToa = () => {
    if (!toaChecked) {
      setToaError('Please confirm that you have read and agree to the Terms of Agreement.')
      return
    }

    if (!locationConsentChecked) {
      setToaError('Please provide location consent so live tracking can operate in the field.')
      return
    }

    localStorage.setItem(TOA_ACCEPTANCE_KEY, TOA_ACCEPTANCE_VALUE)
    setLocationConsentStatus(true)
    setHasAcceptedToa(true)
    setHasLocationConsent(true)
    setToaError('')
  }

  const handleDeclineToa = () => {
    clearAuthSession()
    localStorage.removeItem('user')
    setUser(null)
    setIsLoggedIn(false)
    setActiveView('users')
    setToaError('You must agree to the Terms of Agreement to use SENTINEL.')
  }

  const handleAcceptLocationConsent = () => {
    setLocationConsentStatus(true)
    setHasLocationConsent(true)
    setLocationConsentChecked(true)
    setGeoNotice('Location consent enabled. Live tracking can now run.')
  }

  const handleDeclineLocationConsent = () => {
    setLocationConsentStatus(false)
    setHasLocationConsent(false)
    setLocationConsentChecked(false)
    setGeoPermissionState('unknown')
    setGeoNotice('Location tracking remains disabled until consent is accepted.')
  }

  const handleDismissUpdatePrompt = () => {
    if (!releasePrompt) return
    localStorage.setItem(`${UPDATE_DISMISS_KEY_PREFIX}${releasePrompt.tag}`, 'true')
    setReleasePrompt(null)
  }

  const handleDownloadUpdate = () => {
    if (!releasePrompt) return
    window.open(releasePrompt.url, '_blank', 'noopener,noreferrer')
    handleDismissUpdatePrompt()
  }

  const requestGlobalLocationPermission = async () => {
    const platform = detectRuntimePlatform()
    const permissionState = await requestRuntimeLocationPermission(platform)
    setGeoPermissionState(permissionState)

    if (permissionState === 'granted') {
      setGeoNotice('Location access granted.')
      return
    }

    if (permissionState === 'unsupported') {
      setGeoNotice('Location permission is unavailable on this runtime. IP fallback will be used when tracking is enabled.')
      return
    }

    setGeoNotice('Location permission is blocked. Live tracking will fall back to approximate IP-based positioning.')
  }

  useEffect(() => {
    if (!isLoggedIn || !user) return

    if (!hasLocationConsent) {
      setGeoPermissionState('unknown')
      setGeoNotice('Location tracking is disabled until consent is accepted.')
      return
    }

    void getLocationPermissionState().then((state) => {
      setGeoPermissionState(state)
      if (state === 'denied') {
        setGeoNotice('Precise location is denied. Live tracking will use approximate IP-based fallback until permission is restored.')
      }
    })
  }, [hasLocationConsent, isLoggedIn, user?.id])

  useEffect(() => {
    if (!isLoggedIn || !user || !hasLocationConsent) return

    let lastSent = 0
    let disposed = false
    const platform = detectRuntimePlatform()
    const isMobileClient = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const trackingMode = getTrackingAccuracyMode()
    const requiredAccuracyMeters = getRequiredAccuracyMeters(isMobileClient, trackingMode)

    const sendHeartbeat = async () => {
      const now = Date.now()
      if (now - lastSent < 12000) return
      lastSent = now

      const token = getAuthToken()
      if (!token) return

      try {
        const location = await resolveLocationWithFallback(platform)

        if (
          location.source !== 'ip' &&
          location.accuracyMeters != null &&
          location.accuracyMeters > requiredAccuracyMeters
        ) {
          return
        }

        await fetchJsonOrThrow(
          `${API_BASE_URL}/api/tracking/heartbeat`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              entityType: 'user',
              entityId: user.id,
              label: user.fullName || user.full_name || user.username,
              status: 'active',
              latitude: location.latitude,
              longitude: location.longitude,
              heading: location.heading,
              speedKph: location.speedKph,
              accuracyMeters: location.accuracyMeters,
            }),
          },
          'Unable to update location heartbeat',
        )

        if (!disposed) {
          if (location.source === 'ip') {
            setGeoPermissionState('denied')
            setGeoNotice('Using approximate IP-based location fallback. Enable precise location for higher map accuracy.')
          } else {
            setGeoPermissionState('granted')
            setGeoNotice('Location access active. Live tracking is operational.')
          }
        }
      } catch {
        if (!disposed) {
          setGeoNotice('Location heartbeat failed. Check connectivity and try again.')
        }
      }
    }

    void sendHeartbeat()
    const intervalId = window.setInterval(() => {
      void sendHeartbeat()
    }, 20000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [hasLocationConsent, isLoggedIn, user?.id, user?.username, user?.fullName, user?.full_name])

  type ViewComponent = (props: {
    user: User
    onLogout: () => void
    onViewChange: (view: string) => void
    activeView: string
  }) => JSX.Element

  const viewRegistry: Record<string, { component: ViewComponent; permission?: Permission }> = {
    calendar: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <CalendarDashboard user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
    },
    performance: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <PerformanceDashboard user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'view_analytics',
    },
    merit: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <MeritScoreDashboard user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'view_analytics',
    },
    firearms: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <FirearmInventory user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_firearms',
    },
    allocation: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <FirearmAllocation user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_allocations',
    },
    permits: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <GuardFirearmPermits user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_permits',
    },
    maintenance: {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <FirearmMaintenance user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_maintenance',
    },
    'armored-cars': {
      component: ({ user, onLogout, onViewChange, activeView }) => (
        <ArmoredCarDashboard user={user} onLogout={onLogout} onViewChange={onViewChange} activeView={activeView} />
      ),
      permission: 'manage_armored_cars',
    },
  }

  const getHomeView = (role: Role): string => {
    if (role === 'guard') return 'overview'
    return 'dashboard'
  }

  const canView = (view: string, role: Role): boolean => {
    const route = viewRegistry[view]
    if (!route || !route.permission) {
      return true
    }

    return can(role, route.permission)
  }

  const renderHome = (role: Role, currentUser: User): JSX.Element => {
    if (role === 'superadmin' || role === 'admin' || role === 'supervisor') {
      return (
        <SuperadminDashboard
          user={currentUser}
          onLogout={handleLogout}
          onViewChange={setActiveView}
          activeView={activeView}
        />
      )
    }

    return (
      <UserDashboard
        user={currentUser}
        onLogout={handleLogout}
        onViewChange={setActiveView}
        activeView={activeView}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="h-screen overflow-hidden w-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4" style={{ color: 'var(--text-primary)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  const showLocationConsentUpgrade = isLoggedIn && hasAcceptedToa && !hasLocationConsent && getLocationConsentStatus() === ''

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {!isLoggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : activeView === 'profile' ? (
        <ProfileDashboard user={user!} onLogout={handleLogout} onBack={() => setActiveView(getHomeView(normalizedRole))} onProfilePhotoUpdate={handleProfilePhotoUpdate} />
      ) : user ? (
        (() => {
          const desiredView = activeView
          const route = viewRegistry[desiredView]

          if (route && canView(desiredView, normalizedRole)) {
            return route.component({ user, onLogout: handleLogout, onViewChange: setActiveView, activeView })
          }

          return renderHome(normalizedRole, user)
        })()
      ) : null}

      {isLoggedIn && hasLocationConsent && geoPermissionState !== 'granted' ? (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg md:left-auto md:max-w-xl" role="status" aria-live="polite">
          <p className="font-semibold">Location access is not active.</p>
          <p className="mt-1">{geoNotice || 'Live tracking requires location permission. Tap the button below to request access or continue with IP fallback.'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { void requestGlobalLocationPermission() }}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Prompt Location Access
            </button>
          </div>
        </div>
      ) : null}

      {!hasAcceptedToa ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="toa-title"
            aria-describedby="toa-summary"
            className="w-full max-w-3xl rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-7"
          >
            <h1 id="toa-title" className="text-2xl font-bold text-text-primary">Terms of Agreement</h1>
            <p id="toa-summary" className="mt-2 text-sm text-text-secondary">
              Before using SENTINEL on Web, Desktop, or Mobile, you must agree to these terms. This prompt is shown once per app install/browser profile.
            </p>

            <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border-subtle bg-surface-elevated p-4 text-sm text-text-secondary">
              <p>You agree to use SENTINEL only for authorized security operations.</p>
              <p>You agree to protect credentials and not share access with unauthorized individuals.</p>
              <p>You acknowledge that operational actions, tracking events, and key system updates may be logged for audit, compliance, and safety purposes.</p>
              <p>You agree that location-based features require device and browser permission and should only be enabled for legitimate operational duties.</p>
              <p>You understand that violating policy or applicable law may result in account suspension and administrative review.</p>
            </div>

            <div className="mt-4 rounded-lg border border-border-subtle bg-surface-elevated p-3">
              <label htmlFor="toa-agree" className="flex cursor-pointer items-start gap-3 text-sm text-text-primary">
                <input
                  id="toa-agree"
                  type="checkbox"
                  checked={toaChecked}
                  onChange={(event) => {
                    setToaChecked(event.target.checked)
                    if (event.target.checked) {
                      setToaError('')
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-border-elevated"
                />
                <span>I have read and agree to the Terms of Agreement.</span>
              </label>
              <label htmlFor="location-consent" className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-text-primary">
                <input
                  id="location-consent"
                  type="checkbox"
                  checked={locationConsentChecked}
                  onChange={(event) => {
                    setLocationConsentChecked(event.target.checked)
                    if (event.target.checked) {
                      setToaError('')
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-border-elevated"
                />
                <span>I consent to location processing for live guard and mission tracking.</span>
              </label>
            </div>

            {toaError ? (
              <p className="mt-3 rounded-md border border-danger-border bg-danger-bg p-2 text-sm text-danger-text" role="alert">
                {toaError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleDeclineToa}
                className="rounded-md border border-border-elevated bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAcceptToa}
                className="rounded-md bg-info px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!toaChecked || !locationConsentChecked}
              >
                Agree and Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showLocationConsentUpgrade ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/62 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-consent-title"
            className="w-full max-w-lg rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-6"
          >
            <h2 id="location-consent-title" className="text-xl font-bold text-text-primary">Location Tracking Consent</h2>
            <p className="mt-2 text-sm text-text-secondary">
              SENTINEL can use device location for live guard tracking and operational safety. If you decline, location heartbeat updates remain disabled.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleDeclineLocationConsent}
                className="rounded-md border border-border-elevated bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAcceptLocationConsent}
                className="rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
              >
                Allow tracking
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {releasePrompt ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/62 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-title"
            className="w-full max-w-lg rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-6"
          >
            <h2 id="update-title" className="text-xl font-bold text-text-primary">New update available</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Version {releasePrompt.tag} is available. You are currently using {APP_VERSION}. Download the latest update to continue with new fixes and features.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleDismissUpdatePrompt}
                className="rounded-md border border-border-elevated bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleDownloadUpdate}
                className="rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
              >
                Download update
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {globalError ? (
        <div className="fixed bottom-4 right-4 z-[90] max-w-md rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger-text shadow-lg" role="alert">
          <p className="font-semibold">Unexpected error</p>
          <p className="mt-1">{globalError}</p>
          <button
            type="button"
            onClick={() => setGlobalError('')}
            className="mt-2 rounded-md border border-danger-border px-3 py-1.5 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default App
