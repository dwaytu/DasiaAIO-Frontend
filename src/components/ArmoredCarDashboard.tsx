import React, { useState, useEffect } from 'react'
import { CircleCheck, Navigation, Truck, Wrench } from 'lucide-react'
import type { User } from '../context/AuthContext'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { logError } from '../utils/logger'
import { Link } from 'react-router'
import { VEHICLE_MAINTENANCE_URL } from '../router/routes'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import { getSidebarNav } from '../config/navigation'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'

interface ArmoredCar {
  id: string
  license_plate: string
  plate_number?: string | null
  vin: string
  model: string
  manufacturer: string
  status: string
  registration_expiry?: string
  insurance_expiry?: string
  last_maintenance_date?: string
  mileage: number
  created_at: string
  updated_at: string
}

interface GuardOption {
  id: string
  full_name: string
}

interface DriverAssignment {
  id: string
  car_id: string
  vehicle_number: string
  guard_id: string
  guard_name?: string
  guard_number?: number
  assignment_date: string
  end_date?: string
  status: string
}

interface Trip {
  id: string
  car_id: string
  driver_id: string
  allocation_id?: string
  start_location: string
  end_location?: string
  start_time: string
  end_time?: string
  distance_km?: string
  status: string
  mission_details?: string
  created_at: string
  updated_at: string
  vehicle_number?: string | null
  driver_name?: string | null
  client_site_name?: string | null
}

interface ArmoredCarDashboardProps {
  user: User
  onLogout: () => void
  onViewChange: (view: string) => void
  activeView?: string
}

