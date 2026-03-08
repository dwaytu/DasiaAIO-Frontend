import React, { useState, useEffect } from 'react'
import { User } from '../App'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, parseResponseBody } from '../utils/api'
import Sidebar from './Sidebar'
import Header from './Header'

interface ArmoredCar {
  id: string
  license_plate: string
  vin: string
  model: string
  manufacturer: string
  capacity_kg: number
  passenger_capacity?: number
  status: string
  registration_expiry?: string
  insurance_expiry?: string
  last_maintenance_date?: string
  mileage: number
  created_at: string
  updated_at: string
}

interface CarAllocation {
  id: string
  car_id: string
  client_id: string
  allocation_date: string
  return_date?: string
  expected_return_date?: string
  status: string
  notes?: string
  created_at: string
  updated_at: string
}

interface CarMaintenance {
  id: string
  car_id: string
  maintenance_type: string
  description: string
  cost?: string
  scheduled_date?: string
  completion_date?: string
  status: string
  notes?: string
  created_at: string
  updated_at: string
}

// interface DriverAssignment {
//   id: string
//   car_id: string
//   guard_id: string
//   assignment_date: string
//   end_date?: string
//   status: string
//   created_at: string
//   updated_at: string
// }

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
}

interface ArmoredCarDashboardProps {
  user: User
  onLogout: () => void
  onViewChange: (view: string) => void
  activeView?: string
}

