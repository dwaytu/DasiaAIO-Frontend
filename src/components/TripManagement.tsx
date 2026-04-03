import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

interface Trip {
  id: string
  car_id?: string
  driver_id?: string
  start_time?: string
  end_time?: string
  destination?: string
  status?: string
  vehicle_model?: string
  vehicle_plate?: string
  driver_name?: string
  driver_phone?: string
}

interface TripDetails extends Trip {
  guards: Array<{
    id: string
    name?: string
    username: string
  }>
  firearms: Array<{
    id: string
    name?: string
    model?: string
    serial_number?: string
  }>
  guard_count: number
  firearm_count: number
}

const TripManagement: FC = () => {
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTrip, setSelectedTrip] = useState<TripDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchActiveTrips()
    const interval = setInterval(fetchActiveTrips, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchActiveTrips = async () => {
    try {
      const data = await fetchJsonOrThrow<{ trips?: Trip[] }>(`${API_BASE_URL}/api/trip-management/active`, {
        headers: getAuthHeaders()
      }, 'Failed to fetch trips')

      setTrips(data.trips || [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trips')
    } finally {
      setLoading(false)
    }
  }

  const fetchTripDetails = async (tripId: string) => {
    try {
      const data = await fetchJsonOrThrow<any>(`${API_BASE_URL}/api/trip-management/${tripId}`, {
        headers: getAuthHeaders()
      }, 'Failed to fetch trip details')

      setSelectedTrip({
        ...data.trip,
        guards: data.guards,
        firearms: data.firearms,
        guard_count: data.guard_count,
        firearm_count: data.firearm_count
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip details')
    }
  }

  const updateTripStatus = async (tripId: string, status: string) => {
    try {
      await fetchJsonOrThrow(`${API_BASE_URL}/api/trip-management/${tripId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status })
      }, 'Failed to update trip status')
      
      await fetchActiveTrips()
      if (selectedTrip && selectedTrip.id === tripId) {
        await fetchTripDetails(tripId)
      }
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trip status')
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
      case 'in_progress':
        return 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
      case 'scheduled':
        return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
      default:
        return 'bg-surface-hover text-text-primary'
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-text-secondary font-medium">Loading trips...</div>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="soc-alert-error text-sm">
          <p className="font-semibold">Failed to load trips</p>
          <p>{error}</p>
          <p className="text-xs mt-2">Make sure the backend server is running on port 5000</p>
          <button 
            onClick={() => fetchActiveTrips()}
            className="soc-btn soc-btn-danger mt-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* Active Trips */}
      <section className="table-glass rounded-xl p-6">
        <h2 className="mb-6 text-2xl font-bold uppercase tracking-wide text-text-primary">Active Trips</h2>
        {trips.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-full">
              <thead className="thead-glass">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Destination</th>
                  <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Driver</th>
                  <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Start Time</th>
                  <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip.id} className="border-b border-border hover:bg-surface-hover">
                    <td className="px-4 py-3 text-text-primary font-medium">{trip.destination || 'N/A'}</td>
                    <td className="px-4 py-3 text-text-primary">
                      <div>{trip.vehicle_model || 'N/A'}</div>
                      <div className="text-xs text-text-tertiary">{trip.vehicle_plate}</div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      <div>{trip.driver_name || 'N/A'}</div>
                      <div className="text-xs text-text-tertiary">{trip.driver_phone}</div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {trip.start_time ? new Date(trip.start_time).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(trip.status)}`}>
                        {trip.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      <button
                        onClick={() => fetchTripDetails(trip.id)}
                        className="soc-btn"
                      >
                        Details
                      </button>
                      {trip.status === 'scheduled' && (
                        <button
                          onClick={() => updateTripStatus(trip.id, 'in_progress')}
                          className="soc-btn"
                        >
                          Start
                        </button>
                      )}
                      {trip.status === 'in_progress' && (
                        <button
                          onClick={() => updateTripStatus(trip.id, 'completed')}
                          className="soc-btn soc-btn-success"
                        >
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-text-secondary py-8 italic">No active trips</p>
        )}
      </section>

      {/* Trip Details Modal */}
      {selectedTrip && (
        <div className="soc-modal-backdrop" onClick={() => setSelectedTrip(null)}>
          <div className="soc-modal-panel command-panel mx-4 w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-xl font-bold uppercase tracking-wide text-text-primary">Trip Details</h2>
              <button 
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-3xl text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
                onClick={() => setSelectedTrip(null)}
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Trip Information */}
              <div className="bento-card">
                <h3 className="font-bold text-text-primary mb-3">Trip Information</h3>
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-text-secondary">Destination:</p>
                    <p className="font-medium text-text-primary">{selectedTrip.destination || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary">Status:</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedTrip.status)}`}>
                      {selectedTrip.status || 'unknown'}
                    </span>
                  </div>
                  <div>
                    <p className="text-text-secondary">Start Time:</p>
                    <p className="font-medium text-text-primary">
                      {selectedTrip.start_time ? new Date(selectedTrip.start_time).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary">End Time:</p>
                    <p className="font-medium text-text-primary">
                      {selectedTrip.end_time ? new Date(selectedTrip.end_time).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary">Vehicle:</p>
                    <p className="font-medium text-text-primary">{selectedTrip.vehicle_model || 'N/A'}</p>
                    <p className="text-xs text-text-tertiary">{selectedTrip.vehicle_plate}</p>
                  </div>
                  <div>
                    <p className="text-text-secondary">Driver:</p>
                    <p className="font-medium text-text-primary">{selectedTrip.driver_name || 'N/A'}</p>
                    <p className="text-xs text-text-tertiary">{selectedTrip.driver_phone}</p>
                  </div>
                </div>
              </div>

              {/* Assigned Guards */}
              <div>
                <h3 className="font-bold text-text-primary mb-3">Assigned Guards ({selectedTrip.guard_count})</h3>
                {selectedTrip.guards.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTrip.guards.map((guard) => (
                      <div key={guard.id} className="flex items-center justify-between bg-info-bg p-3 rounded-lg border border-info-border">
                        <div>
                          <p className="font-medium text-text-primary">{guard.name || guard.username}</p>
                          <p className="text-xs text-text-secondary">@{guard.username}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm">No guards assigned</p>
                )}
              </div>

              {/* Allocated Firearms */}
              <div>
                <h3 className="font-bold text-text-primary mb-3">Allocated Firearms ({selectedTrip.firearm_count})</h3>
                {selectedTrip.firearms.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTrip.firearms.map((firearm) => (
                      <div key={firearm.id} className="flex items-center justify-between bg-warning-bg p-3 rounded-lg border border-warning-border">
                        <div>
                          <p className="font-medium text-text-primary">{firearm.model || 'Unknown Model'} - {firearm.name}</p>
                          <p className="text-xs text-text-secondary">SN: {firearm.serial_number || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm">No firearms allocated</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                {selectedTrip.status === 'scheduled' && (
                  <button
                    onClick={() => {
                      updateTripStatus(selectedTrip.id, 'in_progress')
                      setSelectedTrip(null)
                    }}
                    className="soc-btn flex-1"
                  >
                    Start Trip
                  </button>
                )}
                {selectedTrip.status === 'in_progress' && (
                  <button
                    onClick={() => {
                      updateTripStatus(selectedTrip.id, 'completed')
                      setSelectedTrip(null)
                    }}
                    className="soc-btn soc-btn-success flex-1"
                  >
                    Complete Trip
                  </button>
                )}
                <button
                  onClick={() => setSelectedTrip(null)}
                  className="soc-btn soc-btn-neutral flex-1"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TripManagement

