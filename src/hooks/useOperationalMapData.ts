import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config'
import { detectRuntimePlatform } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { normalizeRole } from '../types/auth'
import {
  hasAcceptedLocationConsent,
  LOCATION_TRACKING_TOGGLE_KEY,
  resolveLocationWithFallback,
} from '../utils/location'

export interface MapClientSite {
  id: string
  name: string
  address?: string
  latitude: number
  longitude: number
  isActive: boolean
}

export interface MapTrackingPoint {
  id: string
  entityType: 'guard' | 'vehicle' | string
  entityId: string
  label?: string
  status?: string
  latitude: number
  longitude: number
  heading?: number
  speedKph?: number
  accuracyMeters?: number
  recordedAt: string
}

interface MapDataResponse {
  clientSites?: MapClientSite[]
  trackingPoints?: MapTrackingPoint[]
}

export interface ClientSiteInput {
  name: string
  address?: string
  latitude: number
  longitude: number
  isActive?: boolean
}

export interface GuardHeartbeatInput {
  latitude: number
  longitude: number
  heading?: number
  speedKph?: number
  accuracyMeters?: number
  status?: string
}

interface UseOperationalMapDataResult {
  clientSites: MapClientSite[]
  trackingPoints: MapTrackingPoint[]
  loading: boolean
  error: string
  refresh: () => Promise<void>
  lastUpdated: string
  createClientSite: (input: ClientSiteInput) => Promise<void>
  updateClientSite: (siteId: string, input: ClientSiteInput) => Promise<void>
  deleteClientSite: (siteId: string) => Promise<void>
  sendGuardHeartbeat: (input: GuardHeartbeatInput) => Promise<void>
  isElevatedUser: boolean
}

export function useOperationalMapData(): UseOperationalMapDataResult {
  const [clientSites, setClientSites] = useState<MapClientSite[]>([])
  const [trackingPoints, setTrackingPoints] = useState<MapTrackingPoint[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [isElevatedUser, setIsElevatedUser] = useState<boolean>(false)
  const enableTrackingWs = import.meta.env.VITE_ENABLE_TRACKING_WS === 'true'

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (!storedUser) {
      setIsElevatedUser(false)
      return
    }

    try {
      const user = JSON.parse(storedUser)
      const role = normalizeRole(user?.role)
      setIsElevatedUser(role === 'superadmin' || role === 'admin' || role === 'supervisor')
    } catch {
      setIsElevatedUser(false)
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await fetchJsonOrThrow<MapDataResponse>(
        `${API_BASE_URL}/api/tracking/map-data`,
        { headers: getAuthHeaders() },
        'Failed to load operational map data',
      )

      setClientSites(Array.isArray(data.clientSites) ? data.clientSites : [])
      setTrackingPoints(Array.isArray(data.trackingPoints) ? data.trackingPoints : [])
      setLastUpdated(new Date().toLocaleTimeString())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load operational map data')
    } finally {
      setLoading(false)
    }
  }, [])

  const createClientSite = useCallback(async (input: ClientSiteInput) => {
    await fetchJsonOrThrow<any>(
      `${API_BASE_URL}/api/tracking/client-sites`,
      {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(input),
      },
      'Failed to create client site',
    )
    await load()
  }, [load])

  const updateClientSite = useCallback(async (siteId: string, input: ClientSiteInput) => {
    await fetchJsonOrThrow<any>(
      `${API_BASE_URL}/api/tracking/client-sites/${siteId}`,
      {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(input),
      },
      'Failed to update client site',
    )
    await load()
  }, [load])

  const deleteClientSite = useCallback(async (siteId: string) => {
    await fetchJsonOrThrow<any>(
      `${API_BASE_URL}/api/tracking/client-sites/${siteId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      },
      'Failed to delete client site',
    )
    await load()
  }, [load])

  const sendGuardHeartbeat = useCallback(async (input: GuardHeartbeatInput) => {
    await fetchJsonOrThrow<any>(
      `${API_BASE_URL}/api/tracking/heartbeat`,
      {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          entityType: 'guard',
          entityId: '',
          label: 'Guard Session',
          status: input.status || 'active',
          latitude: input.latitude,
          longitude: input.longitude,
          heading: input.heading,
          speedKph: input.speedKph,
          accuracyMeters: input.accuracyMeters,
        }),
      },
      'Failed to send guard heartbeat',
    )
  }, [])

  useEffect(() => {
    load()

    const fallbackInterval = window.setInterval(load, 30000)

    const token = localStorage.getItem('token') || ''
    if (!token || !enableTrackingWs) {
      return () => {
        window.clearInterval(fallbackInterval)
      }
    }

    const wsBase = API_BASE_URL.replace(/^http/, 'ws')
    const wsUrl = `${wsBase}/api/tracking/ws?token=${encodeURIComponent(token)}`
    let socket: WebSocket | null = null

    try {
      socket = new WebSocket(wsUrl)
    } catch {
      setError('Live map socket unavailable. Using periodic refresh.')
      return () => {
        window.clearInterval(fallbackInterval)
      }
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type === 'snapshot' && payload?.data) {
          const data = payload.data as MapDataResponse
          setClientSites(Array.isArray(data.clientSites) ? data.clientSites : [])
          setTrackingPoints(Array.isArray(data.trackingPoints) ? data.trackingPoints : [])
          setLastUpdated(new Date().toLocaleTimeString())
          setLoading(false)
          setError('')
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    }

    socket.onerror = () => {
      setError('Live map socket disconnected. Falling back to periodic refresh.')
    }

    return () => {
      window.clearInterval(fallbackInterval)
      socket?.close()
    }
  }, [enableTrackingWs, load])

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (!storedUser) return

    const trackingEnabled = localStorage.getItem(LOCATION_TRACKING_TOGGLE_KEY) === 'true'
    if (!trackingEnabled || !hasAcceptedLocationConsent()) return

    try {
      const user = JSON.parse(storedUser)
      const role = normalizeRole(user?.role)
      if (role !== 'guard') return
    } catch {
      return
    }

    let lastSent = 0
    let disposed = false
    const platform = detectRuntimePlatform()

    const pushHeartbeat = async () => {
      const now = Date.now()
      if (now - lastSent < 15000) return
      lastSent = now

      try {
        const location = await resolveLocationWithFallback(platform)
        await sendGuardHeartbeat({
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading ?? undefined,
          speedKph: location.speedKph ?? undefined,
          accuracyMeters: location.accuracyMeters ?? undefined,
          status: 'active',
        })
      } catch {
        // Ignore heartbeat errors to keep polling alive.
      }
    }

    void pushHeartbeat()
    const intervalId = window.setInterval(() => {
      if (disposed) return
      void pushHeartbeat()
    }, 20000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [sendGuardHeartbeat])

  return useMemo(
    () => ({
      clientSites,
      trackingPoints,
      loading,
      error,
      refresh: load,
      lastUpdated,
      createClientSite,
      updateClientSite,
      deleteClientSite,
      sendGuardHeartbeat,
      isElevatedUser,
    }),
    [
      clientSites,
      trackingPoints,
      loading,
      error,
      load,
      lastUpdated,
      createClientSite,
      updateClientSite,
      deleteClientSite,
      sendGuardHeartbeat,
      isElevatedUser,
    ],
  )
}
