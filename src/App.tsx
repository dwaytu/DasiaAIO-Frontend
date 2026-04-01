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
import { API_BASE_URL, APP_VERSION, APP_WHATS_NEW, LATEST_RELEASE_API_URL, RELEASE_DOWNLOAD_URL, detectRuntimePlatform, RuntimePlatform } from './config'
import { normalizeRole, isLegacyRole, Role } from './types/auth'
import { can, Permission } from './utils/permissions'
import { getRequiredAccuracyMeters, getTrackingAccuracyMode } from './utils/trackingPolicy'
import {
  clearAuthSession,
  fetchJsonOrThrow,
  getAuthToken,
  getRefreshToken,
  hydrateAuthSession,
  isAuthTokenExpired,
  refreshAuthSessionIfNeeded,
  storeAuthSession,
} from './utils/api'
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
const WHATS_NEW_SEEN_KEY_PREFIX = 'dasi.whatsnew.seen.'

type ReleasePrompt = {
  tag: string
  url: string
  changelog?: string
  platform: RuntimePlatform
}

type SystemVersionResponse = {
  latestVersion?: string
  changelog?: string
  downloadLinks?: {
    web?: string
    desktop?: string
    mobile?: string
  }
}

type WhatsNewPrompt = {
  version: string
  notes: string
}

type LegalConsentResponse = {
  consentAcceptedAt?: string
  consentVersion?: string
  token?: string
  refreshToken?: string
  legalConsentAccepted?: boolean
}

type TokenExpiredEvent = CustomEvent<{ message?: string }>

function hasServerLegalConsent(currentUser: User | null): boolean {
  if (!currentUser) return false
  if (currentUser.legalConsentAccepted === true) return true
  return Boolean(currentUser.consentAcceptedAt)
}

function normalizeAuthExpiryMessage(message: string | undefined): string {
  const normalized = (message || '').trim()
  if (!normalized) return 'Session expired. Please log in again.'

  const lower = normalized.toLowerCase()
  if (
    lower.includes('invalid or expired token') ||
    lower.includes('invalidtoken') ||
    lower.includes('expired token') ||
    lower.includes('expiredsignature') ||
    lower.includes('jwt')
  ) {
    return 'Session expired. Please log in again.'
  }

  return normalized
}

function resolveDownloadUrl(platform: RuntimePlatform, payload: SystemVersionResponse): string {
  if (platform === 'tauri') {
    return payload.downloadLinks?.desktop || payload.downloadLinks?.web || RELEASE_DOWNLOAD_URL
  }

  if (platform === 'capacitor') {
    return payload.downloadLinks?.mobile || payload.downloadLinks?.web || RELEASE_DOWNLOAD_URL
  }

  return payload.downloadLinks?.web || RELEASE_DOWNLOAD_URL
}

