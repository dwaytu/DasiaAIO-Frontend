import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders, getAuthToken } from '../utils/api'
import {
  canManageTrackingSites,
  hasTrackingEndpointAccess,
  normalizeRole,
} from '../types/auth'

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
  userId?: string
  label?: string
  status?: string
  movementStatus?: 'moving' | 'idle' | 'offline' | string
  latitude: number
  longitude: number
  heading?: number
  speedKph?: number
  accuracyMeters?: number
  recordedAt: string
}

export interface GeofenceAlert {
  id: string
  guardId: string
  guardName?: string
  eventType: 'enter' | 'exit' | string
  siteId: string
  siteName: string
  distanceKm?: number
  message?: string
  createdAt: string
}

export interface GuardHistoryPoint {
  id?: string
  latitude: number
  longitude: number
  recordedAt: string
  movementStatus?: string
  speedKph?: number
  status?: string
  label?: string
}

export interface ActiveGuard {
  id: string
  guardId: string
  userId?: string
  guardName?: string
  movementStatus: string
  latitude: number
  longitude: number
  recordedAt: string
  ageSeconds?: number
  speedKph?: number
  status?: string
}

interface MapDataResponse {
  clientSites?: MapClientSite[]
  trackingPoints?: MapTrackingPoint[]
  geofenceAlerts?: GeofenceAlert[]
}

interface GuardHistoryResponse {
  points?: GuardHistoryPoint[]
}

interface GuardPathResponse {
  coordinates?: GuardHistoryPoint[]
}

interface ActiveGuardsResponse {
  guards?: ActiveGuard[]
}

type WsConnectionState = 'disabled' | 'connecting' | 'open' | 'backoff' | 'closed'

const WS_AUTH_CLOSE_CODES = new Set([1008, 4001, 4401, 4403])

function emitAuthExpired(message: string): void {
  try {
    window.dispatchEvent(new CustomEvent('auth:token-expired', { detail: { message } }))
  } catch {
    // Ignore runtimes where window events are unavailable.
  }
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
  geofenceAlerts: GeofenceAlert[]
  wsConnectionState: WsConnectionState
  loading: boolean
  error: string
  hasTrackingAccess: boolean
  refresh: () => Promise<void>
  lastUpdated: string
  createClientSite: (input: ClientSiteInput) => Promise<void>
  updateClientSite: (siteId: string, input: ClientSiteInput) => Promise<void>
  deleteClientSite: (siteId: string) => Promise<void>
  sendGuardHeartbeat: (input: GuardHeartbeatInput) => Promise<void>
  fetchGuardHistory: (guardId: string, limit?: number) => Promise<GuardHistoryPoint[]>
  fetchGuardPath: (guardId: string, limit?: number) => Promise<GuardHistoryPoint[]>
  fetchActiveGuards: (windowMinutes?: number) => Promise<ActiveGuard[]>
  isElevatedUser: boolean
}

