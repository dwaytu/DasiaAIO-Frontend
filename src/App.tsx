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
import { API_BASE_URL } from './config'
import { normalizeRole, isLegacyRole, Role } from './types/auth'
import { can, Permission } from './utils/permissions'
import { getRequiredAccuracyMeters, getTrackingAccuracyMode } from './utils/trackingPolicy'
import { clearAuthSession, getAuthToken, getRefreshToken, hydrateAuthSession } from './utils/api'

export interface User {
  id: string
  email: string
  username: string
  role: Role
  [key: string]: any
}

const TOA_ACCEPTANCE_KEY = 'dasi.toa.accepted.v1'
const TOA_ACCEPTANCE_VALUE = 'accepted'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [user, setUser] = useState<User | null>(null)
  const [activeView, setActiveView] = useState<string>('users')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [hasAcceptedToa, setHasAcceptedToa] = useState<boolean>(false)
  const [toaChecked, setToaChecked] = useState<boolean>(false)
  const [toaError, setToaError] = useState<string>('')
  const [geoPermissionState, setGeoPermissionState] = useState<'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'>('unknown')
  const [geoNotice, setGeoNotice] = useState<string>('')

  // Restore authentication from localStorage on component mount
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const storedToa = localStorage.getItem(TOA_ACCEPTANCE_KEY)
        setHasAcceptedToa(storedToa === TOA_ACCEPTANCE_VALUE)

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
        // Clear potentially corrupted data
        clearAuthSession()
        localStorage.removeItem('user')
        setHasAcceptedToa(false)
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

  const handleLogin = (userData: User) => {
    if (!isLegacyRole(userData.role)) {
      console.error('Invalid role:', userData.role)
      return
    }
    const typedUser: User = {
      ...userData,
      role: normalizeRole(userData.role)
    }

    // Store user data in localStorage for persistence
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

    // Clear authentication from localStorage
    clearAuthSession()
    localStorage.removeItem('user')
    
    setUser(null)
    setIsLoggedIn(false)
    setActiveView('users')
  }

  const handleProfilePhotoUpdate = (photoUrl: string) => {
    if (user) {
      setUser({
        ...user,
        profilePhoto: photoUrl
      })
    }
  }

  const normalizedRole = normalizeRole(user?.role)

  const handleAcceptToa = () => {
    if (!toaChecked) {
      setToaError('Please confirm that you have read and agree to the Terms of Agreement.')
      return
    }

    localStorage.setItem(TOA_ACCEPTANCE_KEY, TOA_ACCEPTANCE_VALUE)
    setHasAcceptedToa(true)
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

  const requestGlobalLocationPermission = () => {
    if (!navigator.geolocation) {
      setGeoPermissionState('unsupported')
      setGeoNotice('Geolocation is not supported by this browser/device.')
      return
    }

    if (!window.isSecureContext) {
      setGeoNotice('Location permission requires HTTPS on this device/network.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setGeoPermissionState('granted')
        setGeoNotice('Location access granted.')
      },
      () => {
        setGeoPermissionState('denied')
        setGeoNotice('Location permission is blocked. Enable it in browser site settings, then refresh.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      },
    )
  }

  useEffect(() => {
    if (!isLoggedIn || !user) return

    if (!navigator.geolocation) {
      setGeoPermissionState('unsupported')
      setGeoNotice('Geolocation is not supported by this browser/device.')
      return
    }

    if (!window.isSecureContext) {
      setGeoNotice('Location prompt is unavailable because this page is not secure (HTTPS required on mobile/LAN).')
      return
    }

    if (typeof navigator.permissions === 'undefined') {
      return
    }

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        setGeoPermissionState(result.state as 'prompt' | 'granted' | 'denied')
        if (result.state === 'denied') {
          setGeoNotice('Location permission is currently denied. Enable it in browser site settings to restore live tracking.')
        }
        result.onchange = () => {
          setGeoPermissionState(result.state as 'prompt' | 'granted' | 'denied')
        }
      })
      .catch(() => {
        setGeoPermissionState('unknown')
      })
  }, [isLoggedIn, user?.id])

  useEffect(() => {
    if (!isLoggedIn || !user) return
    if (!navigator.geolocation) return

    let lastSent = 0
    const isMobileClient = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const trackingMode = getTrackingAccuracyMode()
    const REQUIRED_ACCURACY_METERS = getRequiredAccuracyMeters(isMobileClient, trackingMode)

    const sendHeartbeat = async (position: GeolocationPosition) => {
      const now = Date.now()
      if (now - lastSent < 12000) return
      lastSent = now

      const accuracyMeters = position.coords.accuracy
      if (accuracyMeters > REQUIRED_ACCURACY_METERS) {
        return
      }
      const status = 'active'
      const token = getAuthToken()
      if (!token) {
        return
      }

      try {
        await fetch(`${API_BASE_URL}/api/tracking/heartbeat`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entityType: 'user',
            entityId: user.id,
            label: user.fullName || user.full_name || user.username,
            status,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            heading: position.coords.heading,
            speedKph: position.coords.speed != null ? position.coords.speed * 3.6 : null,
            accuracyMeters,
          }),
        })
      } catch {
        // Ignore transient heartbeat errors.
      }
    }

    // Trigger a one-time permission prompt and immediate heartbeat after login.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void sendHeartbeat(position)
      },
      () => {
        // Permission denied or unavailable.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      },
    )

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        await sendHeartbeat(position)
      },
      () => {
        // Permission denied or unavailable.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [isLoggedIn, user?.id, user?.username, user?.fullName, user?.full_name])

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
    if (role === 'guard') {
      return 'overview'
    }
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

      {isLoggedIn && geoPermissionState !== 'granted' ? (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg md:left-auto md:max-w-xl" role="status" aria-live="polite">
          <p className="font-semibold">Location access is not active.</p>
          <p className="mt-1">{geoNotice || 'Live tracking requires location permission. Tap the button below to request access.'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestGlobalLocationPermission}
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
                disabled={!toaChecked}
              >
                Agree and Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