function parseSemverVersion(value: string): [number, number, number] | null {
  const normalized = value.trim().replace(/^v/i, '')
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function normalizeVersionTag(value: string): string {
  return value.trim().replace(/^v/i, '')
}

function getWhatsNewSeenKey(version: string): string {
  return `${WHATS_NEW_SEEN_KEY_PREFIX}${normalizeVersionTag(version)}`
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
  const runtimePlatform = detectRuntimePlatform()
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
  const [whatsNewPrompt, setWhatsNewPrompt] = useState<WhatsNewPrompt | null>(null)
  const [geoPermissionState, setGeoPermissionState] = useState<'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'>('unknown')
  const [geoNotice, setGeoNotice] = useState<string>('')
  const [globalError, setGlobalError] = useState<string>('')
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [isBackendReachable, setIsBackendReachable] = useState<boolean>(true)

  useEffect(() => {
    const restoreAuth = async () => {
      try {
        setHasAcceptedToa(false)

        const consentAccepted = hasAcceptedLocationConsent()
        setHasLocationConsent(consentAccepted)
        setLocationConsentChecked(consentAccepted)

        await hydrateAuthSession()
        const storedUser = localStorage.getItem('user')
        const storedToken = getAuthToken()

        if (storedUser && storedToken) {
          const sessionReady = await refreshAuthSessionIfNeeded()
          const activeToken = getAuthToken()

          if (!sessionReady || !activeToken || isAuthTokenExpired(activeToken)) {
            clearAuthSession()
            localStorage.removeItem('user')
            setUser(null)
            setIsLoggedIn(false)
            setHasAcceptedToa(false)
            return
          }

          const parsedUser = JSON.parse(storedUser)
          parsedUser.role = normalizeRole(parsedUser.role)
          setUser(parsedUser)
          setIsLoggedIn(true)
          setHasAcceptedToa(hasServerLegalConsent(parsedUser))
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
    const handleTokenExpiry = (event: Event) => {
      const message = (event as TokenExpiredEvent).detail?.message?.trim()
      setGlobalError(normalizeAuthExpiryMessage(message))
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
    const handleOnline = () => setIsNetworkOnline(true)
    const handleOffline = () => {
      setIsNetworkOnline(false)
      setIsBackendReachable(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!isNetworkOnline) {
      setIsBackendReachable(false)
      return
    }

    let disposed = false

    const probeBackend = async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${API_BASE_URL}/api/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })

        if (!disposed) {
          setIsBackendReachable(response.ok)
        }
      } catch {
        if (!disposed) {
          setIsBackendReachable(false)
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void probeBackend()
    const interval = window.setInterval(() => {
      void probeBackend()
    }, 30000)

    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [isNetworkOnline])

  const checkForUpdates = async (ignoreDismissedTag = false) => {
    try {
      const systemResponse = await fetch(`${API_BASE_URL}/api/system/version`, {
        headers: { Accept: 'application/json' },
      })

      if (systemResponse.ok) {
        const payload = (await systemResponse.json()) as SystemVersionResponse
        const latestTag = (payload.latestVersion || '').trim()
        if (!latestTag || !isReleaseNewer(latestTag, APP_VERSION)) {
          return
        }

        const dismissedKey = `${UPDATE_DISMISS_KEY_PREFIX}${latestTag}`
        if (!ignoreDismissedTag && localStorage.getItem(dismissedKey) === 'true') {
          return
        }

        setReleasePrompt({
          tag: latestTag,
          url: resolveDownloadUrl(runtimePlatform, payload),
          changelog: payload.changelog,
          platform: runtimePlatform,
        })
        return
      }

      const response = await fetch(LATEST_RELEASE_API_URL, {
        headers: { Accept: 'application/vnd.github+json' },
      })

      if (!response.ok) return

      const data = (await response.json()) as { tag_name?: string; html_url?: string }
      const latestTag = (data.tag_name || '').trim()
      if (!latestTag || !isReleaseNewer(latestTag, APP_VERSION)) return

      const dismissedKey = `${UPDATE_DISMISS_KEY_PREFIX}${latestTag}`
      if (!ignoreDismissedTag && localStorage.getItem(dismissedKey) === 'true') {
        return
      }

      setReleasePrompt({
        tag: latestTag,
        url: data.html_url || RELEASE_DOWNLOAD_URL,
        platform: runtimePlatform,
      })
    } catch {
      // Ignore transient release-check failures.
    }
  }

  useEffect(() => {
    if (import.meta.env.DEV) return

    let isCancelled = false

    void checkForUpdates()
    const interval = window.setInterval(() => {
      if (!isCancelled) {
        void checkForUpdates()
      }
    }, 1000 * 60 * 60 * 6)

    return () => {
      isCancelled = true
      window.clearInterval(interval)
    }
  }, [runtimePlatform])

  useEffect(() => {
    if (import.meta.env.DEV) return

    const currentVersion = normalizeVersionTag(APP_VERSION)
    const hasSemverVersion = Boolean(parseSemverVersion(currentVersion))
    const notes = APP_WHATS_NEW.trim()

    if (!hasSemverVersion || !notes) {
      return
    }

    const seenKey = getWhatsNewSeenKey(currentVersion)
    if (localStorage.getItem(seenKey) === 'true') {
      return
    }

    setWhatsNewPrompt({
      version: currentVersion,
      notes,
    })
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
    setHasAcceptedToa(hasServerLegalConsent(typedUser))
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
    setHasAcceptedToa(false)
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

  const handleAcceptToa = async () => {
    if (!toaChecked) {
      setToaError('Please confirm that you have read and agree to the Terms of Agreement.')
      return
    }

    if (!locationConsentChecked) {
      setToaError('Please provide location consent so live tracking can operate in the field.')
      return
    }

    if (!user) {
      setToaError('No active user session was found. Please log in again.')
      return
    }

    const sessionReady = await refreshAuthSessionIfNeeded()
    const activeToken = getAuthToken()
    if (!sessionReady || !activeToken || isAuthTokenExpired(activeToken)) {
      clearAuthSession()
      localStorage.removeItem('user')
      setUser(null)
      setIsLoggedIn(false)
      setHasAcceptedToa(false)
      setActiveView('users')
      setToaError('Session expired. Please log in again.')
      return
    }

    try {
      const consent = await fetchJsonOrThrow<LegalConsentResponse>(
        `${API_BASE_URL}/api/legal/consent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            termsAccepted: true,
            privacyAccepted: true,
            acceptableUseAccepted: true,
            consentVersion: '2026-03-28',
          }),
        },
        'Failed to record legal consent',
      )

      if (consent.token) {
        storeAuthSession(consent.token, consent.refreshToken)
      }

      const updatedUser: User = {
        ...user,
        legalConsentAccepted: true,
        consentAcceptedAt: consent.consentAcceptedAt || new Date().toISOString(),
        consentVersion: consent.consentVersion || '2026-03-28',
      }

      localStorage.setItem('user', JSON.stringify(updatedUser))
      setUser(updatedUser)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to record legal consent. Please try again.'
      setToaError(message)
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

  const handleDismissWhatsNewPrompt = () => {
    if (!whatsNewPrompt) return
    localStorage.setItem(getWhatsNewSeenKey(whatsNewPrompt.version), 'true')
    setWhatsNewPrompt(null)
  }

  const handleDownloadUpdate = async () => {
    if (!releasePrompt) return

    if (releasePrompt.platform === 'tauri') {
      try {
        const updater = await import('@tauri-apps/plugin-updater')
        const process = await import('@tauri-apps/plugin-process')
        const update = await updater.check()

        if (update) {
          await update.downloadAndInstall((event) => {
            if (event.event === 'Finished') {
              setGlobalError('Update downloaded. Restarting now...')
            }
          })
          await process.relaunch()
          return
        }
      } catch {
        // Fall back to release URL if Tauri updater is unavailable.
      }
    }

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

    if (!hasAcceptedToa) {
      setGeoPermissionState('unknown')
      setGeoNotice('Complete legal confirmation to enable location tracking.')
      return
    }

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
  }, [hasAcceptedToa, hasLocationConsent, isLoggedIn, user?.id])

  useEffect(() => {
    if (!isLoggedIn || !user || !hasAcceptedToa || !hasLocationConsent) return

    const role = normalizeRole(user.role)
    const canSendTrackingHeartbeat = role === 'supervisor' || role === 'guard'
    if (!canSendTrackingHeartbeat) {
      setGeoNotice('Location heartbeat is enabled only for supervisor and guard roles.')
      return
    }

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
  }, [hasAcceptedToa, hasLocationConsent, isLoggedIn, user?.id, user?.username, user?.fullName, user?.full_name])

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
    if (view === 'audit-log') {
      return can(role, 'view_audit_logs')
    }

    const route = viewRegistry[view]
    if (!route || !route.permission) {
      return true
    }

    return can(role, route.permission)
  }

  const renderAccessDenied = (role: Role): JSX.Element => {
    const homeView = getHomeView(role)

    return (
      <main id="maincontent" className="flex h-full items-center justify-center p-4" tabIndex={-1}>
        <section className="w-full max-w-lg rounded-2xl border border-danger-border bg-surface p-6 shadow-xl">
          <h1 className="text-2xl font-bold text-text-primary">Access denied</h1>
          <p className="mt-3 text-sm text-text-secondary">
            You do not have permission to open this section. If this looks incorrect, contact a superadmin.
          </p>
          <button
            type="button"
            onClick={() => setActiveView(homeView)}
            className="mt-5 min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
          >
            Return to dashboard
          </button>
        </section>
      </main>
    )
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

  const showLocationConsentUpgrade = isLoggedIn && hasAcceptedToa && !hasLocationConsent && getLocationConsentStatus() === ''
  const showConnectivityBanner = isLoggedIn && (!isNetworkOnline || !isBackendReachable)
  const hasBlockingOverlay =
    isLoggedIn && (!hasAcceptedToa || showLocationConsentUpgrade || Boolean(whatsNewPrompt) || Boolean(releasePrompt))

  const mobileNavItems = normalizedRole === 'guard'
    ? [
        { key: 'overview', label: 'Overview' },
        { key: 'calendar', label: 'Calendar' },
        { key: 'profile', label: 'Profile' },
      ]
    : [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'calendar', label: 'Calendar' },
        { key: 'firearms', label: 'Firearms' },
        { key: 'armored-cars', label: 'Vehicles' },
        { key: 'profile', label: 'Profile' },
      ]

  const showMobileQuickNav =
    isLoggedIn &&
    hasAcceptedToa &&
    normalizedRole === 'guard' &&
    activeView !== 'profile' &&
    !hasBlockingOverlay
  const mobileSafeBottomOffset = showMobileQuickNav
    ? 'calc(5rem + env(safe-area-inset-bottom, 0px))'
    : 'calc(1rem + env(safe-area-inset-bottom, 0px))'
  const mobileQuickNavColumns = mobileNavItems.length <= 3
    ? 'grid-cols-3'
    : mobileNavItems.length === 4
      ? 'grid-cols-4'
      : 'grid-cols-5'

  return (
    <div className={`h-[100dvh] w-full overflow-hidden bg-background ${showMobileQuickNav ? 'pb-24 md:pb-0' : 'pb-4 md:pb-0'}`}>
      {!isLoggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : !hasAcceptedToa ? (
        <main id="maincontent" className="flex h-full items-center justify-center px-4" tabIndex={-1}>
          <section className="w-full max-w-lg rounded-2xl border border-border-elevated bg-surface p-6 shadow-xl">
            <h1 className="text-2xl font-bold text-text-primary">Legal Confirmation Required</h1>
            <p className="mt-3 text-sm text-text-secondary">
              Review and accept the Terms of Agreement, Privacy Policy, and Acceptable Use Policy to continue.
            </p>
          </section>
        </main>
      ) : activeView === 'profile' ? (
        <ProfileDashboard user={user!} onLogout={handleLogout} onBack={() => setActiveView(getHomeView(normalizedRole))} onProfilePhotoUpdate={handleProfilePhotoUpdate} />
      ) : user ? (
        (() => {
          const desiredView = activeView
          const route = viewRegistry[desiredView]

          if (route && canView(desiredView, normalizedRole)) {
            return route.component({ user, onLogout: handleLogout, onViewChange: setActiveView, activeView })
          }

          if (route && !canView(desiredView, normalizedRole)) {
            return renderAccessDenied(normalizedRole)
          }

          if (!route && !canView(desiredView, normalizedRole)) {
            return renderAccessDenied(normalizedRole)
          }

          return renderHome(normalizedRole, user)
        })()
      ) : null}

      {isLoggedIn && !import.meta.env.DEV && !hasBlockingOverlay ? (
        <button
          type="button"
          onClick={() => {
            void checkForUpdates(true)
          }}
          className="fixed right-4 z-[60] min-h-11 rounded-md border border-border-elevated bg-surface px-3 py-2 text-xs font-semibold text-text-primary shadow-md transition-colors hover:bg-surface-hover md:bottom-6"
          style={{ bottom: mobileSafeBottomOffset }}
          aria-label="Check for updates"
        >
          Check for Updates
        </button>
      ) : null}

      {showConnectivityBanner && !hasBlockingOverlay ? (
        <div
          className="fixed left-4 right-4 top-4 z-[80] rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger-text shadow-lg md:left-auto md:max-w-xl"
          style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
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

      {isLoggedIn && hasAcceptedToa && hasLocationConsent && geoPermissionState !== 'granted' && !hasBlockingOverlay ? (
        <div
          className="soc-warning-banner fixed left-4 right-4 z-[82] rounded-lg p-3 text-sm shadow-lg md:left-auto md:max-w-xl"
          style={{ bottom: mobileSafeBottomOffset }}
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">Location access is not active.</p>
          <p className="mt-1">{geoNotice || 'Live tracking requires location permission. Tap the button below to request access or continue with IP fallback.'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { void requestGlobalLocationPermission() }}
              className="soc-btn-primary min-h-11 rounded-md px-3 py-1.5 text-xs font-semibold"
            >
              Prompt Location Access
            </button>
          </div>
        </div>
      ) : null}

      {isLoggedIn && !hasAcceptedToa ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'var(--color-overlay)' }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="toa-title"
            aria-describedby="toa-summary"
            className="soc-modal-panel w-full max-w-3xl rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-7"
          >
            <h1 id="toa-title" className="text-2xl font-bold text-text-primary">Terms of Agreement</h1>
            <p id="toa-summary" className="mt-2 text-sm text-text-secondary">
              Before using SENTINEL on Web, Desktop, or Mobile, you must agree to these terms. This prompt is shown once per app install/browser profile.
            </p>

            <p className="mt-2 text-sm text-text-secondary">
              Review the legal documents:{' '}
              <a
                href="https://github.com/Cloudyrowdyyy/Capstone-Main/blob/main/TermsOfAgreement.md"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-info underline"
              >
                Terms of Agreement
              </a>
              ,{' '}
              <a
                href="https://github.com/Cloudyrowdyyy/Capstone-Main/blob/main/PrivacyPolicy.md"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-info underline"
              >
                Privacy Policy
              </a>
              , and{' '}
              <a
                href="https://github.com/Cloudyrowdyyy/Capstone-Main/blob/main/AcceptableUsePolicy.md"
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
                className="min-h-11 rounded-md border border-border-elevated bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAcceptToa}
                className="min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!toaChecked || !locationConsentChecked}
              >
                Agree and Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showLocationConsentUpgrade ? (
        <div className="fixed inset-0 z-[108] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'var(--color-overlay)' }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-consent-title"
            className="soc-modal-panel w-full max-w-lg rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-6"
          >
            <h2 id="location-consent-title" className="text-xl font-bold text-text-primary">Location Tracking Consent</h2>
            <p className="mt-2 text-sm text-text-secondary">
              SENTINEL can use device location for live guard tracking and operational safety. If you decline, location heartbeat updates remain disabled.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleDeclineLocationConsent}
                className="min-h-11 rounded-md border border-border-elevated bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAcceptLocationConsent}
                className="min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
              >
                Allow tracking
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {whatsNewPrompt && !releasePrompt ? (
        <div className="fixed inset-0 z-[106] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'var(--color-overlay)' }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="whats-new-title"
            className="soc-modal-panel w-full max-w-xl rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-6"
          >
            <h2 id="whats-new-title" className="text-xl font-bold text-text-primary">What's New in {whatsNewPrompt.version}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Highlights from your current release.
            </p>
            <p className="mt-3 whitespace-pre-line text-sm text-text-primary">{whatsNewPrompt.notes}</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleDismissWhatsNewPrompt}
                className="min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {releasePrompt ? (
        <div className="fixed inset-0 z-[104] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'var(--color-overlay)' }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-title"
            className="soc-modal-panel w-full max-w-lg rounded-2xl border border-border-elevated bg-surface p-5 shadow-modal sm:p-6"
          >
            <h2 id="update-title" className="text-xl font-bold text-text-primary">New update available</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Version {releasePrompt.tag} is available. You are currently using {APP_VERSION}. Download the latest update to continue with new fixes and features.
            </p>
            {releasePrompt.changelog ? (
              <p className="mt-2 text-xs text-text-secondary">{releasePrompt.changelog}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleDismissUpdatePrompt}
                className="min-h-11 rounded-md border border-border-elevated bg-surface-elevated px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => { void handleDownloadUpdate() }}
                className="min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
              >
                {releasePrompt.platform === 'tauri' ? 'Update now' : 'Download update'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showMobileQuickNav ? (
        <nav
          aria-label="Mobile quick navigation"
          className="fixed bottom-0 left-0 right-0 z-[64] border-t border-border-elevated bg-surface px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2 md:hidden"
        >
          <ul className={`grid ${mobileQuickNavColumns} gap-1`}>
            {mobileNavItems.map((item) => {
              const isAccessible = item.key === 'profile' || canView(item.key, normalizedRole)
              if (!isAccessible) {
                return <li key={item.key} />
              }

              const isActive = activeView === item.key

              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => setActiveView(item.key)}
                    className={`min-h-11 w-full rounded-md px-2 py-2 text-xs font-semibold transition-colors duration-150 ${
                      isActive ? 'bg-info text-white' : 'bg-surface-elevated text-text-secondary'
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}

      {globalError && !hasBlockingOverlay ? (
        <div
          className="fixed right-4 z-[84] max-w-md rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger-text shadow-lg"
          style={{ bottom: mobileSafeBottomOffset }}
          role="alert"
        >
          <p className="font-semibold">Unexpected error</p>
          <p className="mt-1">{globalError}</p>
          <button
            type="button"
            onClick={() => setGlobalError('')}
            className="mt-2 min-h-10 rounded-md border border-danger-border px-3 py-1.5 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default App
