import { createContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react'
import { detectRuntimePlatform } from '../config'
import { API_BASE_URL } from '../config'
import {
  getLocationPermissionState,
  hasAcceptedLocationConsent,
  requestRuntimeLocationPermission,
  type ResolvedLocation,
  resolveDeviceLocation,
  startResolvedLocationWatch,
  setLocationConsentStatus,
} from '../utils/location'
import { getRequiredAccuracyMeters, getTrackingAccuracyMode } from '../utils/trackingPolicy'
import { getAuthToken, parseResponseBody } from '../utils/api'
import {
  fetchTrackingConsentStatus,
  getTrackingConsentErrorMessage,
  grantTrackingConsent,
  isTrackingConsentRequiredResponse,
  revokeTrackingConsent,
} from '../utils/trackingConsent'
import { useAuth } from '../hooks/useAuth'

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export type LocationPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'
export type LocationHeartbeatStatus = 'active' | 'no-consent' | 'no-permission' | 'no-toa' | 'paused'

export interface LocationContextValue {
  hasLocationConsent: boolean
  locationConsentChecked: boolean
  consentActionPending: boolean
  consentSyncError: string
  geoPermissionState: LocationPermissionState
  locationHeartbeatStatus: LocationHeartbeatStatus
  geoNotice: string
  lastResolvedLocation: ResolvedLocation | null
  lastHeartbeatAt: string | null
  lastHeartbeatApproximate: boolean
  locationBannerDismissed: boolean
  grantLocationConsent: () => Promise<boolean>
  denyLocationConsent: () => Promise<boolean>
  refreshTrackingConsent: () => Promise<void>
  dismissLocationBanner: () => void
  requestGeoPermission: () => Promise<void>
  retryLocationHeartbeat: () => Promise<void>
}

export const LocationContext = createContext<LocationContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface LocationProviderProps {
  children: ReactNode
}

export function LocationProvider({ children }: LocationProviderProps) {
  const { user, isLoggedIn, hasAcceptedToa } = useAuth()

  const [hasLocationConsent, setHasLocationConsent] = useState(() => hasAcceptedLocationConsent())
  const [locationConsentChecked, setLocationConsentChecked] = useState(false)
  const [consentActionPending, setConsentActionPending] = useState(false)
  const [consentSyncError, setConsentSyncError] = useState('')
  const [geoPermissionState, setGeoPermissionState] = useState<LocationPermissionState>('unknown')
  const [heartbeatPaused, setHeartbeatPaused] = useState(false)
  const [geoNotice, setGeoNotice] = useState('')
  const [lastResolvedLocation, setLastResolvedLocation] = useState<ResolvedLocation | null>(null)
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null)
  const [lastHeartbeatApproximate, setLastHeartbeatApproximate] = useState(false)
  const [locationBannerDismissed, setLocationBannerDismissed] = useState(() => {
    try {
      const dismissed = localStorage.getItem('sentinel_location_banner_dismissed')
      if (dismissed) {
        const timestamp = parseInt(dismissed, 10)
        return Date.now() - timestamp < 24 * 60 * 60 * 1000
      }
    } catch {
      // localStorage unavailable
    }
    return false
  })
  const sendHeartbeatRef = useRef<(() => Promise<void>) | null>(null)

  // ---------------------------------------------------------------------------
  // Initialization — sync consent status from API, fallback to local cache
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isLoggedIn || !user) {
      setHasLocationConsent(false)
      setLocationConsentChecked(false)
      setConsentSyncError('')
      return
    }

    let cancelled = false

    const syncConsent = async () => {
      try {
        const status = await fetchTrackingConsentStatus()
        if (cancelled) return

        const serverConsent = status.locationTrackingConsent
        setHasLocationConsent(serverConsent)
        setLocationConsentChecked(true)
        setLocationConsentStatus(serverConsent)
        setConsentSyncError('')
      } catch {
        if (cancelled) return

        const localConsent = hasAcceptedLocationConsent()
        setHasLocationConsent(localConsent)
        setLocationConsentChecked(true)
        setConsentSyncError('Could not verify tracking consent with server.')
      }
    }

    void syncConsent()

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, user?.id])

  // ---------------------------------------------------------------------------
  // Geo permission check — runs when auth/consent state changes
  // ---------------------------------------------------------------------------

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
      setGeoPermissionState(state as LocationPermissionState)
      if (state === 'denied') {
        setGeoNotice(
          'Precise location is denied. Live tracking requires device GPS permission to be granted.',
        )
      }
    })
  }, [hasAcceptedToa, hasLocationConsent, isLoggedIn, user?.id])

  useEffect(() => {
    if (!isLoggedIn || !user || !hasAcceptedToa || !hasLocationConsent) return

    const role = user.role
    const canSendTrackingHeartbeat = role === 'supervisor' || role === 'guard'
    if (!canSendTrackingHeartbeat) return

    const platform = detectRuntimePlatform()
    let disposed = false
    let stopWatch: (() => void | Promise<void>) | null = null

    const startWatch = async () => {
      try {
        const stop = await startResolvedLocationWatch(
          platform,
          (location) => {
            if (disposed) return
            setLastResolvedLocation(location)
            if (location.source !== 'ip') {
              setGeoPermissionState('granted')
            }
          },
          () => {
            // Heartbeat fallback path remains responsible for user-facing notices.
          },
        )

        if (disposed) {
          await stop()
          return
        }

        stopWatch = stop
      } catch {
        // Watch mode is optional; heartbeat resolver continues with one-shot location samples.
      }
    }

    void startWatch()

    return () => {
      disposed = true
      if (stopWatch) {
        void stopWatch()
      }
    }
  }, [hasAcceptedToa, hasLocationConsent, isLoggedIn, user?.id, user?.role])

  // ---------------------------------------------------------------------------
  // Location heartbeat — periodic position updates while consented and logged in
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isLoggedIn || !user || !hasAcceptedToa || !hasLocationConsent) return

    const role = user.role
    const canSendTrackingHeartbeat = role === 'supervisor' || role === 'guard'
    if (!canSendTrackingHeartbeat) {
      setGeoNotice('Location heartbeat is enabled only for supervisor and guard roles.')
      return
    }

    setHeartbeatPaused(false)

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
        const location = await resolveDeviceLocation(platform)
        if (disposed) return

        setLastResolvedLocation(location)

        if (
          location.accuracyMeters != null &&
          location.accuracyMeters > requiredAccuracyMeters
        ) {
          setHeartbeatPaused(true)
          setGeoNotice('Location fix is too broad for precise tracking. Move to an open area and retry location.')
          return
        }

        const heartbeatFetch = await fetch(
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
        )

        const heartbeatPayload = await parseResponseBody(heartbeatFetch)
        if (!heartbeatFetch.ok) {
          if (isTrackingConsentRequiredResponse(heartbeatFetch.status, heartbeatPayload)) {
            setHeartbeatPaused(true)
            setHasLocationConsent(false)
            setLocationConsentStatus(false)
            setLocationConsentChecked(false)
            setGeoPermissionState('unknown')
            setGeoNotice(
              getTrackingConsentErrorMessage(
                heartbeatPayload,
                'Server requires location tracking consent before heartbeat can resume.',
              ),
            )
            return
          }

          throw new Error(getTrackingConsentErrorMessage(heartbeatPayload, 'Unable to update location heartbeat'))
        }

        const heartbeatResponse = heartbeatPayload as {
          accepted?: boolean
          approximate?: boolean
          message?: string
        }

        if (!disposed) {
          if (heartbeatResponse.accepted === false) {
            setHeartbeatPaused(true)
            setGeoNotice(
              heartbeatResponse.message ||
              'Location sample was rejected due to low precision. Move to an open area and retry location.',
            )
            return
          }

          setHeartbeatPaused(false)
          setLastHeartbeatAt(new Date().toISOString())
          setLastHeartbeatApproximate(false)
          setGeoPermissionState('granted')
          setGeoNotice('Location access active. Live tracking is operational.')
        }
      } catch {
        if (!disposed) {
          setHeartbeatPaused(true)
          setGeoNotice('Device geolocation unavailable — live tracking paused. Enable precise location to resume.')
        }
      }
    }

    sendHeartbeatRef.current = sendHeartbeat
    void sendHeartbeat()
    const intervalId = window.setInterval(() => {
      void sendHeartbeat()
    }, 20000)

    return () => {
      disposed = true
      sendHeartbeatRef.current = null
      window.clearInterval(intervalId)
    }
  }, [hasAcceptedToa, hasLocationConsent, isLoggedIn, user?.id, user?.username, user?.fullName, user?.full_name])

  const locationHeartbeatStatus = useMemo<LocationHeartbeatStatus>(() => {
    if (!isLoggedIn || !user) return 'paused'
    if (!hasAcceptedToa) return 'no-toa'
    if (!hasLocationConsent) return 'no-consent'

    const role = user.role
    const canSendTrackingHeartbeat = role === 'supervisor' || role === 'guard'
    if (!canSendTrackingHeartbeat) return 'paused'

    if (heartbeatPaused) return 'paused'
    if ((geoPermissionState === 'denied' || geoPermissionState === 'prompt') && !lastHeartbeatAt) {
      return 'no-permission'
    }

    return 'active'
  }, [geoPermissionState, hasAcceptedToa, hasLocationConsent, heartbeatPaused, isLoggedIn, lastHeartbeatAt, user])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const grantLocationConsent = useCallback(async (): Promise<boolean> => {
    setConsentActionPending(true)
    setConsentSyncError('')

    try {
      const result = await grantTrackingConsent()
      setLocationConsentStatus(true)
      setHasLocationConsent(result.locationTrackingConsent)
      setLocationConsentChecked(true)
      setGeoNotice('Location consent enabled. Live tracking can now run.')
      return true
    } catch {
      setConsentSyncError('Could not save tracking consent. Please try again.')
      return false
    } finally {
      setConsentActionPending(false)
    }
  }, [])

  const denyLocationConsent = useCallback(async (): Promise<boolean> => {
    setConsentActionPending(true)
    setConsentSyncError('')

    try {
      const result = await revokeTrackingConsent()
      setLocationConsentStatus(false)
      setHasLocationConsent(result.locationTrackingConsent)
      setLocationConsentChecked(false)
      setGeoPermissionState('unknown')
      setGeoNotice('Location tracking remains disabled until consent is accepted.')
      return true
    } catch {
      setConsentSyncError('Could not save consent change. Please try again.')
      return false
    } finally {
      setConsentActionPending(false)
    }
  }, [])

  const refreshTrackingConsent = useCallback(async () => {
    try {
      const status = await fetchTrackingConsentStatus()
      const serverConsent = status.locationTrackingConsent
      setHasLocationConsent(serverConsent)
      setLocationConsentChecked(true)
      setLocationConsentStatus(serverConsent)
      setConsentSyncError('')
    } catch {
      setConsentSyncError('Could not refresh tracking consent status.')
    }
  }, [])

  const dismissLocationBanner = useCallback(() => {
    try {
      localStorage.setItem('sentinel_location_banner_dismissed', String(Date.now()))
    } catch {
      // localStorage unavailable
    }
    setLocationBannerDismissed(true)
  }, [])

  const requestGeoPermission = useCallback(async () => {
    const platform = detectRuntimePlatform()
    const permissionState = await requestRuntimeLocationPermission(platform)
    setGeoPermissionState(permissionState)

    if (permissionState === 'granted') {
      setGeoNotice('Location access granted.')
      return
    }

    if (permissionState === 'unsupported') {
      setGeoNotice(
        'Location permission is unavailable on this runtime. Live tracking cannot start until device location support is available.',
      )
      return
    }

    setGeoNotice(
      'Location permission is blocked. Live tracking stays paused until precise location permission is granted.',
    )
  }, [])

  const retryLocationHeartbeat = useCallback(async () => {
    const sendHeartbeat = sendHeartbeatRef.current

    if (!sendHeartbeat) {
      setGeoNotice('Location heartbeat cannot retry until login, consent, and terms confirmation are active.')
      return
    }

    await sendHeartbeat()
  }, [])

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value: LocationContextValue = {
    hasLocationConsent,
    locationConsentChecked,
    consentActionPending,
    consentSyncError,
    geoPermissionState,
    locationHeartbeatStatus,
    geoNotice,
    lastResolvedLocation,
    lastHeartbeatAt,
    lastHeartbeatApproximate,
    locationBannerDismissed,
    grantLocationConsent,
    denyLocationConsent,
    refreshTrackingConsent,
    dismissLocationBanner,
    requestGeoPermission,
    retryLocationHeartbeat,
  }

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}
