import { createContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { detectRuntimePlatform } from '../config'
import { API_BASE_URL } from '../config'
import {
  getLocationPermissionState,
  hasAcceptedLocationConsent,
  requestRuntimeLocationPermission,
  resolveLocationWithFallback,
  setLocationConsentStatus,
} from '../utils/location'
import { getRequiredAccuracyMeters, getTrackingAccuracyMode } from '../utils/trackingPolicy'
import { fetchJsonOrThrow, getAuthToken } from '../utils/api'
import { useAuth } from '../hooks/useAuth'

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export type LocationPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'

export interface LocationContextValue {
  hasLocationConsent: boolean
  locationConsentChecked: boolean
  geoPermissionState: LocationPermissionState
  geoNotice: string
  locationBannerDismissed: boolean
  grantLocationConsent: () => void
  denyLocationConsent: () => void
  dismissLocationBanner: () => void
  requestGeoPermission: () => Promise<void>
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

  const [hasLocationConsent, setHasLocationConsent] = useState(false)
  const [locationConsentChecked, setLocationConsentChecked] = useState(false)
  const [geoPermissionState, setGeoPermissionState] = useState<LocationPermissionState>('unknown')
  const [geoNotice, setGeoNotice] = useState('')
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

  // ---------------------------------------------------------------------------
  // Initialization — read consent status from localStorage on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const consentAccepted = hasAcceptedLocationConsent()
    setHasLocationConsent(consentAccepted)
    setLocationConsentChecked(consentAccepted)
  }, [])

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
          'Precise location is denied. Live tracking will use approximate IP-based fallback until permission is restored.',
        )
      }
    })
  }, [hasAcceptedToa, hasLocationConsent, isLoggedIn, user?.id])

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
            setGeoNotice(
              'Using approximate IP-based location fallback. Enable precise location for higher map accuracy.',
            )
          } else {
            setGeoPermissionState('granted')
            setGeoNotice('Location access active. Live tracking is operational.')
          }
        }
      } catch {
        if (!disposed) {
          setGeoNotice('Location update paused — check your connection and try again.')
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

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const grantLocationConsent = useCallback(() => {
    setLocationConsentStatus(true)
    setHasLocationConsent(true)
    setLocationConsentChecked(true)
    setGeoNotice('Location consent enabled. Live tracking can now run.')
  }, [])

  const denyLocationConsent = useCallback(() => {
    setLocationConsentStatus(false)
    setHasLocationConsent(false)
    setLocationConsentChecked(false)
    setGeoPermissionState('unknown')
    setGeoNotice('Location tracking remains disabled until consent is accepted.')
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
        'Location permission is unavailable on this runtime. IP fallback will be used when tracking is enabled.',
      )
      return
    }

    setGeoNotice(
      'Location permission is blocked. Live tracking will fall back to approximate IP-based positioning.',
    )
  }, [])

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value: LocationContextValue = {
    hasLocationConsent,
    locationConsentChecked,
    geoPermissionState,
    geoNotice,
    locationBannerDismissed,
    grantLocationConsent,
    denyLocationConsent,
    dismissLocationBanner,
    requestGeoPermission,
  }

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}
