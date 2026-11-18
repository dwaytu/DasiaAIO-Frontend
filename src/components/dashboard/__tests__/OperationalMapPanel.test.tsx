import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import OperationalMapPanel from '../OperationalMapPanel'
import { useOperationalMapData } from '../../../hooks/useOperationalMapData'

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {
    divIcon: jest.fn(() => ({})),
    latLngBounds: jest.fn(() => ({})),
  },
}))

jest.mock('react-leaflet', () => {
  const container = document.createElement('div')
  const map = {
    getCenter: () => ({ lat: 7.4478, lng: 125.8078 }),
    getZoom: () => 12,
    getContainer: () => container,
    stop: jest.fn(),
    setView: jest.fn(),
    fitBounds: jest.fn(),
    invalidateSize: jest.fn(),
  }

  return {
    MapContainer: ({ children, 'aria-label': ariaLabel, role }: PropsWithChildren<{ 'aria-label'?: string; role?: string }>) => <div aria-label={ariaLabel} role={role}>{children}</div>,
    TileLayer: () => null,
    Popup: ({ children }: PropsWithChildren) => <span>{children}</span>,
    Circle: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Polygon: () => null,
    Polyline: () => null,
    CircleMarker: ({ children, eventHandlers }: PropsWithChildren<{ eventHandlers?: { click?: () => void } }>) => (
      <button type="button" onClick={eventHandlers?.click}>{children}</button>
    ),
    Marker: ({ children, eventHandlers }: PropsWithChildren<{ eventHandlers?: { click?: () => void } }>) => (
      <button type="button" onClick={eventHandlers?.click}>{children}</button>
    ),
    useMap: () => map,
    useMapEvents: () => map,
  }
})

jest.mock('../../../hooks/useOperationalMapData', () => ({
  useOperationalMapData: jest.fn(),
}))

jest.mock('../../../utils/trackingPolicy', () => ({
  getTrackingAccuracyMode: () => 'balanced',
  getPersonRecencyMinutes: () => 5,
  getVehicleRecencyMinutes: () => 5,
}))

jest.mock('../mapTileUrls', () => ({
  getOperationalMapTileUrl: () => 'https://example.test/{z}/{x}/{y}.png',
}))

jest.mock('../../../context/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'dark' }),
}))

jest.mock('../../../context/OperationalEventContext', () => ({
  useOperationalEvent: () => ({ selectedEvent: null, clearSelection: jest.fn() }),
}))

const mockOperationalMapData = useOperationalMapData as jest.MockedFunction<typeof useOperationalMapData>