export function useOperationalMapData(): UseOperationalMapDataResult {
  const WS_RECONNECT_BASE_MS = 1500
  const WS_RECONNECT_MAX_MS = 30000
  const WS_RECONNECT_MAX_ATTEMPTS = 8

  const [clientSites, setClientSites] = useState<MapClientSite[]>([])
  const [trackingPoints, setTrackingPoints] = useState<MapTrackingPoint[]>([])
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([])
  const [wsConnectionState, setWsConnectionState] = useState<WsConnectionState>('disabled')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [isElevatedUser, setIsElevatedUser] = useState<boolean>(false)
  const [hasTrackingAccess, setHasTrackingAccess] = useState<boolean>(false)
  const wsRef = useRef<WebSocket | null>(null)
  const wsReconnectTimerRef = useRef<number | null>(null)
  const wsReconnectAttemptsRef = useRef<number>(0)
  const enableTrackingWs = import.meta.env.VITE_ENABLE_TRACKING_WS === 'true'
  const currentToken = getAuthToken().trim()

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (!storedUser) {
      setIsElevatedUser(false)
      setHasTrackingAccess(false)
      return
    }

    try {
      const user = JSON.parse(storedUser)
      const role = normalizeRole(user?.role)
      setIsElevatedUser(canManageTrackingSites(role))
      setHasTrackingAccess(hasTrackingEndpointAccess(role))
    } catch {
      setIsElevatedUser(false)
      setHasTrackingAccess(false)
    }
  }, [])

  const applySnapshot = useCallback((data: MapDataResponse) => {
    setClientSites(Array.isArray(data.clientSites) ? data.clientSites : [])
    setTrackingPoints(Array.isArray(data.trackingPoints) ? data.trackingPoints : [])
    setGeofenceAlerts(Array.isArray(data.geofenceAlerts) ? data.geofenceAlerts : [])
    setLastUpdated(new Date().toLocaleTimeString())
  }, [])

  const load = useCallback(async () => {
    if (!hasTrackingAccess) {
      setClientSites([])
      setTrackingPoints([])
      setGeofenceAlerts([])
      setError('')
      setLoading(false)
      return
    }

    const token = getAuthToken().trim()
    if (!token) {
      setLoading(false)
      setError('Session expired. Please log in again.')
      return
    }

    try {
      const data = await fetchJsonOrThrow<MapDataResponse>(
        `${API_BASE_URL}/api/tracking/map-data`,
        { headers: getAuthHeaders() },
        'Failed to load operational map data',
      )

      applySnapshot(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load operational map data')
    } finally {
      setLoading(false)
    }
  }, [applySnapshot, hasTrackingAccess])

  const createClientSite = useCallback(async (input: ClientSiteInput) => {
    if (!hasTrackingAccess) return

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
  }, [hasTrackingAccess, load])

  const updateClientSite = useCallback(async (siteId: string, input: ClientSiteInput) => {
    if (!hasTrackingAccess) return

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
  }, [hasTrackingAccess, load])

  const deleteClientSite = useCallback(async (siteId: string) => {
    if (!hasTrackingAccess) return

    await fetchJsonOrThrow<any>(
      `${API_BASE_URL}/api/tracking/client-sites/${siteId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      },
      'Failed to delete client site',
    )
    await load()
  }, [hasTrackingAccess, load])

  const sendGuardHeartbeat = useCallback(async (input: GuardHeartbeatInput) => {
    if (!hasTrackingAccess) return

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
  }, [hasTrackingAccess])

  const fetchGuardHistory = useCallback(async (guardId: string, limit = 600) => {
    if (!hasTrackingAccess) return []

    const data = await fetchJsonOrThrow<GuardHistoryResponse>(
      `${API_BASE_URL}/api/tracking/guard-history/${encodeURIComponent(guardId)}?limit=${Math.max(20, Math.min(limit, 1500))}`,
      { headers: getAuthHeaders() },
      'Failed to load guard movement history',
    )

    return Array.isArray(data.points) ? data.points : []
  }, [hasTrackingAccess])

  const fetchGuardPath = useCallback(async (guardId: string, limit = 1000) => {
    if (!hasTrackingAccess) return []

    const data = await fetchJsonOrThrow<GuardPathResponse>(
      `${API_BASE_URL}/api/tracking/guard-path/${encodeURIComponent(guardId)}?limit=${Math.max(30, Math.min(limit, 2000))}`,
      { headers: getAuthHeaders() },
      'Failed to load guard path telemetry',
    )

    return Array.isArray(data.coordinates) ? data.coordinates : []
  }, [hasTrackingAccess])

  const fetchActiveGuards = useCallback(async (windowMinutes = 15) => {
    if (!hasTrackingAccess) return []

    const data = await fetchJsonOrThrow<ActiveGuardsResponse>(
      `${API_BASE_URL}/api/tracking/active-guards?windowMinutes=${Math.max(3, Math.min(windowMinutes, 120))}`,
      { headers: getAuthHeaders() },
      'Failed to load active guards intelligence',
    )

    return Array.isArray(data.guards) ? data.guards : []
  }, [hasTrackingAccess])

  useEffect(() => {
    void load()

    const fallbackInterval = window.setInterval(() => {
      void load()
    }, 30000)

    const clearReconnectTimer = () => {
      if (wsReconnectTimerRef.current !== null) {
        window.clearTimeout(wsReconnectTimerRef.current)
        wsReconnectTimerRef.current = null
      }
    }

    const closeSocket = () => {
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }

    let disposed = false

    const token = currentToken
    if (!token || !enableTrackingWs || !hasTrackingAccess) {
      setWsConnectionState('disabled')
      return () => {
        disposed = true
        window.clearInterval(fallbackInterval)
        clearReconnectTimer()
        closeSocket()
      }
    }

    const wsBase = API_BASE_URL.replace(/^http/, 'ws')
    const wsUrl = `${wsBase}/api/tracking/ws?token=${encodeURIComponent(token)}`
    const wsProtocols = ['sentinel-tracking-v1', `bearer.${token}`]

    const scheduleReconnect = (reason: string) => {
      if (disposed) return

      if (wsReconnectAttemptsRef.current >= WS_RECONNECT_MAX_ATTEMPTS) {
        setWsConnectionState('closed')
        setError('Live map socket unavailable. Using periodic refresh.')
        return
      }

      wsReconnectAttemptsRef.current += 1
      const delay = Math.min(
        WS_RECONNECT_BASE_MS * Math.pow(2, wsReconnectAttemptsRef.current - 1),
        WS_RECONNECT_MAX_MS,
      )

      setWsConnectionState('backoff')
      setError(`${reason} Retrying live map in ${Math.round(delay / 1000)}s.`)

      clearReconnectTimer()
      wsReconnectTimerRef.current = window.setTimeout(() => {
        wsReconnectTimerRef.current = null
        connectWebSocket()
      }, delay)
    }

    const connectWebSocket = () => {
      if (disposed) return
      closeSocket()

      let socket: WebSocket

      try {
        setWsConnectionState('connecting')
        socket = new WebSocket(wsUrl, wsProtocols)
      } catch {
        scheduleReconnect('Live map socket initialization failed.')
        return
      }

      wsRef.current = socket

      socket.onopen = () => {
        if (disposed) return
        wsReconnectAttemptsRef.current = 0
        setWsConnectionState('open')
        setError('')
      }

      socket.onmessage = (event) => {
        if (disposed) return

        try {
          const payload = JSON.parse(event.data)
          if (payload?.type === 'snapshot' && payload?.data) {
            const data = payload.data as MapDataResponse
            applySnapshot(data)
            setLoading(false)
            setError('')
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      }

      socket.onerror = () => {
        if (disposed) return
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close()
        }
      }

      socket.onclose = (event) => {
        if (disposed) return
        wsRef.current = null

        if (WS_AUTH_CLOSE_CODES.has(event.code)) {
          setWsConnectionState('closed')
          setError('Session expired. Please log in again.')
          emitAuthExpired('Session expired. Please log in again.')
          return
        }

        if (!getAuthToken().trim()) {
          setWsConnectionState('closed')
          setError('Session expired. Please log in again.')
          return
        }

        scheduleReconnect(event.wasClean ? 'Live map socket closed.' : 'Live map socket disconnected.')
      }
    }

    wsReconnectTimerRef.current = window.setTimeout(() => {
      wsReconnectTimerRef.current = null
      connectWebSocket()
    }, 0)

    return () => {
      disposed = true
      window.clearInterval(fallbackInterval)
      clearReconnectTimer()
      closeSocket()
      setWsConnectionState('disabled')
    }
  }, [applySnapshot, currentToken, enableTrackingWs, hasTrackingAccess, load])

  return useMemo(
    () => ({
      clientSites,
      trackingPoints,
      geofenceAlerts,
      wsConnectionState,
      loading,
      error,
      hasTrackingAccess,
      refresh: load,
      lastUpdated,
      createClientSite,
      updateClientSite,
      deleteClientSite,
      sendGuardHeartbeat,
      fetchGuardHistory,
      fetchGuardPath,
      fetchActiveGuards,
      isElevatedUser,
    }),
    [
      clientSites,
      trackingPoints,
      geofenceAlerts,
      wsConnectionState,
      loading,
      error,
      hasTrackingAccess,
      load,
      lastUpdated,
      createClientSite,
      updateClientSite,
      deleteClientSite,
      sendGuardHeartbeat,
      fetchGuardHistory,
      fetchGuardPath,
      fetchActiveGuards,
      isElevatedUser,
    ],
  )
}
