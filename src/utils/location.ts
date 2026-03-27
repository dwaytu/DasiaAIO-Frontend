import { RuntimePlatform } from '../config'

export const LOCATION_CONSENT_KEY = 'dasi.locationConsent.v1'
export const LOCATION_CONSENT_ACCEPTED = 'accepted'
export const LOCATION_CONSENT_DECLINED = 'declined'
export const LOCATION_TRACKING_TOGGLE_KEY = 'dasi.guardLocationTrackingEnabled'

export type LocationPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'

export interface ResolvedLocation {
  latitude: number
  longitude: number
  accuracyMeters: number | null
  heading: number | null
  speedKph: number | null
  source: 'gps' | 'capacitor' | 'ip'
}

type BrowserPosition = {
  coords: {
    latitude: number
    longitude: number
    accuracy: number
    heading: number | null
    speed: number | null
  }
}

type CapacitorGeolocationPlugin = {
  requestPermissions?: () => Promise<{ location?: string; coarseLocation?: string }>
  getCurrentPosition: (options?: {
    enableHighAccuracy?: boolean
    timeout?: number
    maximumAge?: number
  }) => Promise<BrowserPosition>
}

type RuntimeWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean
    Plugins?: {
      Geolocation?: CapacitorGeolocationPlugin
    }
  }
}

function getCapacitorGeolocationPlugin(): CapacitorGeolocationPlugin | null {
  if (typeof window === 'undefined') return null
  const runtimeWindow = window as RuntimeWindow
  if (!runtimeWindow.Capacitor?.isNativePlatform?.()) return null
  return runtimeWindow.Capacitor?.Plugins?.Geolocation || null
}

function toResolvedLocation(position: BrowserPosition, source: ResolvedLocation['source']): ResolvedLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
    speedKph: Number.isFinite(position.coords.speed) ? (position.coords.speed as number) * 3.6 : null,
    source,
  }
}

function getBrowserPosition(timeoutMs = 20000): Promise<BrowserPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this platform.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(position as unknown as BrowserPosition)
      },
      () => {
        reject(new Error('Location permission denied or unavailable.'))
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      },
    )
  })
}

async function getCapacitorPosition(timeoutMs = 20000): Promise<ResolvedLocation> {
  const plugin = getCapacitorGeolocationPlugin()
  if (!plugin) {
    throw new Error('Capacitor geolocation plugin is unavailable.')
  }

  if (plugin.requestPermissions) {
    const permission = await plugin.requestPermissions()
    const state = (permission.location || permission.coarseLocation || '').toLowerCase()
    if (state === 'denied') {
      throw new Error('Location permission denied by the mobile OS.')
    }
  }

  const position = await plugin.getCurrentPosition({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: timeoutMs,
  })

  return toResolvedLocation(position, 'capacitor')
}

async function fetchIpLocation(timeoutMs = 8000): Promise<ResolvedLocation> {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), timeoutMs)

  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: abortController.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error('IP-based location service unavailable.')
    }

    const payload = await response.json() as {
      latitude?: number | string
      longitude?: number | string
      lat?: number | string
      lon?: number | string
    }

    const latitude = Number(payload.latitude ?? payload.lat)
    const longitude = Number(payload.longitude ?? payload.lon)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('IP-based location returned invalid coordinates.')
    }

    return {
      latitude,
      longitude,
      accuracyMeters: 20000,
      heading: null,
      speedKph: null,
      source: 'ip',
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function hasAcceptedLocationConsent(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LOCATION_CONSENT_KEY) === LOCATION_CONSENT_ACCEPTED
}

export function getLocationConsentStatus(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(LOCATION_CONSENT_KEY) || ''
}

export function setLocationConsentStatus(accepted: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    LOCATION_CONSENT_KEY,
    accepted ? LOCATION_CONSENT_ACCEPTED : LOCATION_CONSENT_DECLINED,
  )
}

export async function requestRuntimeLocationPermission(platform: RuntimePlatform): Promise<LocationPermissionState> {
  if (platform === 'capacitor') {
    const plugin = getCapacitorGeolocationPlugin()
    if (!plugin) return 'unsupported'

    if (!plugin.requestPermissions) {
      return 'unknown'
    }

    try {
      const permission = await plugin.requestPermissions()
      const state = (permission.location || permission.coarseLocation || '').toLowerCase()
      if (state === 'granted') return 'granted'
      if (state === 'denied') return 'denied'
      return 'prompt'
    } catch {
      return 'denied'
    }
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'unsupported'
  }

  try {
    await getBrowserPosition(15000)
    return 'granted'
  } catch {
    return 'denied'
  }
}

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'unsupported'
  }

  if (!('permissions' in navigator)) {
    return 'unknown'
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    if (permission.state === 'granted') return 'granted'
    if (permission.state === 'denied') return 'denied'
    return 'prompt'
  } catch {
    return 'unknown'
  }
}

export async function resolveLocationWithFallback(platform: RuntimePlatform): Promise<ResolvedLocation> {
  try {
    if (platform === 'capacitor') {
      return await getCapacitorPosition()
    }

    if (typeof window !== 'undefined' && window.isSecureContext) {
      const browserPosition = await getBrowserPosition()
      return toResolvedLocation(browserPosition, 'gps')
    }
  } catch {
    // Fallback to IP-based location below.
  }

  return fetchIpLocation()
}