describe('OperationalMapPanel tactical layers and asset inspector', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    mockOperationalMapData.mockReturnValue({
      clientSites: [
        { id: 'site-1', name: 'Central Post', latitude: 7.44, longitude: 125.8, isActive: true },
        { id: 'site-2', name: 'North Post', latitude: 7.45, longitude: 125.81, isActive: true },
      ],
      trackingPoints: [
        {
          id: 'guard-point',
          entityType: 'guard',
          entityId: 'guard-1',
          label: 'Reysan Cabanag',
          latitude: 7.44,
          longitude: 125.8,
          accuracyMeters: 8,
          movementStatus: 'idle',
          heartbeatStatus: 'active',
          scheduleStatus: 'on-duty',
          scheduleClientSite: 'Central Post',
          scheduleStartTime: '08:00',
          scheduleEndTime: '20:00',
          recordedAt: new Date().toISOString(),
        },
        {
          id: 'vehicle-point',
          entityType: 'vehicle',
          entityId: 'vehicle-8',
          label: 'Unit V-8',
          latitude: 7.45,
          longitude: 125.81,
          accuracyMeters: 12,
          movementStatus: 'moving',
          heartbeatStatus: 'active',
          scheduleClientSite: 'North Post',
          scheduleStartTime: '06:00',
          scheduleEndTime: '18:00',
          speedKph: 18.5,
          source: 'vehicle-telemetry',
          recordedAt: new Date().toISOString(),
        },
      ],
      geofenceAlerts: [
        { id: 'alert-1', guardId: 'guard-1', eventType: 'exit', siteId: 'site-1', siteName: 'Central Post', createdAt: new Date().toISOString() },
      ],
      geofenceZones: [],
      loading: false,
      error: '',
      lastUpdated: 'just now',
      createClientSiteWithGeofence: jest.fn(),
      updateClientSite: jest.fn(),
      deleteClientSite: jest.fn(),
      createGeofenceZone: jest.fn(),
      updateGeofenceZone: jest.fn(),
      fetchGuardPath: jest.fn().mockResolvedValue([]),
      fetchActiveGuards: jest.fn(() => new Promise(() => undefined)),
      isElevatedUser: true,
      hasTrackingAccess: true,
    } as unknown as ReturnType<typeof useOperationalMapData>)
  })

  it('keeps real layer counts visible when operators hide a layer', async () => {
    const user = userEvent.setup()
    render(<OperationalMapPanel recentVehicleReports={1} recentGuardReports={1} />)

    expect(screen.getByRole('region', { name: 'Live operations map with guard, vehicle, and client site markers' })).toBeInTheDocument()

    const guardsLayer = screen.getByRole('button', { name: 'Guards (1) layer visible' })
    expect(guardsLayer).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vehicles (1) layer visible' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sites (2) layer visible' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alerts (1) layer visible' })).toBeInTheDocument()

    await user.click(guardsLayer)

    expect(screen.getByRole('button', { name: 'Guards (1) layer hidden' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByText(/Sites with Reporting Guards: 1 \/ 2/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Guards: 1 active · 0 stale · 0 offline/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/On-Site Verified/i)).not.toBeInTheDocument()
  })

  it('does not report coverage as available when live tracking access is unavailable', () => {
    mockOperationalMapData.mockReturnValue({
      clientSites: [], trackingPoints: [], geofenceAlerts: [], geofenceZones: [], loading: false, error: '', lastUpdated: '',
      createClientSiteWithGeofence: jest.fn(), updateClientSite: jest.fn(), deleteClientSite: jest.fn(), createGeofenceZone: jest.fn(), updateGeofenceZone: jest.fn(),
      fetchGuardPath: jest.fn().mockResolvedValue([]), fetchActiveGuards: jest.fn(() => new Promise(() => undefined)), isElevatedUser: false, hasTrackingAccess: false,
    } as unknown as ReturnType<typeof useOperationalMapData>)

    render(<OperationalMapPanel recentVehicleReports={0} recentGuardReports={0} />)

    expect(screen.getByText('Coverage unavailable')).toBeInTheDocument()
  })

  it('opens a truthful asset drawer and reveals schedule and activity details', async () => {
    const user = userEvent.setup()
    render(<OperationalMapPanel recentVehicleReports={1} recentGuardReports={1} />)

    await user.click(screen.getByRole('button', { name: /Armored Vehicle Unit V-8/i }))

    expect(screen.getByRole('heading', { name: 'Vehicle: Unit V-8' })).toBeInTheDocument()
    const inspector = screen.getByRole('complementary', { name: 'Vehicle: Unit V-8' })
    expect(within(inspector).getByText('North Post')).toBeInTheDocument()
    expect(within(inspector).getByText('±12 m')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View Schedule' }))
    expect(screen.getByRole('region', { name: 'Asset schedule details' })).toHaveTextContent('06:00 – 18:00')

    await user.click(screen.getByRole('button', { name: 'Inspect Activity' }))
    expect(screen.getByRole('region', { name: 'Asset activity details' })).toHaveTextContent('18.5 km/h')
  })

  it('places a degraded-data notice below the responsive layer controls', () => {
    mockOperationalMapData.mockReturnValue({
      clientSites: [],
      trackingPoints: [],
      geofenceAlerts: [],
      geofenceZones: [],
      loading: false,
      error: 'Tracking service is unavailable',
      lastUpdated: 'just now',
      createClientSiteWithGeofence: jest.fn(),
      updateClientSite: jest.fn(),
      deleteClientSite: jest.fn(),
      createGeofenceZone: jest.fn(),
      updateGeofenceZone: jest.fn(),
      fetchGuardPath: jest.fn().mockResolvedValue([]),
      fetchActiveGuards: jest.fn(() => new Promise(() => undefined)),
      isElevatedUser: true,
      hasTrackingAccess: true,
    } as unknown as ReturnType<typeof useOperationalMapData>)

    render(<OperationalMapPanel recentVehicleReports={0} recentGuardReports={0} />)

    expect(screen.getByRole('status').parentElement).toHaveClass('top-28', 'sm:top-16')
  })
})