const ArmoredCarDashboard: React.FC<ArmoredCarDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'trips'>('inventory')
  const [cars, setCars] = useState<ArmoredCar[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [guards, setGuards] = useState<GuardOption[]>([])
  const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [readWarning, setReadWarning] = useState<string>('')
  const [writeBlockReason, setWriteBlockReason] = useState<string>('')
  const [selectedDriverByCar, setSelectedDriverByCar] = useState<Record<string, string>>({})
  const [driverActionCarId, setDriverActionCarId] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function loadInventory() {
      try {
        const inventory = await fetchJsonOrThrow<ArmoredCar[]>(
          `${API_BASE_URL}/api/armored-cars`,
          { headers: getAuthHeaders(), signal },
          'Failed to fetch cars',
        )
        if (!signal.aborted) setCars(inventory)
      } catch (err) {
        if (signal.aborted) return
        setError(err instanceof Error ? err.message : 'Failed to fetch cars')
        setReadWarning('Armored-car inventory is currently unavailable.')
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }

    void loadInventory()
    void fetchTrips(signal)
    void fetchGuards(signal)
    void fetchDriverAssignments(signal)
    return () => controller.abort()
  }, [])

  const fetchGuards = async (signal?: AbortSignal) => {
    try {
      const data = await fetchJsonOrThrow<GuardOption[]>(
        `${API_BASE_URL}/api/guards`,
        { headers: getAuthHeaders(), signal },
        'Failed to fetch guards',
      )
      if (!signal?.aborted) setGuards(data)
    } catch (err) {
      if (!signal?.aborted) logError('Failed to fetch guards:', err)
    }
  }

  const fetchDriverAssignments = async (signal?: AbortSignal) => {
    try {
      const data = await fetchJsonOrThrow<DriverAssignment[]>(
        `${API_BASE_URL}/api/driver-assignments`,
        { headers: getAuthHeaders(), signal },
        'Failed to fetch vehicle drivers',
      )
      if (!signal?.aborted) setDriverAssignments(data)
    } catch (err) {
      if (!signal?.aborted) logError('Failed to fetch vehicle drivers:', err)
    }
  }

  const assignDriver = async (carId: string) => {
    const guardId = selectedDriverByCar[carId]
    if (!guardId) {
      setError('Choose a guard before assigning a driver.')
      return
    }

    setDriverActionCarId(carId)
    setError('')
    setWriteBlockReason('')
    try {
      await fetchJsonOrThrow<{ message: string }>(
        `${API_BASE_URL}/api/driver-assignment/assign`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ carId, guardId }),
        },
        'Failed to assign driver',
      )
      setSuccess('Driver assigned. The guard location will appear as the vehicle on the map.')
      setSelectedDriverByCar((previous) => ({ ...previous, [carId]: '' }))
      await fetchDriverAssignments()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign driver'
      setWriteBlockReason(message)
      setError(message)
    } finally {
      setDriverActionCarId('')
    }
  }

  const unassignDriver = async (assignment: DriverAssignment) => {
    setDriverActionCarId(assignment.car_id)
    setError('')
    setWriteBlockReason('')
    try {
      await fetchJsonOrThrow<{ message: string }>(
        `${API_BASE_URL}/api/driver-assignment/${assignment.id}/unassign`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        },
        'Failed to unassign driver',
      )
      setSuccess('Driver unassigned. The guard will appear as a guard again on the map.')
      await fetchDriverAssignments()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unassign driver'
      setWriteBlockReason(message)
      setError(message)
    } finally {
      setDriverActionCarId('')
    }
  }

  const fetchTrips = async (signal?: AbortSignal) => {
    try {
      const data = await fetchJsonOrThrow<Trip[]>(
        `${API_BASE_URL}/api/trips`,
        { headers: getAuthHeaders(), signal },
        'Failed to fetch trips'
      )
      if (!signal?.aborted) setTrips(data)
    } catch (err) {
      if (!signal?.aborted) logError('Failed to fetch trips:', err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'bg-success-bg text-success-text border-success-border'
      case 'allocated':
        return 'bg-info-bg text-info-text border-info-border'
      case 'maintenance':
        return 'bg-warning-bg text-warning-text border-warning-border'
      default:
        return 'bg-surface-elevated text-text-secondary border-border-elevated'
    }
  }


  const availableCars = cars.filter((c) => c.status === 'available').length
  const allocatedCars = cars.filter((c) => c.status === 'allocated').length
  const maintenanceCars = cars.filter((c) => c.status === 'maintenance').length
  const activeTrips = trips.filter((t) => t.status === 'in_transit').length

  return (
    <OperationalShell
      user={user}
      title="ARMORED CARS"
      navItems={getSidebarNav(user.role)}
      activeView={activeView || 'armored-cars'}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >

        {error && (
          <div className="soc-alert-error mx-8 my-4 font-medium flex items-center justify-between">
            <span>{error}</span>
            <button
              className="opacity-80 hover:opacity-100"
              onClick={() => setError('')}
            >
              ✕
            </button>
          </div>
        )}
        {success && (
          <div role="status" className="soc-alert-success mx-8 my-4 font-medium flex items-center justify-between">
            <span>{success}</span>
            <button
              className="opacity-80 hover:opacity-100"
              onClick={() => setSuccess('')}
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
          {readWarning ? (
            <div className="mb-4 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text">
              {readWarning}
            </div>
          ) : null}
          {writeBlockReason ? (
            <div className="mb-4 rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">
              Write blocked: {writeBlockReason}
            </div>
          ) : null}
          <section className="soc-surface mb-6 p-4 md:p-5">
            <OperationalPageHeader
              eyebrow="Fleet command"
              title="Armored Fleet Operations"
              description="Manage fleet readiness and drivers. Assign vehicles through Missions."
              icon={Truck}
              actions={<Link to={VEHICLE_MAINTENANCE_URL} className="soc-btn inline-flex min-h-11 items-center gap-2"><Wrench size={16} aria-hidden="true" /> Vehicle maintenance</Link>}
            />

            <div className="mt-4">
              <OperationalSummaryBand
                items={[
                  { label: 'Fleet total', value: cars.length, detail: 'Registered vehicles', tone: 'info', icon: Truck },
                  { label: 'Available', value: availableCars, detail: 'Ready for assignment', tone: 'success', icon: CircleCheck },
                  { label: 'Assigned', value: allocatedCars, tone: 'info', icon: Navigation },
                  { label: 'Maintenance', value: maintenanceCars, detail: 'Unavailable for assignment', tone: maintenanceCars > 0 ? 'warning' : 'neutral', icon: Wrench },
                  { label: 'Active trips', value: activeTrips, detail: 'Currently in transit', tone: activeTrips > 0 ? 'info' : 'neutral', icon: Navigation },
                ]}
              />
            </div>
          </section>

          {/* Tabs */}
          <div className="mb-6 flex flex-wrap gap-2 rounded border border-border-subtle bg-surface p-2">
            {(['inventory', 'trips'] as const).map((tab) => (
              <button
                key={tab}
                className={`rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wide whitespace-nowrap transition-all duration-300 ${
                  activeTab === tab
                    ? 'bg-(--color-info-bg) text-(--color-info-text) border border-(--color-info-border)'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'inventory' && 'Vehicle Inventory'}
                {tab === 'trips' && 'Trips'}
              </button>
            ))}
          </div>

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div>
              {/* Vehicle Inventory */}
              <div className="table-glass rounded p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 md:mb-6 pb-3 border-b border-border">Vehicle Inventory</h2>
                {loading ? (
                  <LoadingSkeleton variant="table" />
                ) : cars.length === 0 ? (
                  <EmptyState icon={Truck} title="No vehicles in fleet" subtitle="Use the Management panel to register vehicles" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="h-11 border-b border-border-subtle bg-surface-elevated/50 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                        <tr>
                          <th className="px-4 py-3.5 text-left">A/C number</th>
                          <th className="px-4 py-3.5 text-left">Plate number</th>
                          <th className="px-4 py-3.5 text-left">Driver</th>
                          <th className="px-4 py-3.5 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cars.map((car) => (
                          <tr key={car.id} className="border-b border-border-subtle/80 transition-colors hover:bg-surface-hover/50">
                            <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{car.license_plate}</td>
                            <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{car.plate_number || 'Not provided'}</td>
                            <td className="px-4 py-3.5 align-middle text-sm text-text-primary">
                              {(() => {
                                const assignment = driverAssignments.find((item) => item.car_id === car.id)
                                const isSaving = driverActionCarId === car.id

                                if (assignment) {
                                  return (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span>{assignment.guard_name || 'Assigned guard'}</span>
                                      <button
                                        type="button"
                                        className="rounded border border-danger-border px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-danger-text hover:bg-danger-bg disabled:opacity-60"
                                        onClick={() => unassignDriver(assignment)}
                                        disabled={isSaving}
                                      >
                                        {isSaving ? 'Saving...' : 'Unassign'}
                                      </button>
                                    </div>
                                  )
                                }

                                return (
                                  <div className="flex items-center gap-2">
                                    <select
                                      aria-label={`Choose driver for ${car.license_plate}`}
                                      value={selectedDriverByCar[car.id] || ''}
                                      onChange={(event) => setSelectedDriverByCar((previous) => ({ ...previous, [car.id]: event.target.value }))}
                                      className="h-9 min-w-44 rounded-md border border-border-subtle bg-surface px-2.5 text-xs text-text-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                                      disabled={isSaving}
                                    >
                                      <option value="">Choose guard...</option>
                                      {guards.map((guard) => (
                                        <option key={guard.id} value={guard.id}>
                                          {guard.full_name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="soc-btn soc-btn-secondary h-9 px-3 text-xs font-semibold"
                                      onClick={() => assignDriver(car.id)}
                                      disabled={isSaving || !selectedDriverByCar[car.id]}
                                    >
                                      {isSaving ? 'Saving...' : 'Assign'}
                                    </button>
                                  </div>
                                )
                              })()}
                            </td>
                            <td className="px-4 py-3.5 align-middle text-sm text-text-primary">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusColor(car.status)}`}>
                                {car.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trips Tab */}
          {activeTab === 'trips' && (
            <div className="table-glass rounded p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 md:mb-6 pb-3 border-b border-border">Trip History</h2>
              {trips.length === 0 ? (
                <div className="text-center py-8 text-text-secondary text-sm md:text-base">No trips recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="h-11 border-b border-border-subtle bg-surface-elevated/50 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      <tr>
                        <th className="px-4 py-3.5 text-left">Vehicle</th>
                        <th className="hidden px-4 py-3.5 text-left sm:table-cell">Assigned bank</th>
                        <th className="hidden px-4 py-3.5 text-left md:table-cell">Driver</th>
                        <th className="hidden px-4 py-3.5 text-left lg:table-cell">Dispatch</th>
                        <th className="hidden px-4 py-3.5 text-left lg:table-cell">Return</th>
                        <th className="px-4 py-3.5 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map((trip) => (
                      <tr key={trip.id} className="border-b border-border-subtle/80 transition-colors hover:bg-surface-hover/50">
                        <td className="px-4 py-3.5 align-middle text-sm text-text-primary">{trip.vehicle_number || trip.car_id}</td>
                        <td className="hidden px-4 py-3.5 align-middle text-sm text-text-primary sm:table-cell">{trip.client_site_name || 'Not recorded'}</td>
                        <td className="hidden px-4 py-3.5 align-middle text-sm text-text-primary md:table-cell">{trip.driver_name || 'Not recorded'}</td>
                        <td className="hidden px-4 py-3.5 align-middle text-sm text-text-primary lg:table-cell">{trip.start_time ? new Date(trip.start_time).toLocaleString() : 'Not recorded'}</td>
                        <td className="hidden px-4 py-3.5 align-middle text-sm text-text-primary lg:table-cell">{trip.end_time ? new Date(trip.end_time).toLocaleString() : 'In transit'}</td>
                        <td className="px-4 py-3.5 align-middle text-sm text-text-primary">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusColor(trip.status)}`}>
                              {trip.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
    </OperationalShell>
  )
}

export default ArmoredCarDashboard