const ArmoredCarDashboard: React.FC<ArmoredCarDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [activeTab, setActiveTab] = useState<string>('inventory')
  const [cars, setCars] = useState<ArmoredCar[]>([])
  const [allocations, setAllocations] = useState<CarAllocation[]>([])
  const [maintenance, setMaintenance] = useState<CarMaintenance[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)

  // Form states
  const [newCar, setNewCar] = useState({
    licensePlate: '',
    vin: '',
    model: '',
    manufacturer: '',
    capacityKg: 0,
    passengerCapacity: 4,
  })

  const [newAllocation, setNewAllocation] = useState({
    car_id: '',
    client_id: '',
    expected_return_date: '',
    notes: '',
  })

  const [newMaintenance, setNewMaintenance] = useState({
    car_id: '',
    maintenance_type: '',
    description: '',
    scheduled_date: '',
    cost: '',
  })

  useEffect(() => {
    initializeData()
  }, [])

  const initializeData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      // Fetch cars first, since maintenance fetch depends on it
      const carsData = await fetchJsonOrThrow<ArmoredCar[]>(
        `${API_BASE_URL}/api/armored-cars`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Failed to fetch cars'
      )
      setCars(carsData)

      // Then fetch maintenance records for each car
      if (carsData.length > 0) {
        let allMaintenance: CarMaintenance[] = []
        for (const car of carsData) {
          const mainResponse = await fetch(`${API_BASE_URL}/api/car-maintenance/${car.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (mainResponse.ok) {
            const mainData = await parseResponseBody(mainResponse)
            // Extract records from the API response (handles both array and {value: []} format)
            const records = Array.isArray(mainData) ? mainData : (mainData.value || mainData)
            allMaintenance = [...allMaintenance, ...records]
          }
        }
        setMaintenance(allMaintenance)
      }

      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize data')
    } finally {
      setLoading(false)
    }

    // Fetch other data in parallel (non-blocking)
    fetchAllocations()
    fetchTrips()
  }

  const fetchAllocations = async () => {
    try {
      const token = localStorage.getItem('token')
      const data = await fetchJsonOrThrow<CarAllocation[]>(
        `${API_BASE_URL}/api/car-allocations/active`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Failed to fetch allocations'
      )
      setAllocations(data)
    } catch (err) {
      console.error('Failed to fetch allocations:', err)
    }
  }

  const fetchMaintenance = async () => {
    try {
      const token = localStorage.getItem('token')
      // Fetch maintenance for all cars
      for (const car of cars) {
        const response = await fetch(`${API_BASE_URL}/api/car-maintenance/${car.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await parseResponseBody(response)
          setMaintenance((prev) => [...prev, ...data])
        }
      }
    } catch (err) {
      console.error('Failed to fetch maintenance:', err)
    }
  }

  const fetchCars = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const data = await fetchJsonOrThrow<ArmoredCar[]>(
        `${API_BASE_URL}/api/armored-cars`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Failed to fetch cars'
      )
      setCars(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cars')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrips = async () => {
    try {
      const token = localStorage.getItem('token')
      const data = await fetchJsonOrThrow<Trip[]>(
        `${API_BASE_URL}/api/trips`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Failed to fetch trips'
      )
      setTrips(data)
    } catch (err) {
      console.error('Failed to fetch trips:', err)
    }
  }

  const addCar = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/armored-cars`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newCar),
      })
      if (!response.ok) throw new Error('Failed to add car')
      setSuccess('Armored car added successfully!')
      setNewCar({ licensePlate: '', vin: '', model: '', manufacturer: '', capacityKg: 0, passengerCapacity: 4 })
      fetchCars()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add car')
    } finally {
      setLoading(false)
    }
  }

  const issueAllocation = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/car-allocation/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          carId: newAllocation.car_id,
          clientId: newAllocation.client_id,
          expectedReturnDate: newAllocation.expected_return_date ? new Date(newAllocation.expected_return_date).toISOString() : null,
          notes: newAllocation.notes || null,
        }),
      })
      if (!response.ok) throw new Error('Failed to allocate car')
      setSuccess('Car allocated successfully!')
      setNewAllocation({ car_id: '', client_id: '', expected_return_date: '', notes: '' })
      fetchAllocations()
      fetchCars()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to allocate car')
    } finally {
      setLoading(false)
    }
  }

  const scheduleMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/car-maintenance/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          carId: newMaintenance.car_id,
          maintenanceType: newMaintenance.maintenance_type,
          description: newMaintenance.description,
          scheduledDate: newMaintenance.scheduled_date ? new Date(newMaintenance.scheduled_date).toISOString() : null,
          cost: newMaintenance.cost || null,
        }),
      })
      if (!response.ok) throw new Error('Failed to schedule maintenance')
      setSuccess('Maintenance scheduled successfully!')
      setNewMaintenance({ car_id: '', maintenance_type: '', description: '', scheduled_date: '', cost: '' })
      fetchMaintenance()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule maintenance')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    return `status-${status.toLowerCase()}`
  }

  const currentView = activeView || 'armored-cars'
  const navItems = [
    { view: 'dashboard', label: 'Dashboard', group: 'MAIN MENU' },
    { view: 'approvals', label: 'Approvals', group: 'MAIN MENU' },
    { view: 'calendar', label: 'Calendar', group: 'MAIN MENU' },
    { view: 'analytics', label: 'Analytics', group: 'MAIN MENU' },
    { view: 'trips', label: 'Trip Management', group: 'OPERATIONS' },
    { view: 'schedule', label: 'Schedule', group: 'OPERATIONS' },
    { view: 'missions', label: 'Missions', group: 'OPERATIONS' },
    { view: 'performance', label: 'Performance', group: 'OPERATIONS' },
    { view: 'merit', label: 'Merit Scores', group: 'OPERATIONS' },
    { view: 'firearms', label: 'Firearms', group: 'RESOURCES' },
    { view: 'allocation', label: 'Allocation', group: 'RESOURCES' },
    { view: 'permits', label: 'Permits', group: 'RESOURCES' },
    { view: 'maintenance', label: 'Maintenance', group: 'RESOURCES' },
    { view: 'armored-cars', label: 'Armored Cars', group: 'RESOURCES' },
  ]
  const availableCars = cars.filter((c) => c.status === 'available').length
  const allocatedCars = cars.filter((c) => c.status === 'allocated').length
  const maintenanceCars = cars.filter((c) => c.status === 'maintenance').length
  const activeTrips = trips.filter((t) => t.status === 'in_transit').length

  return (
    <div className="flex h-screen w-screen bg-background font-sans">
      <Sidebar
        items={navItems}
        activeView={currentView}
        onNavigate={onViewChange}        onLogoClick={() => onViewChange?.('dashboard')}        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header title="Armored Car Management" badgeLabel="Armored Cars" onLogout={onLogout} onMenuClick={() => setMobileMenuOpen(true)} user={user} onNavigateToProfile={() => onViewChange('profile')} />

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
          <div className="soc-alert-success mx-8 my-4 font-medium flex items-center justify-between">
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
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            <div className="bento-card status-bar-info">
              <div className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Total Vehicles</div>
              <p className="text-4xl font-bold text-indigo-600">{cars.length}</p>
            </div>
            <div className="bento-card status-bar-success">
              <div className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Available</div>
              <p className="text-4xl font-bold text-green-600">{availableCars}</p>
            </div>
            <div className="bento-card status-bar-warning">
              <div className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Allocated</div>
              <p className="text-4xl font-bold text-amber-600">{allocatedCars}</p>
            </div>
            <div className="bento-card status-bar-critical">
              <div className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-2">In Maintenance</div>
              <p className="text-4xl font-bold text-red-600">{maintenanceCars}</p>
            </div>
            <div className="bento-card status-bar-info">
              <div className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Active Trips</div>
              <p className="text-4xl font-bold text-blue-600">{activeTrips}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-border bg-surface rounded-t-lg">
            {['inventory', 'allocation', 'maintenance', 'trips'].map((tab) => (
              <button
                key={tab}
                className={`px-6 py-3 font-semibold text-base whitespace-nowrap transition-all duration-300 ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'inventory' && 'Vehicle Inventory'}
                {tab === 'allocation' && 'Allocations'}
                {tab === 'maintenance' && 'Maintenance'}
                {tab === 'trips' && 'Trips'}
              </button>
            ))}
          </div>

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="grid grid-cols-2 gap-8">
              {/* Add New Vehicle Form */}
              <div className="command-panel p-6">
                <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 md:mb-6 pb-3 border-b border-border">Add New Armored Vehicle</h2>
                <form onSubmit={addCar} className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">License Plate</label>
                    <input
                      type="text"
                      value={newCar.licensePlate}
                      onChange={(e) => setNewCar({ ...newCar, licensePlate: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">VIN</label>
                    <input
                      type="text"
                      value={newCar.vin}
                      onChange={(e) => setNewCar({ ...newCar, vin: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Model</label>
                    <input
                      type="text"
                      value={newCar.model}
                      onChange={(e) => setNewCar({ ...newCar, model: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Manufacturer</label>
                    <input
                      type="text"
                      value={newCar.manufacturer}
                      onChange={(e) => setNewCar({ ...newCar, manufacturer: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Capacity (kg)</label>
                    <input
                      type="number"
                      value={newCar.capacityKg}
                      onChange={(e) => setNewCar({ ...newCar, capacityKg: parseInt(e.target.value) })}
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Passenger Capacity</label>
                    <input
                      type="number"
                      value={newCar.passengerCapacity}
                      onChange={(e) => setNewCar({ ...newCar, passengerCapacity: parseInt(e.target.value) || 4 })}
                      required
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-2 md:py-3 rounded-lg transition-colors text-sm md:text-base mt-4"
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : 'Add Vehicle'}
                  </button>
                </form>
              </div>

              {/* Vehicle Inventory */}
              <div className="table-glass rounded-lg p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 md:mb-6 pb-3 border-b border-border">Vehicle Inventory</h2>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : cars.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary text-sm md:text-base">No vehicles found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="thead-glass">
                        <tr>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider">License Plate</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider hidden sm:table-cell">Model</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider hidden md:table-cell">Capacity</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cars.map((car) => (
                          <tr key={car.id} className="border-b border-border hover:bg-surface-hover">
                            <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm">{car.license_plate}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm hidden sm:table-cell">{car.model}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm hidden md:table-cell">{car.capacity_kg} kg</td>
                            <td className="px-2 md:px-4 py-2 md:py-3">
                              <span className={`inline-block px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(car.status)}`}>
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

          {/* Allocation Tab */}
          {activeTab === 'allocation' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
              {/* Allocate Vehicle Form */}
              <div className="command-panel p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 md:mb-6 pb-3 border-b border-border">Allocate Vehicle</h2>
                <form onSubmit={issueAllocation} className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Select Vehicle</label>
                    <select
                      value={newAllocation.car_id}
                      onChange={(e) => setNewAllocation({ ...newAllocation, car_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface"
                    >
                      <option value="">Choose a vehicle...</option>
                      {cars
                        .filter((c) => c.status === 'available')
                        .map((car) => (
                          <option key={car.id} value={car.id}>
                            {car.license_plate} - {car.model}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Client</label>
                    <input
                      type="text"
                      value={newAllocation.client_id}
                      onChange={(e) => setNewAllocation({ ...newAllocation, client_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Expected Return Date</label>
                    <input
                      type="datetime-local"
                      value={newAllocation.expected_return_date}
                      onChange={(e) => setNewAllocation({ ...newAllocation, expected_return_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Notes</label>
                    <textarea
                      value={newAllocation.notes}
                      onChange={(e) => setNewAllocation({ ...newAllocation, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-2 md:py-3 rounded-lg transition-colors text-sm md:text-base mt-4"
                    disabled={loading}
                  >
                    {loading ? 'Allocating...' : 'Allocate Vehicle'}
                  </button>
                </form>
              </div>

              {/* Active Allocations */}
              <div className="table-glass rounded-lg p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 md:mb-6 pb-3 border-b border-border">Active Allocations</h2>
                {allocations.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary text-sm md:text-base">No active allocations</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="thead-glass">
                        <tr>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider">Vehicle</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider hidden sm:table-cell">Client</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider hidden md:table-cell">Alloc. Date</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocations.map((alloc) => (
                          <tr key={alloc.id} className="border-b border-border hover:bg-surface-hover">
                            <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm">{alloc.car_id}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm hidden sm:table-cell">{alloc.client_id}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm hidden md:table-cell">{new Date(alloc.allocation_date).toLocaleDateString()}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3">
                              <span className={`inline-block px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(alloc.status)}`}>
                                {alloc.status}
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

          {/* Maintenance Tab */}
          {activeTab === 'maintenance' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
              {/* Schedule Maintenance Form */}
              <div className="command-panel p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 md:mb-6 pb-3 border-b border-border">Schedule Maintenance</h2>
                <form onSubmit={scheduleMaintenance} className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Select Vehicle</label>
                    <select
                      value={newMaintenance.car_id}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, car_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface"
                    >
                      <option value="">Choose a vehicle...</option>
                      {cars.map((car) => (
                        <option key={car.id} value={car.id}>
                          {car.license_plate} - {car.model}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Maintenance Type</label>
                    <select
                      value={newMaintenance.maintenance_type}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, maintenance_type: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface"
                    >
                      <option value="">Select type...</option>
                      <option value="routine_service">Routine Service</option>
                      <option value="repairs">Repairs</option>
                      <option value="inspection">Inspection</option>
                      <option value="tire_replacement">Tire Replacement</option>
                      <option value="armor_check">Armor Check</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Description</label>
                    <textarea
                      value={newMaintenance.description}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
                      required
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Scheduled Date</label>
                    <input
                      type="datetime-local"
                      value={newMaintenance.scheduled_date}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduled_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-text-primary mb-1 md:mb-2">Cost ($)</label>
                    <input
                      type="number"
                      value={newMaintenance.cost}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, cost: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-2 md:py-3 rounded-lg transition-colors text-sm md:text-base mt-4"
                    disabled={loading}
                  >
                    {loading ? 'Scheduling...' : 'Schedule Maintenance'}
                  </button>
                </form>
              </div>

              {/* Maintenance Records */}
              <div className="table-glass rounded-lg p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 md:mb-6 pb-3 border-b border-border">Maintenance Records</h2>
                {maintenance.length === 0 ? (
                  <div className="text-center py-8 text-text-secondary text-sm md:text-base">No maintenance records</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="thead-glass">
                        <tr>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider">Vehicle</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider hidden sm:table-cell">Type</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider">Status</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider hidden md:table-cell">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maintenance.map((m) => (
                          <tr key={m.id} className="border-b border-border hover:bg-surface-hover">
                            <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm">{m.car_id}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm hidden sm:table-cell">{m.maintenance_type}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3">
                              <span className={`inline-block px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(m.status)}`}>
                                {m.status}
                              </span>
                            </td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm hidden md:table-cell">${m.cost || 'N/A'}</td>
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
            <div className="table-glass rounded-lg p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 md:mb-6 pb-3 border-b border-border">Trip History</h2>
              {trips.length === 0 ? (
                <div className="text-center py-8 text-text-secondary text-sm md:text-base">No trips recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider">Vehicle</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider hidden sm:table-cell">Start</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider hidden md:table-cell">End</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider">Distance</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-text-primary border-b-2 border-border text-xs md:text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map((trip) => (
                        <tr key={trip.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm">{trip.car_id}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm hidden sm:table-cell">{trip.start_location}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm hidden md:table-cell">{trip.end_location || 'In Transit'}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-text-primary text-xs md:text-sm">{trip.distance_km ? `${trip.distance_km} km` : 'N/A'}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3">
                            <span className={`inline-block px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(trip.status)}`}>
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
      </main>
    </div>
  )
}

export default ArmoredCarDashboard

