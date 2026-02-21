import React, { useState, useEffect } from 'react'
import { User } from '../App'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'

interface ArmoredCar {
  id: string
  license_plate: string
  vin: string
  model: string
  manufacturer: string
  capacity_kg: number
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

interface DriverAssignment {
  id: string
  car_id: string
  guard_id: string
  assignment_date: string
  end_date?: string
  status: string
  created_at: string
  updated_at: string
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
    license_plate: '',
    vin: '',
    model: '',
    manufacturer: '',
    capacity_kg: 0,
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
    fetchCars()
    fetchAllocations()
    fetchMaintenance()
    fetchTrips()
  }, [])

  const fetchCars = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/armored-cars`)
      if (!response.ok) throw new Error('Failed to fetch cars')
      const data = await response.json()
      setCars(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cars')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllocations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/car-allocations/active`)
      if (!response.ok) throw new Error('Failed to fetch allocations')
      const data = await response.json()
      setAllocations(data)
    } catch (err) {
      console.error('Failed to fetch allocations:', err)
    }
  }

  const fetchMaintenance = async () => {
    try {
      // Fetch maintenance for all cars
      for (const car of cars) {
        const response = await fetch(`${API_BASE_URL}/api/car-maintenance/${car.id}`)
        if (response.ok) {
          const data = await response.json()
          setMaintenance((prev) => [...prev, ...data])
        }
      }
    } catch (err) {
      console.error('Failed to fetch maintenance:', err)
    }
  }

  const fetchTrips = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/trips`)
      if (!response.ok) throw new Error('Failed to fetch trips')
      const data = await response.json()
      setTrips(data)
    } catch (err) {
      console.error('Failed to fetch trips:', err)
    }
  }

  const addCar = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/armored-cars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCar),
      })
      if (!response.ok) throw new Error('Failed to add car')
      setSuccess('Armored car added successfully!')
      setNewCar({ license_plate: '', vin: '', model: '', manufacturer: '', capacity_kg: 0 })
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
      const response = await fetch(`${API_BASE_URL}/api/car-allocation/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAllocation),
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
      const response = await fetch(`${API_BASE_URL}/api/car-maintenance/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMaintenance),
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
    { view: 'users', label: 'Dashboard' },
    { view: 'analytics', label: 'Analytics' },
    { view: 'trips', label: 'Trip Management' },
    { view: 'schedule', label: 'Schedule' },
    { view: 'missions', label: 'Missions' },
    { view: 'performance', label: 'Performance' },
    { view: 'firearms', label: 'Firearms' },
    { view: 'allocation', label: 'Allocation' },
    { view: 'permits', label: 'Permits' },
    { view: 'maintenance', label: 'Maintenance' },
    { view: 'armored-cars', label: 'Armored Cars' }
  ]
  const availableCars = cars.filter((c) => c.status === 'available').length
  const allocatedCars = cars.filter((c) => c.status === 'allocated').length
  const maintenanceCars = cars.filter((c) => c.status === 'maintenance').length
  const activeTrips = trips.filter((t) => t.status === 'in_transit').length

  return (
    <div className="flex min-h-screen w-screen bg-gray-100 font-sans">
      <Sidebar
        items={navItems}
        activeView={currentView}
        onNavigate={onViewChange}        onLogoClick={() => onViewChange?.('users')}        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header title="Armored Car Management" badgeLabel="Armored Cars" onLogout={onLogout} onMenuClick={() => setMobileMenuOpen(true)} user={user} onNavigateToProfile={() => onViewChange('profile')} />

        {error && (
          <div className="bg-red-50 text-red-900 px-8 py-3 border border-red-200 rounded mx-8 my-4 font-medium flex items-center justify-between">
            <span>{error}</span>
            <button
              className="text-red-900 hover:text-red-800"
              onClick={() => setError('')}
            >
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-900 px-8 py-3 border border-green-200 rounded mx-8 my-4 font-medium flex items-center justify-between">
            <span>{success}</span>
            <button
              className="text-green-900 hover:text-green-800"
              onClick={() => setSuccess('')}
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex-1 p-8 overflow-y-auto w-full animate-fade-in">
          {/* Stats Grid */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border-t-4 border-indigo-600 hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-6">
              <div className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-2">Total Vehicles</div>
              <p className="text-4xl font-bold text-indigo-600">{cars.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border-t-4 border-green-600 hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-6">
              <div className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-2">Available</div>
              <p className="text-4xl font-bold text-green-600">{availableCars}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border-t-4 border-amber-600 hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-6">
              <div className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-2">Allocated</div>
              <p className="text-4xl font-bold text-amber-600">{allocatedCars}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border-t-4 border-red-600 hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-6">
              <div className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-2">In Maintenance</div>
              <p className="text-4xl font-bold text-red-600">{maintenanceCars}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border-t-4 border-blue-600 hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-6">
              <div className="text-gray-600 text-sm font-semibold uppercase tracking-wider mb-2">Active Trips</div>
              <p className="text-4xl font-bold text-blue-600">{activeTrips}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-300 bg-white rounded-t-lg">
            {['inventory', 'allocation', 'maintenance', 'trips'].map((tab) => (
              <button
                key={tab}
                className={`px-6 py-3 font-semibold text-base whitespace-nowrap transition-all duration-300 ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px'
                    : 'text-gray-600 hover:text-gray-900'
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
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 pb-3 border-b border-gray-200">Add New Armored Vehicle</h2>
                <form onSubmit={addCar} className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">License Plate</label>
                    <input
                      type="text"
                      value={newCar.license_plate}
                      onChange={(e) => setNewCar({ ...newCar, license_plate: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">VIN</label>
                    <input
                      type="text"
                      value={newCar.vin}
                      onChange={(e) => setNewCar({ ...newCar, vin: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Model</label>
                    <input
                      type="text"
                      value={newCar.model}
                      onChange={(e) => setNewCar({ ...newCar, model: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Manufacturer</label>
                    <input
                      type="text"
                      value={newCar.manufacturer}
                      onChange={(e) => setNewCar({ ...newCar, manufacturer: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Capacity (kg)</label>
                    <input
                      type="number"
                      value={newCar.capacity_kg}
                      onChange={(e) => setNewCar({ ...newCar, capacity_kg: parseInt(e.target.value) })}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <div className="bg-white rounded-lg shadow p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 pb-3 border-b border-gray-200">Vehicle Inventory</h2>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : cars.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm md:text-base">No vehicles found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider">License Plate</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider hidden sm:table-cell">Model</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider hidden md:table-cell">Capacity</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cars.map((car) => (
                          <tr key={car.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm">{car.license_plate}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm hidden sm:table-cell">{car.model}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm hidden md:table-cell">{car.capacity_kg} kg</td>
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
              <div className="bg-white rounded-lg shadow p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 pb-3 border-b border-gray-200">Allocate Vehicle</h2>
                <form onSubmit={issueAllocation} className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Select Vehicle</label>
                    <select
                      value={newAllocation.car_id}
                      onChange={(e) => setNewAllocation({ ...newAllocation, car_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Client</label>
                    <input
                      type="text"
                      value={newAllocation.client_id}
                      onChange={(e) => setNewAllocation({ ...newAllocation, client_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Expected Return Date</label>
                    <input
                      type="datetime-local"
                      value={newAllocation.expected_return_date}
                      onChange={(e) => setNewAllocation({ ...newAllocation, expected_return_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Notes</label>
                    <textarea
                      value={newAllocation.notes}
                      onChange={(e) => setNewAllocation({ ...newAllocation, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <div className="bg-white rounded-lg shadow p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 pb-3 border-b border-gray-200">Active Allocations</h2>
                {allocations.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm md:text-base">No active allocations</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider">Vehicle</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider hidden sm:table-cell">Client</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider hidden md:table-cell">Alloc. Date</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocations.map((alloc) => (
                          <tr key={alloc.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm">{alloc.car_id}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm hidden sm:table-cell">{alloc.client_id}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm hidden md:table-cell">{new Date(alloc.allocation_date).toLocaleDateString()}</td>
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
              <div className="bg-white rounded-lg shadow p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 pb-3 border-b border-gray-200">Schedule Maintenance</h2>
                <form onSubmit={scheduleMaintenance} className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Select Vehicle</label>
                    <select
                      value={newMaintenance.car_id}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, car_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Maintenance Type</label>
                    <select
                      value={newMaintenance.maintenance_type}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, maintenance_type: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Description</label>
                    <textarea
                      value={newMaintenance.description}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
                      required
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Scheduled Date</label>
                    <input
                      type="datetime-local"
                      value={newMaintenance.scheduled_date}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduled_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Cost ($)</label>
                    <input
                      type="number"
                      value={newMaintenance.cost}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, cost: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <div className="bg-white rounded-lg shadow p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 pb-3 border-b border-gray-200">Maintenance Records</h2>
                {maintenance.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm md:text-base">No maintenance records</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider">Vehicle</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider hidden sm:table-cell">Type</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider">Status</th>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider hidden md:table-cell">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maintenance.map((m) => (
                          <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm">{m.car_id}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm hidden sm:table-cell">{m.maintenance_type}</td>
                            <td className="px-2 md:px-4 py-2 md:py-3">
                              <span className={`inline-block px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(m.status)}`}>
                                {m.status}
                              </span>
                            </td>
                            <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm hidden md:table-cell">${m.cost || 'N/A'}</td>
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
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6 pb-3 border-b border-gray-200">Trip History</h2>
              {trips.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-sm md:text-base">No trips recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider">Vehicle</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider hidden sm:table-cell">Start</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider hidden md:table-cell">End</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider">Distance</th>
                        <th className="px-2 md:px-4 py-2 md:py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-xs md:text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map((trip) => (
                        <tr key={trip.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm">{trip.car_id}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm hidden sm:table-cell">{trip.start_location}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm hidden md:table-cell">{trip.end_location || 'In Transit'}</td>
                          <td className="px-2 md:px-4 py-2 md:py-3 text-gray-800 text-xs md:text-sm">{trip.distance_km ? `${trip.distance_km} km` : 'N/A'}</td>
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
