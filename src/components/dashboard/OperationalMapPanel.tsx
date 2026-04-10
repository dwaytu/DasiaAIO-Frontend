import { FC, FormEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { type ActiveGuard, type ClientSiteInput, type MapTrackingPoint, useOperationalMapData } from '../../hooks/useOperationalMapData'
import { getPersonRecencyMinutes, getTrackingAccuracyMode, getVehicleRecencyMinutes } from '../../utils/trackingPolicy'
import { useTheme } from '../../context/ThemeProvider'
import { useOperationalEvent } from '../../context/OperationalEventContext'
import { getOperationalMapTileUrl } from './mapTileUrls'

interface OperationalMapPanelProps {
  activeTrips: number
  activeGuards: number
}

interface SelectedGuardEventMatch {
  guardId?: string
  userId?: string
  guardName?: string
  latitude: number
  longitude: number
}

type HeartbeatState = 'active' | 'stale' | 'offline'

type ScheduleState = 'scheduled' | 'unscheduled'

type LayerVisibility = {
  guards: boolean
  vehicles: boolean
  clientSites: boolean
  alerts: boolean
}

type TelemetryEntry = {
  point: MapTrackingPoint
  heartbeatState: HeartbeatState
  scheduleState: ScheduleState
  ageSeconds: number
  guardMetadata?: ActiveGuard
}

const eventTypeBadgeClass: Record<'incident' | 'alert' | 'guard' | 'vehicle', string> = {
  incident: 'border-danger-border bg-danger-bg text-danger-text',
  alert: 'border-warning-border bg-warning-bg text-warning-text',
  guard: 'border-info-border bg-info-bg text-info-text',
  vehicle: 'border-warning-border bg-warning-bg text-warning-text',
}

const eventTypeLabel: Record<'incident' | 'alert' | 'guard' | 'vehicle', string> = {
  incident: 'Incident',
  alert: 'Alert',
  guard: 'Guard',
  vehicle: 'Vehicle',
}

const normalizeEventToken = (value?: string): string => value?.trim().toLowerCase() ?? ''

const TAGUM_CENTER: [number, number] = [7.4478, 125.8078]

const INITIAL_FORM: ClientSiteInput = {
  name: '',
  address: '',
  latitude: TAGUM_CENTER[0],
  longitude: TAGUM_CENTER[1],
  isActive: true,
}

interface MapClickPickerProps {
  enabled: boolean
  onPick: (latitude: number, longitude: number) => void
}

const MapClickPicker: FC<MapClickPickerProps> = ({ enabled, onPick }) => {
  useMapEvents({
    click(event) {
      if (!enabled) return
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}

interface MapViewportSyncProps {
  center: [number, number]
}

const MapViewportSync: FC<MapViewportSyncProps> = ({ center }) => {
  const map = useMap()

  useEffect(() => {
    const [lat, lng] = center
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    const currentCenter = map.getCenter()
    const centerChanged = Math.abs(currentCenter.lat - lat) > 0.0001 || Math.abs(currentCenter.lng - lng) > 0.0001
    if (!centerChanged) return

    map.stop()
    map.setView(center, Math.max(map.getZoom(), 13), { animate: false })
  }, [center, map])

  return null
}

interface MapZoomTrackerProps {
  onZoomChange: (zoom: number) => void
}

const MapZoomTracker: FC<MapZoomTrackerProps> = ({ onZoomChange }) => {
  useMapEvents({
    zoomend(event) {
      onZoomChange(event.target.getZoom())
    },
  })

  return null
}

interface MapViewCommandControllerProps {
  commandId: number
  commandType: 'fit-all' | 'center-tagum' | 'center-user'
  bounds: [number, number][]
  currentUserPosition: [number, number] | null
}

const MapViewCommandController: FC<MapViewCommandControllerProps> = ({
  commandId,
  commandType,
  bounds,
  currentUserPosition,
}) => {
  const map = useMap()

  useEffect(() => {
    if (commandId === 0) return

    if (commandType === 'center-tagum') {
      map.stop()
      map.setView(TAGUM_CENTER, Math.max(map.getZoom(), 12), { animate: true })
      return
    }

    if (commandType === 'center-user') {
      const center = currentUserPosition || TAGUM_CENTER
      map.stop()
      map.setView(center, Math.max(map.getZoom(), 13), { animate: true })
      return
    }

    const safeBounds = bounds.length > 0 ? bounds : [TAGUM_CENTER]
    map.stop()
    map.fitBounds(L.latLngBounds(safeBounds), {
      animate: true,
      maxZoom: 15,
      padding: [36, 36],
    })
  }, [bounds, commandId, commandType, currentUserPosition, map])

  return null
}

const currentUserPin = L.divIcon({
  className: 'current-user-pin',
  html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#dc2626;border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(220,38,38,0.35)"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function resolvePointAgeSeconds(point: Pick<MapTrackingPoint, 'ageSeconds' | 'recordedAt'>): number {
  if (typeof point.ageSeconds === 'number' && Number.isFinite(point.ageSeconds)) {
    return Math.max(0, Math.round(point.ageSeconds))
  }

  const recordedAtMs = new Date(point.recordedAt).getTime()
  if (Number.isNaN(recordedAtMs)) return 0
  return Math.max(0, Math.floor((Date.now() - recordedAtMs) / 1000))
}

function normalizeHeartbeatState(
  point: Pick<MapTrackingPoint, 'heartbeatStatus' | 'entityType' | 'recordedAt' | 'ageSeconds'>,
  personRecencyMinutes: number,
  vehicleRecencyMinutes: number,
): HeartbeatState {
  const status = point.heartbeatStatus?.trim().toLowerCase()
  if (status === 'active') return 'active'
  if (status === 'stale') return 'stale'
  if (status === 'offline') return 'offline'

  const ageMinutes = resolvePointAgeSeconds(point) / 60
  const recency = point.entityType === 'vehicle' ? vehicleRecencyMinutes : personRecencyMinutes

  if (ageMinutes <= recency) return 'active'
  if (point.entityType === 'vehicle') return 'offline'
  if (ageMinutes <= Math.max(recency * 2, personRecencyMinutes * 2)) return 'stale'
  return 'offline'
}

function normalizeScheduleState(rawStatus?: string): ScheduleState {
  const status = rawStatus?.trim().toLowerCase()
  if (!status || status === 'unscheduled') return 'unscheduled'
  return 'scheduled'
}

function movementTone(entityType: string, heartbeatState: HeartbeatState) {
  if (entityType === 'vehicle') {
    return { color: '#2563eb', fillColor: '#2563eb', ring: 'status-light-info' }
  }

  if (heartbeatState === 'active') {
    return { color: '#16a34a', fillColor: '#16a34a', ring: 'status-light-success' }
  }

  if (heartbeatState === 'stale') {
    return { color: '#f59e0b', fillColor: '#f59e0b', ring: 'status-light-warning' }
  }

  return { color: '#dc2626', fillColor: '#dc2626', ring: 'status-light-danger' }
}

const OperationalMapPanel: FC<OperationalMapPanelProps> = ({ activeTrips, activeGuards }) => {
  const { theme } = useTheme()
  const { selectedEvent, clearSelection } = useOperationalEvent()
  const {
    clientSites,
    trackingPoints,
    geofenceAlerts,
    loading,
    error,
    lastUpdated,
    createClientSite,
    updateClientSite,
    deleteClientSite,
    fetchGuardPath,
    fetchActiveGuards,
    isElevatedUser,
    hasTrackingAccess,
  } = useOperationalMapData()

  const [siteForm, setSiteForm] = useState<ClientSiteInput>(INITIAL_FORM)
  const [editingSiteId, setEditingSiteId] = useState<string>('')
  const [mapPickMode, setMapPickMode] = useState<'idle' | 'add' | 'edit'>('idle')
  const [mapZoom, setMapZoom] = useState<number>(12)
  const [focusCenter, setFocusCenter] = useState<[number, number] | null>(null)
  const [selectedGuardId, setSelectedGuardId] = useState<string>('')
  const [selectedGuardPath, setSelectedGuardPath] = useState<Array<{ latitude: number; longitude: number; recordedAt: string; movementStatus?: string }>>([])
  const [activeGuardsIntel, setActiveGuardsIntel] = useState<ActiveGuard[]>([])
  const [playbackEnabled, setPlaybackEnabled] = useState<boolean>(false)
  const [playbackIndex, setPlaybackIndex] = useState<number>(0)
  const [followSelectedGuard, setFollowSelectedGuard] = useState<boolean>(true)
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    guards: true,
    vehicles: true,
    clientSites: true,
    alerts: true,
  })
  const [mapViewCommand, setMapViewCommand] = useState<{ id: number; type: 'fit-all' | 'center-tagum' | 'center-user' }>({
    id: 0,
    type: 'fit-all',
  })
  const [saving, setSaving] = useState<boolean>(false)
  const [formError, setFormError] = useState<string>('')
  const [dismissedDegradedError, setDismissedDegradedError] = useState<string>('')

  const selectedEventPanelRef = useRef<HTMLElement | null>(null)
  const trackingMode = getTrackingAccuracyMode()
  const personRecencyMinutes = getPersonRecencyMinutes(trackingMode)
  const vehicleRecencyMinutes = getVehicleRecencyMinutes(trackingMode)

  const currentUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem('user')
      if (!raw) return ''
      const parsed = JSON.parse(raw)
      return typeof parsed?.id === 'string' ? parsed.id : ''
    } catch {
      return ''
    }
  }, [])

  const guardMetadataById = useMemo(() => {
    const metadata = new Map<string, ActiveGuard>()

    for (const guard of activeGuardsIntel) {
      const guardId = guard.guardId?.trim().toLowerCase()
      const userId = guard.userId?.trim().toLowerCase()
      if (guardId) metadata.set(guardId, guard)
      if (userId) metadata.set(userId, guard)
    }

    return metadata
  }, [activeGuardsIntel])

  const pointTelemetry = useMemo<TelemetryEntry[]>(() => {
    return trackingPoints.map((point) => {
      const guardMetadata =
        guardMetadataById.get(point.entityId.trim().toLowerCase()) ||
        (point.userId ? guardMetadataById.get(point.userId.trim().toLowerCase()) : undefined)

      const heartbeatState = normalizeHeartbeatState(point, personRecencyMinutes, vehicleRecencyMinutes)
      const scheduleState = point.entityType === 'vehicle'
        ? 'scheduled'
        : normalizeScheduleState(point.scheduleStatus || guardMetadata?.scheduleStatus)

      return {
        point,
        heartbeatState,
        scheduleState,
        ageSeconds: resolvePointAgeSeconds(point),
        guardMetadata,
      }
    })
  }, [guardMetadataById, personRecencyMinutes, trackingPoints, vehicleRecencyMinutes])

  const guardTelemetry = useMemo(
    () => pointTelemetry.filter((entry) => entry.point.entityType !== 'vehicle'),
    [pointTelemetry],
  )

  const visibleTelemetry = useMemo(
    () => pointTelemetry.filter((entry) => {
      if (entry.point.entityType === 'vehicle') {
        return layerVisibility.vehicles
      }
      return layerVisibility.guards
    }),
    [layerVisibility.guards, layerVisibility.vehicles, pointTelemetry],
  )

  const currentUserEntry = useMemo(() => {
    if (!currentUserId) return null

    return (
      pointTelemetry
        .filter((entry) => entry.point.entityId === currentUserId)
        .sort((left, right) => {
          return new Date(right.point.recordedAt).getTime() - new Date(left.point.recordedAt).getTime()
        })[0] || null
    )
  }, [pointTelemetry, currentUserId])

  const mapCenter = useMemo<[number, number]>(() => {
    if (focusCenter) return focusCenter
    if (!currentUserEntry) return TAGUM_CENTER
    return [currentUserEntry.point.latitude, currentUserEntry.point.longitude]
  }, [focusCenter, currentUserEntry])

  const alertMarkers = useMemo(() => {
    const siteById = new Map(clientSites.map((site) => [site.id, site]))

    return geofenceAlerts
      .map((alert) => {
        const site = siteById.get(alert.siteId)
        if (!site) return null

        return {
          alert,
          latitude: site.latitude,
          longitude: site.longitude,
        }
      })
      .filter(
        (marker): marker is { alert: (typeof geofenceAlerts)[number]; latitude: number; longitude: number } => marker != null,
      )
  }, [clientSites, geofenceAlerts])

  const mapBounds = useMemo(() => {
    const positions: [number, number][] = []

    if (layerVisibility.clientSites) {
      for (const site of clientSites) {
        positions.push([site.latitude, site.longitude])
      }
    }

    for (const entry of visibleTelemetry) {
      positions.push([entry.point.latitude, entry.point.longitude])
    }

    if (layerVisibility.alerts) {
      for (const marker of alertMarkers) {
        positions.push([marker.latitude, marker.longitude])
      }
    }

    if (currentUserEntry) {
      positions.push([currentUserEntry.point.latitude, currentUserEntry.point.longitude])
    }

    return positions.length > 0 ? positions : [TAGUM_CENTER]
  }, [alertMarkers, clientSites, currentUserEntry, layerVisibility.alerts, layerVisibility.clientSites, visibleTelemetry])

  const selectedGuardEventMatch = useMemo<SelectedGuardEventMatch | null>(() => {
    if (!selectedEvent || selectedEvent.type !== 'guard') {
      return null
    }

    const selectedIdToken = normalizeEventToken(selectedEvent.id)
    const selectedTitleToken = normalizeEventToken(selectedEvent.title)

    const identityMatch = activeGuardsIntel.find((guard) => {
      const guardIdToken = normalizeEventToken(guard.guardId)
      const userIdToken = normalizeEventToken(guard.userId)

      if (!selectedIdToken) return false
      return guardIdToken === selectedIdToken || userIdToken === selectedIdToken
    })

    if (identityMatch) {
      return {
        guardId: identityMatch.guardId,
        userId: identityMatch.userId,
        guardName: identityMatch.guardName,
        latitude: identityMatch.latitude,
        longitude: identityMatch.longitude,
      }
    }

    const titleMatch = activeGuardsIntel.find((guard) => {
      const guardNameToken = normalizeEventToken(guard.guardName)
      return Boolean(guardNameToken) && selectedTitleToken.includes(guardNameToken)
    })

    if (titleMatch) {
      return {
        guardId: titleMatch.guardId,
        userId: titleMatch.userId,
        guardName: titleMatch.guardName,
        latitude: titleMatch.latitude,
        longitude: titleMatch.longitude,
      }
    }

    const trackingMatch = pointTelemetry.map((entry) => entry.point).find((point) => {
      if (point.entityType === 'vehicle') return false

      const entityIdToken = normalizeEventToken(point.entityId)
      const userIdToken = normalizeEventToken(point.userId)

      if (!selectedIdToken) return false
      return entityIdToken === selectedIdToken || userIdToken === selectedIdToken
    })

    if (!trackingMatch) {
      return null
    }

    return {
      guardId: trackingMatch.entityId,
      userId: trackingMatch.userId,
      guardName: trackingMatch.label,
      latitude: trackingMatch.latitude,
      longitude: trackingMatch.longitude,
    }
  }, [activeGuardsIntel, pointTelemetry, selectedEvent])

  const selectedGuardMarkerTokens = useMemo(() => {
    if (!selectedEvent || selectedEvent.type !== 'guard' || !selectedGuardEventMatch) {
      return [] as string[]
    }

    return [selectedEvent.id, selectedGuardEventMatch.guardId, selectedGuardEventMatch.userId]
      .map((value) => normalizeEventToken(value))
      .filter((value) => value.length > 0)
  }, [selectedEvent, selectedGuardEventMatch])

  const isSelectedGuardTrackingPoint = (point: Pick<MapTrackingPoint, 'entityType' | 'entityId' | 'userId' | 'latitude' | 'longitude'>) => {
    if (selectedEvent?.type !== 'guard' || point.entityType === 'vehicle') {
      return false
    }

    const entityIdToken = normalizeEventToken(point.entityId)
    const userIdToken = normalizeEventToken(point.userId)
    if (selectedGuardMarkerTokens.includes(entityIdToken) || selectedGuardMarkerTokens.includes(userIdToken)) {
      return true
    }

    if (!selectedGuardEventMatch) {
      return false
    }

    const latClose = Math.abs(point.latitude - selectedGuardEventMatch.latitude) < 0.0002
    const lngClose = Math.abs(point.longitude - selectedGuardEventMatch.longitude) < 0.0002
    return latClose && lngClose
  }

  useEffect(() => {
    if (!selectedEvent) return

    selectedEventPanelRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      clearSelection()
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [clearSelection, selectedEvent])

  useEffect(() => {
    if (!followSelectedGuard || selectedEvent?.type !== 'guard' || !selectedGuardEventMatch) {
      return
    }

    setFocusCenter((previous) => {
      const next: [number, number] = [selectedGuardEventMatch.latitude, selectedGuardEventMatch.longitude]
      if (
        previous &&
        Math.abs(previous[0] - next[0]) < 0.0001 &&
        Math.abs(previous[1] - next[1]) < 0.0001
      ) {
        return previous
      }

      return next
    })

    if (selectedGuardEventMatch.guardId) {
      setSelectedGuardId((previous) => {
        return previous === selectedGuardEventMatch.guardId ? previous : selectedGuardEventMatch.guardId || previous
      })
    }
  }, [followSelectedGuard, selectedEvent?.type, selectedGuardEventMatch])

  useEffect(() => {
    let disposed = false

    const loadActiveGuards = async () => {
      try {
        const guards = await fetchActiveGuards(20)
        if (disposed) return
        setActiveGuardsIntel(guards)
      } catch {
        if (!disposed) {
          setActiveGuardsIntel([])
        }
      }
    }

    void loadActiveGuards()
    const intervalId = window.setInterval(() => {
      void loadActiveGuards()
    }, 30000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [fetchActiveGuards])

  useEffect(() => {
    if (!selectedGuardId) {
      setSelectedGuardPath([])
      setPlaybackEnabled(false)
      setPlaybackIndex(0)
      return
    }

    let disposed = false

    const loadSelectedGuardPath = async () => {
      try {
        const coordinates = await fetchGuardPath(selectedGuardId, 1200)
        if (disposed) return

        const safePath = coordinates
          .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
          .map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
            recordedAt: point.recordedAt,
            movementStatus: point.movementStatus,
          }))

        setSelectedGuardPath(safePath)
        setPlaybackIndex(Math.max(0, safePath.length - 1))
      } catch {
        if (!disposed) {
          setSelectedGuardPath([])
        }
      }
    }

    void loadSelectedGuardPath()

    return () => {
      disposed = true
    }
  }, [fetchGuardPath, selectedGuardId])

  useEffect(() => {
    if (!playbackEnabled || selectedGuardPath.length < 2) return

    const intervalId = window.setInterval(() => {
      setPlaybackIndex((previous) => {
        if (previous >= selectedGuardPath.length - 1) {
          return 0
        }
        return previous + 1
      })
    }, 1200)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [playbackEnabled, selectedGuardPath.length])

  useEffect(() => {
    if (!error) {
      setDismissedDegradedError('')
    }
  }, [error])

  const clusteredTelemetry = useMemo(() => {
    if (mapZoom >= 11) return []

    const gridSize = mapZoom <= 8 ? 0.16 : 0.08
    const buckets = new Map<string, { latitude: number; longitude: number; entries: TelemetryEntry[] }>()

    for (const entry of visibleTelemetry) {
      const point = entry.point
      const latBucket = Math.round(point.latitude / gridSize)
      const lngBucket = Math.round(point.longitude / gridSize)
      const key = `${latBucket}:${lngBucket}`

      const existing = buckets.get(key)
      if (!existing) {
        buckets.set(key, {
          latitude: point.latitude,
          longitude: point.longitude,
          entries: [entry],
        })
        continue
      }

      existing.entries.push(entry)
      existing.latitude = (existing.latitude * (existing.entries.length - 1) + point.latitude) / existing.entries.length
      existing.longitude = (existing.longitude * (existing.entries.length - 1) + point.longitude) / existing.entries.length
    }

    return Array.from(buckets.values())
  }, [mapZoom, visibleTelemetry])

  const selectedGuardPolyline = useMemo(() => {
    if (selectedGuardPath.length < 2) return []

    const maxIndex = playbackEnabled ? Math.max(1, playbackIndex + 1) : selectedGuardPath.length
    return selectedGuardPath.slice(0, maxIndex).map((point) => [point.latitude, point.longitude] as [number, number])
  }, [playbackEnabled, playbackIndex, selectedGuardPath])

  const playbackPoint = useMemo(() => {
    if (!selectedGuardPath.length) return null
    const index = playbackEnabled ? playbackIndex : selectedGuardPath.length - 1
    return selectedGuardPath[Math.max(0, Math.min(index, selectedGuardPath.length - 1))]
  }, [playbackEnabled, playbackIndex, selectedGuardPath])

  const geofenceFeed = useMemo(() => geofenceAlerts.slice(0, 6), [geofenceAlerts])
  const showNoTrackingAccessOverlay = !loading && !hasTrackingAccess
  const showNoPersonnelOverlay = !loading && hasTrackingAccess && !error && visibleTelemetry.length === 0
  const showDegradedBanner = Boolean(error) && hasTrackingAccess && dismissedDegradedError !== error
  const shouldPromptClientSiteSetup = showNoPersonnelOverlay && clientSites.length === 0

  const staleGuardCount = useMemo(
    () => guardTelemetry.filter((entry) => entry.heartbeatState === 'stale').length,
    [guardTelemetry],
  )

  const offlineGuardCount = useMemo(
    () => guardTelemetry.filter((entry) => entry.heartbeatState === 'offline').length,
    [guardTelemetry],
  )

  const unscheduledGuardCount = useMemo(
    () => guardTelemetry.filter((entry) => entry.scheduleState === 'unscheduled').length,
    [guardTelemetry],
  )

  const scheduledGuardCount = useMemo(
    () => guardTelemetry.filter((entry) => entry.scheduleState === 'scheduled').length,
    [guardTelemetry],
  )

  const issueMapCommand = (type: 'fit-all' | 'center-tagum' | 'center-user') => {
    setMapViewCommand((previous) => ({
      id: previous.id + 1,
      type,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')

    if (!siteForm.name.trim()) {
      setFormError('Site name is required.')
      return
    }

    if (Number.isNaN(siteForm.latitude) || Number.isNaN(siteForm.longitude)) {
      setFormError('Latitude and longitude must be valid numbers.')
      return
    }

    try {
      setSaving(true)
      if (editingSiteId) {
        await updateClientSite(editingSiteId, siteForm)
      } else {
        await createClientSite(siteForm)
      }
      setSiteForm(INITIAL_FORM)
      setEditingSiteId('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save site')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (siteId: string) => {
    const site = clientSites.find((entry) => entry.id === siteId)
    if (!site) return

    setSiteForm({
      name: site.name,
      address: site.address || '',
      latitude: site.latitude,
      longitude: site.longitude,
      isActive: site.isActive,
    })
    setEditingSiteId(site.id)
    setFormError('')
  }

  const handleDelete = async (siteId: string) => {
    if (!window.confirm('Delete this client location?')) return
    setFormError('')
    try {
      await deleteClientSite(siteId)
      if (editingSiteId === siteId) {
        setEditingSiteId('')
        setSiteForm(INITIAL_FORM)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete site')
    }
  }

  const handleMapPick = (latitude: number, longitude: number) => {
    setSiteForm((prev) => ({
      ...prev,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    }))
    setMapPickMode('idle')
    setFormError('')
  }

  const focusGuard = (guardId: string, latitude: number, longitude: number) => {
    setSelectedGuardId(guardId)
    setFocusCenter([latitude, longitude])
    setFollowSelectedGuard(true)
  }

  return (
    <section className="command-panel p-4 md:p-6" aria-label="Operational map">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
        <div>
          <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">Operational Map</h3>
          <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">OpenStreetMap live field tracking and reliability telemetry</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => issueMapCommand('fit-all')}
            className="min-h-11 rounded-md border border-border-subtle bg-surface-elevated px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
          >
            Fit All
          </button>
          <button
            type="button"
            onClick={() => issueMapCommand('center-tagum')}
            className="min-h-11 rounded-md border border-border-subtle bg-surface-elevated px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
          >
            Center Tagum
          </button>
          <button
            type="button"
            onClick={() => issueMapCommand('center-user')}
            className="min-h-11 rounded-md border border-border-subtle bg-surface-elevated px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
          >
            Center Me
          </button>
          {isElevatedUser ? (
            <button
              type="button"
              onClick={() => {
                setEditingSiteId('')
                setMapPickMode('add')
                setFormError('')
              }}
              className="min-h-11 rounded-md border border-info-border bg-info-bg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-info-text"
              aria-label="Add a new client location on the map"
            >
              + Add Client Site
            </button>
          ) : null}
          <p className="text-xs text-text-tertiary">{lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for first sync'}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-border-subtle bg-surface-elevated p-2 text-xs">
        <button
          type="button"
          onClick={() => setLayerVisibility((prev) => ({ ...prev, guards: !prev.guards }))}
          className={`min-h-10 rounded-md border px-2.5 py-1 font-semibold uppercase tracking-wide ${layerVisibility.guards ? 'border-success-border bg-success-bg text-success-text' : 'border-border-subtle bg-background text-text-secondary'}`}
        >
          Guards
        </button>
        <button
          type="button"
          onClick={() => setLayerVisibility((prev) => ({ ...prev, vehicles: !prev.vehicles }))}
          className={`min-h-10 rounded-md border px-2.5 py-1 font-semibold uppercase tracking-wide ${layerVisibility.vehicles ? 'border-info-border bg-info-bg text-info-text' : 'border-border-subtle bg-background text-text-secondary'}`}
        >
          Vehicles
        </button>
        <button
          type="button"
          onClick={() => setLayerVisibility((prev) => ({ ...prev, clientSites: !prev.clientSites }))}
          className={`min-h-10 rounded-md border px-2.5 py-1 font-semibold uppercase tracking-wide ${layerVisibility.clientSites ? 'border-warning-border bg-warning-bg text-warning-text' : 'border-border-subtle bg-background text-text-secondary'}`}
        >
          Client Sites
        </button>
        <button
          type="button"
          onClick={() => setLayerVisibility((prev) => ({ ...prev, alerts: !prev.alerts }))}
          className={`min-h-10 rounded-md border px-2.5 py-1 font-semibold uppercase tracking-wide ${layerVisibility.alerts ? 'border-danger-border bg-danger-bg text-danger-text' : 'border-border-subtle bg-background text-text-secondary'}`}
        >
          Alerts
        </button>
        <button
          type="button"
          onClick={() => setFollowSelectedGuard((previous) => !previous)}
          className={`min-h-10 rounded-md border px-2.5 py-1 font-semibold uppercase tracking-wide ${followSelectedGuard ? 'border-info-border bg-info-bg text-info-text' : 'border-border-subtle bg-background text-text-secondary'}`}
        >
          Follow Selected Guard: {followSelectedGuard ? 'On' : 'Off'}
        </button>
      </div>

      <div className="relative isolate h-80 overflow-hidden rounded border border-border-elevated bg-surface md:h-96">
        <MapContainer
          center={mapCenter}
          zoom={12}
          className="h-full w-full"
          scrollWheelZoom
          bounds={mapBounds}
          aria-label="Live operations map with guard, vehicle, and client site markers"
        >
          <MapViewportSync center={mapCenter} />
          <MapViewCommandController
            commandId={mapViewCommand.id}
            commandType={mapViewCommand.type}
            bounds={mapBounds}
            currentUserPosition={currentUserEntry ? [currentUserEntry.point.latitude, currentUserEntry.point.longitude] : null}
          />
          <MapZoomTracker onZoomChange={setMapZoom} />
          <MapClickPicker enabled={isElevatedUser && mapPickMode !== 'idle'} onPick={handleMapPick} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={getOperationalMapTileUrl(theme)}
          />

          {layerVisibility.clientSites
            ? clientSites.map((site) => (
                <Fragment key={`site-group-${site.id}`}>
                  <Circle
                    center={[site.latitude, site.longitude]}
                    radius={1000}
                    pathOptions={{ color: '#facc15', fillColor: '#facc15', fillOpacity: 0.1, weight: 1 }}
                  />
                  <CircleMarker
                    key={`site-${site.id}`}
                    center={[site.latitude, site.longitude]}
                    radius={10}
                    pathOptions={{ color: '#facc15', fillColor: '#facc15', fillOpacity: 0.75 }}
                  >
                    <Popup>
                      <strong>Client Site</strong>
                      <div>{site.name}</div>
                      {site.address ? <div>{site.address}</div> : null}
                      <div>Radius: 1 km</div>
                    </Popup>
                  </CircleMarker>
                </Fragment>
              ))
            : null}

          {layerVisibility.alerts
            ? alertMarkers.map((marker) => (
                <CircleMarker
                  key={`alert-${marker.alert.id}`}
                  center={[marker.latitude, marker.longitude]}
                  radius={7}
                  pathOptions={{
                    color: marker.alert.eventType === 'enter' ? '#16a34a' : '#dc2626',
                    fillColor: marker.alert.eventType === 'enter' ? '#16a34a' : '#dc2626',
                    fillOpacity: 0.4,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>{marker.alert.eventType === 'enter' ? 'Geofence Enter' : 'Geofence Exit'}</strong>
                    <div>{marker.alert.guardName || marker.alert.guardId}</div>
                    <div>{marker.alert.siteName}</div>
                    <div>{new Date(marker.alert.createdAt).toLocaleString()}</div>
                  </Popup>
                </CircleMarker>
              ))
            : null}

          {selectedGuardPolyline.length > 1 ? (
            <Polyline
              positions={selectedGuardPolyline}
              pathOptions={{ color: '#22c55e', weight: 3, opacity: 0.85 }}
            />
          ) : null}

          {selectedEvent?.type === 'guard' && selectedGuardEventMatch ? (
            <CircleMarker
              center={[selectedGuardEventMatch.latitude, selectedGuardEventMatch.longitude]}
              radius={12}
              pathOptions={{ color: 'var(--color-info)', fillColor: 'var(--color-info)', fillOpacity: 0.15, weight: 2 }}
            >
              <Popup>
                <strong>Selected Guard</strong>
                <div>{selectedGuardEventMatch.guardName || selectedGuardEventMatch.guardId?.slice(0, 8) || 'N/A'}</div>
                <div>Focused from operational event stream.</div>
              </Popup>
            </CircleMarker>
          ) : null}

          {playbackPoint ? (
            <CircleMarker
              center={[playbackPoint.latitude, playbackPoint.longitude]}
              radius={8}
              pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.35, weight: 2 }}
            >
              <Popup>
                <strong>Playback Position</strong>
                <div>{new Date(playbackPoint.recordedAt).toLocaleString()}</div>
              </Popup>
            </CircleMarker>
          ) : null}

          {mapZoom < 11
            ? clusteredTelemetry.map((cluster, index) => (
                <CircleMarker
                  key={`cluster-${index}`}
                  center={[cluster.latitude, cluster.longitude]}
                  radius={Math.min(24, 8 + cluster.entries.length)}
                  pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.3 }}
                >
                  <Popup>
                    <strong>{cluster.entries.length} units in this area</strong>
                    <div>Zoom in for individual guard status, schedule state, and heartbeat age.</div>
                  </Popup>
                </CircleMarker>
              ))
            : visibleTelemetry.map((entry) => {
                const point = entry.point
                const isCurrentUser = currentUserId && point.entityId === currentUserId
                const isSelectedGuardPoint = isSelectedGuardTrackingPoint(point)
                const tone = movementTone(point.entityType, entry.heartbeatState)
                const markerColor = isSelectedGuardPoint ? 'var(--color-info)' : tone.color
                const sourceLabel = point.source || (point.entityType === 'vehicle' ? 'vehicle-telemetry' : 'unknown')
                const scheduleLabel = point.entityType === 'vehicle'
                  ? 'scheduled'
                  : (point.scheduleStatus || entry.guardMetadata?.scheduleStatus || entry.scheduleState)

                if (isCurrentUser) {
                  return (
                    <Fragment key={`track-user-group-${point.id}`}>
                      {point.accuracyMeters != null ? (
                        <Circle
                          center={[point.latitude, point.longitude]}
                          radius={Math.min(Math.max(point.accuracyMeters, 20), 2500)}
                          pathOptions={{ color: markerColor, fillColor: markerColor, fillOpacity: 0.04, opacity: 0.3, weight: 1 }}
                        />
                      ) : null}
                      <Marker position={[point.latitude, point.longitude]} icon={currentUserPin}>
                        <Popup>
                          <strong>Your Location</strong>
                          <div>{point.label || 'Entity'}</div>
                          <div>Heartbeat: {entry.heartbeatState}</div>
                          <div>Schedule: {scheduleLabel}</div>
                          <div>Source: {sourceLabel}</div>
                          {point.accuracyMeters != null ? <div>Accuracy: {Math.round(point.accuracyMeters)} m</div> : null}
                          <div>Updated: {entry.ageSeconds}s ago</div>
                          <div>{new Date(point.recordedAt).toLocaleString()}</div>
                        </Popup>
                      </Marker>
                    </Fragment>
                  )
                }

                return (
                  <Fragment key={`track-${point.id}`}>
                    {point.accuracyMeters != null ? (
                      <Circle
                        center={[point.latitude, point.longitude]}
                        radius={Math.min(Math.max(point.accuracyMeters, 20), 2500)}
                        pathOptions={{ color: markerColor, fillColor: markerColor, fillOpacity: 0.05, opacity: 0.35, weight: 1 }}
                      />
                    ) : null}
                    <CircleMarker
                      center={[point.latitude, point.longitude]}
                      radius={isSelectedGuardPoint ? 8 : 6}
                      pathOptions={{
                        color: markerColor,
                        fillColor: markerColor,
                        fillOpacity: isSelectedGuardPoint ? 0.95 : 0.8,
                        weight: isSelectedGuardPoint ? 3 : 1,
                        dashArray: point.entityType !== 'vehicle' && entry.scheduleState === 'unscheduled' ? '4 3' : undefined,
                      }}
                    >
                      <Popup>
                        <strong>{point.entityType === 'vehicle' ? 'Armored Vehicle' : 'Guard'}</strong>
                        <div>{point.label || entry.guardMetadata?.guardName || 'Entity'}</div>
                        {isSelectedGuardPoint ? <div>Linked to selected operational event</div> : null}
                        {point.status ? <div>Status: {point.status}</div> : null}
                        {point.movementStatus ? <div>Movement: {point.movementStatus}</div> : null}
                        <div>Heartbeat: {entry.heartbeatState}</div>
                        <div>Schedule: {scheduleLabel}</div>
                        <div>Source: {sourceLabel}{point.approximate ? ' (approximate)' : ''}</div>
                        {point.speedKph != null ? <div>Speed: {point.speedKph.toFixed(1)} km/h</div> : null}
                        {point.accuracyMeters != null ? <div>Accuracy: {Math.round(point.accuracyMeters)} m</div> : null}
                        <div>Updated: {entry.ageSeconds}s ago</div>
                        <div>{new Date(point.recordedAt).toLocaleString()}</div>
                      </Popup>
                    </CircleMarker>
                  </Fragment>
                )
              })}

          {isElevatedUser ? (
            <CircleMarker
              center={[siteForm.latitude, siteForm.longitude]}
              radius={5}
              pathOptions={{ color: 'var(--color-info)', fillColor: 'var(--color-info)', fillOpacity: 0.45 }}
            >
              <Popup>
                <strong>Selected Coordinates</strong>
                <div>{siteForm.latitude.toFixed(6)}, {siteForm.longitude.toFixed(6)}</div>
              </Popup>
            </CircleMarker>
          ) : null}
        </MapContainer>

        {loading ? (
          <div className="pointer-events-none absolute inset-0 z-[360] grid place-items-center bg-surface/70 backdrop-blur-[1px]">
            <div className="rounded-md border border-border-subtle bg-surface-elevated px-4 py-3 text-center shadow-sm">
              <p className="text-sm font-semibold text-text-primary">Loading live map data</p>
              <p className="mt-1 text-xs text-text-secondary">Synchronizing guard, vehicle, and client site positions.</p>
            </div>
          </div>
        ) : null}

        {showNoTrackingAccessOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-[330] flex items-center justify-center p-4">
            <div className="max-w-md rounded border border-border bg-surface-elevated px-4 py-3 text-center shadow-sm">
              <p className="text-sm font-semibold text-text-primary">Live tracking unavailable for this account</p>
              <p className="mt-1 text-xs text-text-secondary">Live tracking is available for field supervisors and guards.</p>
              <p className="mt-1 text-xs text-text-secondary">Sign in with a supervisor or guard account to view live positions.</p>
            </div>
          </div>
        ) : null}

        {showNoPersonnelOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-[320] flex items-center justify-center p-4">
            <div className="max-w-md rounded border border-border bg-surface-elevated px-4 py-3 text-center shadow-sm">
              <p className="text-sm font-semibold text-text-primary">No tracked field units yet</p>
              <p className="mt-1 text-xs text-text-secondary">Tracked guards appear here as soon as heartbeat updates arrive, even when unscheduled.</p>
              <p className="mt-1 text-xs text-text-secondary">
                {shouldPromptClientSiteSetup
                  ? 'No client sites are configured yet. Supervisors can add client sites using the map controls.'
                  : 'Client sites are configured and waiting for incoming guard location updates.'}
              </p>
            </div>
          </div>
        ) : null}

        {showDegradedBanner ? (
          <div className="absolute left-3 right-3 top-3 z-[420]">
            <div className="flex items-start justify-between gap-3 rounded border border-warning-border bg-warning-bg px-3 py-2 shadow-sm" role="status" aria-live="polite">
              <p className="text-sm text-text-secondary">Live tracking data temporarily unavailable - map shows last known positions.</p>
              <button
                type="button"
                onClick={() => setDismissedDegradedError(error)}
                className="min-h-11 rounded-md border border-warning-border bg-warning-bg px-2 py-1 text-xs font-semibold uppercase tracking-wide text-warning-text"
                aria-label="Dismiss live tracking degraded state notice"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {selectedEvent ? (
          <aside
            ref={selectedEventPanelRef}
            tabIndex={0}
            aria-label="Selected operational event details"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              clearSelection()
            }}
            className="absolute right-3 top-3 z-[500] w-full max-w-[280px] rounded border border-border bg-surface-elevated p-3 outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${eventTypeBadgeClass[selectedEvent.type]}`}>
                {eventTypeLabel[selectedEvent.type]}
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="min-h-11 rounded-md border border-border-subtle px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-secondary"
                aria-label="Dismiss selected event details"
              >
                X
              </button>
            </div>

            <p className="mt-2 text-sm font-semibold text-text-primary">{selectedEvent.title}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-text-tertiary">
              Ref: <span className="font-semibold normal-case tracking-normal text-text-secondary">{selectedEvent.id?.slice(0, 8)?.toUpperCase() || '-'}</span>
            </p>

            {selectedEvent.type === 'guard' ? (
              <p className="mt-2 text-xs text-text-secondary">
                {selectedGuardEventMatch
                  ? `Matched telemetry. ${followSelectedGuard ? 'Follow mode is active.' : 'Follow mode is disabled.'}`
                  : 'Guard event selected, but no active telemetry match is currently available.'}
              </p>
            ) : null}
          </aside>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-md border border-info-border bg-info-bg px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Active Trips</p>
          <p className="text-xl font-black text-text-primary">{activeTrips}</p>
        </div>
        <div className="rounded-md border border-success-border bg-success-bg px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Deployed Guards</p>
          <p className="text-xl font-black text-text-primary">{activeGuards}</p>
        </div>
        <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Tracked Units</p>
          <p className="text-xl font-black text-text-primary">{visibleTelemetry.length}</p>
          <p className="text-[11px] text-text-tertiary">Stale and offline remain visible</p>
        </div>
        <div className="rounded-md border border-info-border bg-info-bg px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Scheduled Guards</p>
          <p className="text-xl font-black text-text-primary">{scheduledGuardCount}</p>
        </div>
        <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Unscheduled Guards</p>
          <p className="text-xl font-black text-text-primary">{unscheduledGuardCount}</p>
        </div>
        <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Stale / Offline</p>
          <p className="text-xl font-black text-text-primary">{staleGuardCount}/{offlineGuardCount}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-md border border-border-subtle bg-surface-elevated p-3" aria-label="Guard movement controls">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary">Guard Movement Intelligence</h4>
            <span className="text-[11px] text-text-tertiary">{activeGuardsIntel.length} tracked in last 20 minutes</span>
          </div>

          <div className="mb-2 flex flex-wrap gap-2">
            {activeGuardsIntel.slice(0, 8).map((guard) => {
              const scheduleState = normalizeScheduleState(guard.scheduleStatus)
              const heartbeatState = (guard.heartbeatStatus || 'offline').toLowerCase()

              return (
                <button
                  key={guard.guardId}
                  type="button"
                  onClick={() => focusGuard(guard.guardId, guard.latitude, guard.longitude)}
                  className={`min-h-11 rounded-md border px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide ${selectedGuardId === guard.guardId ? 'border-success-border bg-success-bg text-success-text' : 'border-border-subtle bg-background text-text-secondary'}`}
                >
                  {guard.guardName || guard.guardId.slice(0, 8)} ({heartbeatState}/{scheduleState})
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaybackEnabled((previous) => !previous)}
              disabled={selectedGuardPath.length < 2}
              className="min-h-11 rounded-md border border-border-subtle bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary disabled:opacity-50"
            >
              {playbackEnabled ? 'Stop Playback' : 'Start Playback'}
            </button>
            <label className="flex items-center gap-2 text-xs text-text-secondary" htmlFor="trail-frame-index">
              Trail Frame
              <input
                id="trail-frame-index"
                type="range"
                min={0}
                max={Math.max(0, selectedGuardPath.length - 1)}
                value={Math.min(playbackIndex, Math.max(0, selectedGuardPath.length - 1))}
                onChange={(event) => {
                  setPlaybackEnabled(false)
                  setPlaybackIndex(Number(event.target.value))
                }}
                className="w-44"
              />
            </label>
            <span className="text-xs text-text-tertiary">
              {selectedGuardPath.length > 0
                ? `Samples: ${selectedGuardPath.length}`
                : 'Select a guard to load movement trail'}
            </span>
          </div>
        </section>

        <section className="rounded-md border border-border-subtle bg-surface-elevated p-3" aria-label="Geofence transition feed">
          <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary">Geofence Alerts</h4>
          <ul className="mt-2 space-y-1 text-[11px] text-text-secondary">
            {geofenceFeed.length === 0 ? (
              <li className="text-text-tertiary">No recent enter or exit alerts.</li>
            ) : (
              geofenceFeed.map((alert) => (
                <li key={alert.id} className="rounded-md border border-border-subtle bg-background px-2 py-1">
                  <div className="font-semibold text-text-primary">{alert.guardName || alert.guardId} {alert.eventType === 'enter' ? 'entered' : 'exited'} {alert.siteName}</div>
                  <div className="text-text-tertiary">{new Date(alert.createdAt).toLocaleString()}</div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-surface-elevated px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-success" aria-hidden="true" /> Guard active</span>
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-warning" aria-hidden="true" /> Guard stale</span>
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-danger" aria-hidden="true" /> Guard offline</span>
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-info" aria-hidden="true" /> Vehicle</span>
        <span className="inline-flex items-center gap-1"><span className="status-light" aria-hidden="true" style={{ backgroundColor: '#7c3aed' }} /> Clustered units</span>
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-warning" aria-hidden="true" /> Client site radius</span>
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-danger" aria-hidden="true" /> Your location</span>
        <span className="w-full text-text-tertiary normal-case tracking-normal sm:ml-auto sm:w-auto">Dashed guard markers indicate unscheduled tracking visibility.</span>
      </div>

      {isElevatedUser ? (
        <div className="mt-4 rounded border border-border-subtle bg-surface-elevated p-3">
          <h4 className="text-sm font-bold uppercase tracking-wide text-text-primary">Client Location Manager</h4>
          <p className="mt-1 text-xs text-text-tertiary">Add, edit, or delete client locations shown on the operational map.</p>

          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMapPickMode(editingSiteId ? 'edit' : 'add')}
                className="min-h-11 rounded-md border border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
              >
                {editingSiteId ? 'Pick New Position On Map' : 'Pick Position On Map'}
              </button>
              {mapPickMode !== 'idle' ? (
                <span className="inline-flex items-center rounded-md bg-info-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-info-text">
                  Click anywhere on the map to set coordinates
                </span>
              ) : null}
            </div>

            <input
              id="client-site-name"
              name="clientSiteName"
              type="text"
              value={siteForm.name}
              onChange={(e) => setSiteForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Client location name"
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              aria-label="Client location name"
            />
            <input
              id="client-site-address"
              name="clientSiteAddress"
              type="text"
              value={siteForm.address || ''}
              onChange={(e) => setSiteForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Address"
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              aria-label="Client location address"
            />
            <input
              id="client-site-latitude"
              name="clientSiteLatitude"
              type="number"
              value={siteForm.latitude}
              onChange={(e) => setSiteForm((prev) => ({ ...prev, latitude: Number(e.target.value) }))}
              placeholder="Latitude"
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              aria-label="Client location latitude"
              step="any"
            />
            <input
              id="client-site-longitude"
              name="clientSiteLongitude"
              type="number"
              value={siteForm.longitude}
              onChange={(e) => setSiteForm((prev) => ({ ...prev, longitude: Number(e.target.value) }))}
              placeholder="Longitude"
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
              aria-label="Client location longitude"
              step="any"
            />
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-md bg-info-bg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-info-text"
              >
                {saving ? 'Saving...' : editingSiteId ? 'Update Site' : 'Add Site'}
              </button>
              {editingSiteId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSiteId('')
                    setMapPickMode('idle')
                    setSiteForm(INITIAL_FORM)
                    setFormError('')
                  }}
                  className="min-h-11 rounded-md border border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>

          {formError ? <p className="mt-2 text-xs text-danger-text">{formError}</p> : null}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-text-tertiary">
                  <th className="px-2 py-2 text-left">Site</th>
                  <th className="px-2 py-2 text-left">Latitude</th>
                  <th className="px-2 py-2 text-left">Longitude</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clientSites.map((site) => (
                  <tr key={site.id} className="border-b border-border-subtle text-text-primary">
                    <td className="px-2 py-2" title={site.address || site.name}>{site.name}</td>
                    <td className="px-2 py-2">{site.latitude.toFixed(5)}</td>
                    <td className="px-2 py-2">{site.longitude.toFixed(5)}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleEdit(site.id)}
                        className="mr-2 min-h-11 rounded-md border border-border-subtle px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-text-secondary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(site.id)
                        }}
                        className="min-h-11 rounded-md bg-danger-bg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-danger-text"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default OperationalMapPanel
