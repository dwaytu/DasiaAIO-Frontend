import { FC, FormEvent, Fragment, useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { ClientSiteInput, useOperationalMapData } from '../../hooks/useOperationalMapData'
import { getPersonRecencyMinutes, getTrackingAccuracyMode, getVehicleRecencyMinutes } from '../../utils/trackingPolicy'

interface OperationalMapPanelProps {
  activeTrips: number
  activeGuards: number
}

const DAVAO_CENTER: [number, number] = [7.0731, 125.6128]

const INITIAL_FORM: ClientSiteInput = {
  name: '',
  address: '',
  latitude: DAVAO_CENTER[0],
  longitude: DAVAO_CENTER[1],
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

const currentUserPin = L.divIcon({
  className: 'current-user-pin',
  html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#dc2626;border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(220,38,38,0.35)"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const OperationalMapPanel: FC<OperationalMapPanelProps> = ({ activeTrips, activeGuards }) => {
  const {
    clientSites,
    trackingPoints,
    loading,
    error,
    lastUpdated,
    createClientSite,
    updateClientSite,
    deleteClientSite,
    isElevatedUser,
  } = useOperationalMapData()
  const [siteForm, setSiteForm] = useState<ClientSiteInput>(INITIAL_FORM)
  const [editingSiteId, setEditingSiteId] = useState<string>('')
  const [mapPickMode, setMapPickMode] = useState<'idle' | 'add' | 'edit'>('idle')
  const [saving, setSaving] = useState<boolean>(false)
  const [formError, setFormError] = useState<string>('')
  const trackingMode = getTrackingAccuracyMode()
  const personRecencyMinutes = getPersonRecencyMinutes(trackingMode)
  const vehicleRecencyMinutes = getVehicleRecencyMinutes(trackingMode)

  const isPointStale = (point: { entityType: string; recordedAt: string }) => {
    const recorded = new Date(point.recordedAt).getTime()
    if (Number.isNaN(recorded)) return true
    const ageMinutes = (Date.now() - recorded) / 60000
    const maxAge = point.entityType === 'vehicle' ? vehicleRecencyMinutes : personRecencyMinutes
    return ageMinutes > maxAge
  }

  const visibleTrackingPoints = useMemo(
    () => trackingPoints.filter((point) => !isPointStale(point)),
    [trackingPoints],
  )

  const stalePointCount = trackingPoints.length - visibleTrackingPoints.length

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

  const currentUserPoint = useMemo(() => {
    if (!currentUserId) return null
    return (
      visibleTrackingPoints
        .filter((point) => point.entityId === currentUserId)
        .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())[0] || null
    )
  }, [visibleTrackingPoints, currentUserId])

  const mapCenter = useMemo<[number, number]>(() => {
    if (!currentUserPoint) return DAVAO_CENTER
    return [currentUserPoint.latitude, currentUserPoint.longitude]
  }, [currentUserPoint?.latitude, currentUserPoint?.longitude])

  const bounds = useMemo(() => {
    const positions: [number, number][] = []

    for (const site of clientSites) {
      positions.push([site.latitude, site.longitude])
    }

    for (const point of visibleTrackingPoints) {
      positions.push([point.latitude, point.longitude])
    }

    return positions.length > 0 ? positions : [DAVAO_CENTER]
  }, [clientSites, visibleTrackingPoints])

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

  return (
    <section className="command-panel p-4 md:p-5" aria-label="Operational map">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
        <div>
          <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">Operational Map</h3>
          <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">OpenStreetMap live field tracking</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isElevatedUser ? (
            <button
              type="button"
              onClick={() => {
                setEditingSiteId('')
                setMapPickMode('add')
                setFormError('')
              }}
              className="rounded-md border border-info-border bg-info-bg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-info-text"
              aria-label="Add a new client location on the map"
            >
              + Add Client Site
            </button>
          ) : null}
          <p className="text-xs text-text-tertiary">{lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for first sync'}</p>
        </div>
      </div>

      <div className="relative h-72 overflow-hidden rounded-xl border border-border-elevated bg-surface">
        <MapContainer
          center={mapCenter}
          zoom={12}
          className="h-full w-full"
          scrollWheelZoom
          bounds={bounds}
          aria-label="Live operations map with guard, vehicle, and client site markers"
        >
          <MapViewportSync center={mapCenter} />
          <MapClickPicker enabled={isElevatedUser && mapPickMode !== 'idle'} onPick={handleMapPick} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {clientSites.map((site) => (
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
          ))}

          {visibleTrackingPoints.map((point) => {
            const isCurrentUser = currentUserId && point.entityId === currentUserId
            const tone = point.entityType === 'vehicle'
              ? { color: '#2563eb', fillColor: '#2563eb' }
              : { color: '#16a34a', fillColor: '#16a34a' }
            const pointAgeSeconds = Math.max(0, Math.floor((Date.now() - new Date(point.recordedAt).getTime()) / 1000))
            const sourceLabel = point.entityType === 'vehicle' ? 'Vehicle telemetry' : 'Device geolocation'

            if (isCurrentUser) {
              return (
                <Marker key={`track-user-pin-${point.id}`} position={[point.latitude, point.longitude]} icon={currentUserPin}>
                  <Popup>
                    <strong>Your Location</strong>
                    <div>{point.label || point.entityId}</div>
                    {point.status ? <div>Status: {point.status}</div> : null}
                    <div>Source: {sourceLabel}</div>
                    {point.accuracyMeters != null ? <div>Accuracy: {Math.round(point.accuracyMeters)} m</div> : null}
                    <div>Updated: {pointAgeSeconds}s ago</div>
                    <div>{new Date(point.recordedAt).toLocaleString()}</div>
                  </Popup>
                </Marker>
              )
            }

            return (
              <CircleMarker
                key={`track-${point.id}`}
                center={[point.latitude, point.longitude]}
                radius={6}
                pathOptions={{
                  color: tone.color,
                  fillColor: tone.fillColor,
                  fillOpacity: 0.8,
                }}
              >
                <Popup>
                  <strong>{point.entityType === 'vehicle' ? 'Armored Vehicle' : 'Guard'}</strong>
                  <div>{point.label || point.entityId}</div>
                  {point.status ? <div>Status: {point.status}</div> : null}
                  <div>Source: {sourceLabel}</div>
                  {point.speedKph != null ? <div>Speed: {point.speedKph.toFixed(1)} km/h</div> : null}
                  {point.accuracyMeters != null ? <div>Accuracy: {Math.round(point.accuracyMeters)} m</div> : null}
                  {point.accuracyMeters != null && point.accuracyMeters > 60 ? (
                    <div className="font-semibold text-warning-text">Low GPS precision</div>
                  ) : null}
                  <div>Updated: {pointAgeSeconds}s ago</div>
                  <div>{new Date(point.recordedAt).toLocaleString()}</div>
                </Popup>
              </CircleMarker>
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
          <div className="absolute inset-0 grid place-items-center bg-black/25 text-sm font-semibold text-white">Loading map telemetry...</div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
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
          <p className="text-xl font-black text-text-primary">{visibleTrackingPoints.length}</p>
          {stalePointCount > 0 ? <p className="text-[11px] text-text-tertiary">{stalePointCount} stale hidden</p> : null}
        </div>
        <div className="rounded-md border border-info-border bg-info-bg px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Client Sites</p>
          <p className="text-xl font-black text-text-primary">{clientSites.length}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-surface-elevated px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-success" aria-hidden="true" /> Guard</span>
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-info" aria-hidden="true" /> Vehicle</span>
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-warning" aria-hidden="true" /> Client Site Radius</span>
        <span className="inline-flex items-center gap-1"><span className="status-light status-light-danger" aria-hidden="true" /> Your location</span>
        <span className="ml-auto text-text-tertiary normal-case tracking-normal">Tip: drag to pan, scroll to zoom, click markers for details</span>
      </div>

      {error ? <p className="mt-3 text-xs text-danger-text">{error}</p> : null}

      {isElevatedUser ? (
        <div className="mt-4 rounded-lg border border-border-subtle bg-surface-elevated p-3">
          <h4 className="text-sm font-bold uppercase tracking-wide text-text-primary">Client Location Manager</h4>
          <p className="mt-1 text-xs text-text-tertiary">Add, edit, or delete client locations shown on the operational map.</p>

          <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMapPickMode(editingSiteId ? 'edit' : 'add')}
                className="rounded-md border border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
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
                className="rounded-md bg-info-bg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-info-text"
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
                  className="rounded-md border border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
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
                        className="mr-2 rounded-md border border-border-subtle px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(site.id)}
                        className="rounded-md bg-danger-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-danger-text"
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
