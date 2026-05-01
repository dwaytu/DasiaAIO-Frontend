import { FC, useEffect, useMemo } from 'react'
import { Circle, CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../../context/ThemeProvider'
import { getOperationalMapTileUrl } from './mapTileUrls'

interface LastKnownLocation {
  latitude: number
  longitude: number
  accuracyMeters: number | null
}

interface GuardMapLeafletProps {
  lastKnownLocation: LastKnownLocation | null
}

const TAGUM_CENTER: [number, number] = [7.4478, 125.8078]

interface MapViewportSyncProps {
  center: [number, number]
}

const MapViewportSync: FC<MapViewportSyncProps> = ({ center }) => {
  const map = useMap()

  useEffect(() => {
    const [lat, lng] = center
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    const current = map.getCenter()
    const centerChanged = Math.abs(current.lat - lat) > 0.0001 || Math.abs(current.lng - lng) > 0.0001
    if (!centerChanged) return

    map.stop()
    map.setView(center, Math.max(map.getZoom(), 13), { animate: false })
  }, [center, map])

  return null
}

const GuardMapLeaflet: FC<GuardMapLeafletProps> = ({ lastKnownLocation }) => {
  const { theme } = useTheme()
  const mapCenter = useMemo<[number, number]>(() => {
    if (!lastKnownLocation) return TAGUM_CENTER
    return [lastKnownLocation.latitude, lastKnownLocation.longitude]
  }, [lastKnownLocation])

  return (
    <MapContainer
      center={mapCenter}
      zoom={lastKnownLocation ? 16 : 14}
      className="h-[calc(100dvh-14rem)] w-full"
      scrollWheelZoom
      aria-label="Guard live location map"
    >
      <MapViewportSync center={mapCenter} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={getOperationalMapTileUrl(theme)}
      />
      {lastKnownLocation ? (
        <>
          <CircleMarker
            center={[lastKnownLocation.latitude, lastKnownLocation.longitude]}
            radius={9}
            pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.9, weight: 2 }}
          />
          {lastKnownLocation.accuracyMeters != null ? (
            <Circle
              center={[lastKnownLocation.latitude, lastKnownLocation.longitude]}
              radius={Math.max(10, Math.round(lastKnownLocation.accuracyMeters))}
              pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.15, weight: 1.5 }}
            />
          ) : null}
        </>
      ) : null}
    </MapContainer>
  )
}

export default GuardMapLeaflet
