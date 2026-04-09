export type TrackingAccuracyMode = 'strict' | 'balanced'

const MODE_STORAGE_KEY = 'dasi.trackingAccuracyMode'

export function getTrackingAccuracyMode(): TrackingAccuracyMode {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY)
    if (stored === 'strict' || stored === 'balanced') {
      return stored
    }
  }

  const envMode = import.meta.env.VITE_TRACKING_ACCURACY_MODE
  if (envMode === 'strict' || envMode === 'balanced') {
    return envMode
  }

  return 'balanced'
}

export function setTrackingAccuracyMode(mode: TrackingAccuracyMode): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MODE_STORAGE_KEY, mode)
}

export function getRequiredAccuracyMeters(isMobileClient: boolean, mode: TrackingAccuracyMode): number {
  if (mode === 'balanced') {
    return isMobileClient ? 35 : 20
  }
  return isMobileClient ? 20 : 8
}

export function getPersonRecencyMinutes(mode: TrackingAccuracyMode): number {
  return mode === 'balanced' ? 8 : 3
}

export function getVehicleRecencyMinutes(mode: TrackingAccuracyMode): number {
  return mode === 'balanced' ? 20 : 10
}
