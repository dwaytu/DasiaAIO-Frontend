import { FC, FormEvent, useEffect, useState } from 'react'
import { Shield, Truck, MapPin, Users } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { logError } from '../../utils/logger'
import { useOperationalMapData, ClientSiteInput } from '../../hooks/useOperationalMapData'
import EmptyState from '../shared/EmptyState'
import LoadingSkeleton from '../shared/LoadingSkeleton'

type ManageTab = 'guards' | 'firearms' | 'vehicles' | 'clients'

interface ResourceManagementPanelProps {
  users: any[]
  onDeleteUser: (id: string, email: string) => void
  canManageUsers: boolean
  isSuperadminViewer: boolean
}

interface Firearm {
  id: string
  serialNumber: string
  model: string
  caliber: string
  status: string
  lastMaintenance?: string
}

interface ArmoredCar {
  id: string
  license_plate: string
  model: string
  manufacturer: string
  capacity_kg: number
  passenger_capacity?: number
  status: string
}

const TAB_CONFIG: { key: ManageTab; label: string; icon: FC<{ className?: string }> }[] = [
  { key: 'guards', label: 'Guards', icon: Users },
  { key: 'firearms', label: 'Firearms', icon: Shield },
  { key: 'vehicles', label: 'Vehicles', icon: Truck },
  { key: 'clients', label: 'Client Sites', icon: MapPin },
]

const ResourceManagementPanel: FC<ResourceManagementPanelProps> = ({
  users,
  onDeleteUser,
  canManageUsers,
  isSuperadminViewer,
}) => {
  const [activeTab, setActiveTab] = useState<ManageTab>('guards')

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in space-y-6">
      <section className="soc-surface p-4 md:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Operations</p>
        <h1 className="text-2xl font-black uppercase tracking-wide text-text-primary">Resource Management</h1>
        <p className="mt-1 text-sm text-text-secondary">Centralized add, view, and remove for guards, firearms, vehicles, and client sites.</p>
      </section>

      <nav className="flex flex-wrap gap-2 rounded border border-border-subtle bg-surface p-2" aria-label="Resource tabs">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            aria-current={activeTab === key ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wide whitespace-nowrap transition-all duration-300 ${
              activeTab === key
                ? 'bg-[color:var(--color-info-bg)] text-[color:var(--color-info-text)] border border-[color:var(--color-info-border)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'guards' && (
        <GuardsTab
          users={users}
          onDeleteUser={onDeleteUser}
          canManageUsers={canManageUsers}
          isSuperadminViewer={isSuperadminViewer}
        />
      )}
      {activeTab === 'firearms' && <FirearmsTab />}
      {activeTab === 'vehicles' && <VehiclesTab />}
      {activeTab === 'clients' && <ClientSitesTab />}
    </div>
  )
}

const GuardsTab: FC<{
  users: any[]
  onDeleteUser: (id: string, email: string) => void
  canManageUsers: boolean
  isSuperadminViewer: boolean
}> = ({ users, onDeleteUser, canManageUsers, isSuperadminViewer }) => {
  const guards = users.filter(
    (u) => (u.role || '').toLowerCase() === 'guard' || (u.role || '').toLowerCase() === 'user'
  )

  if (!canManageUsers) {
    return (
      <section className="table-glass rounded p-6">
        <EmptyState icon={Users} title="Insufficient permissions" subtitle="You do not have permission to manage users" />
      </section>
    )
  }

  return (
    <section className="table-glass rounded p-4 md:p-6">
      <h2 className="soc-section-title mb-4">Guard Roster ({guards.length})</h2>
      {guards.length === 0 ? (
        <EmptyState icon={Users} title="No guards registered" subtitle="Guards will appear here once approved" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="thead-glass">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden lg:table-cell">License</th>
                {isSuperadminViewer && (
                  <th className="px-4 py-3 text-right font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {guards.map((g) => (
                <tr key={g.id} className="border-b border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 text-text-primary">{g.full_name || g.username}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm">{g.email}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm hidden md:table-cell">{g.phone_number || '-'}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm hidden lg:table-cell">{g.license_number || '-'}</td>
                  {isSuperadminViewer && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDeleteUser(g.id, g.email)}
                        className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold text-danger-text bg-danger-bg ring-1 ring-danger-border hover:bg-danger-bg/80 transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const FirearmsTab: FC = () => {
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFirearm, setNewFirearm] = useState({ serialNumber: '', model: '', caliber: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchFirearms()
  }, [])

  const fetchFirearms = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/firearms`, { headers: getAuthHeaders() })
      if (response.ok) {
        const data = await response.json()
        setFirearms(Array.isArray(data) ? data : (data.firearms || []))
      }
    } catch (err) {
      logError('Error fetching firearms:', err)
    } finally {
      setLoading(false)
    }
  }

  const addFirearm = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newFirearm),
      })
      if (!response.ok) throw new Error('Failed to add firearm')
      setSuccess('Firearm added successfully')
      setNewFirearm({ serialNumber: '', model: '', caliber: '' })
      setShowAddForm(false)
      fetchFirearms()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add firearm')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSkeleton variant="table" />

  return (
    <section className="table-glass rounded p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="soc-section-title">Firearm Inventory ({firearms.length})</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1 rounded px-4 py-2 text-sm font-semibold bg-[color:var(--color-info-bg)] text-[color:var(--color-info-text)] border border-[color:var(--color-info-border)] hover:opacity-90 transition-opacity"
        >
          {showAddForm ? 'Cancel' : '+ Add Firearm'}
        </button>
      </div>

      {error && <div className="p-3 bg-danger-bg border border-danger-border rounded text-danger-text text-sm">{error}</div>}
      {success && <div className="p-3 bg-success-bg border border-success-border rounded text-success-text text-sm">{success}</div>}

      {showAddForm && (
        <form onSubmit={addFirearm} className="bg-surface-elevated p-4 rounded border border-border space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="firearm-serial" className="block text-xs font-semibold text-text-secondary mb-1">Serial Number</label>
              <input id="firearm-serial" type="text" required value={newFirearm.serialNumber} onChange={(e) => setNewFirearm({ ...newFirearm, serialNumber: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div>
              <label htmlFor="firearm-model" className="block text-xs font-semibold text-text-secondary mb-1">Model</label>
              <input id="firearm-model" type="text" required value={newFirearm.model} onChange={(e) => setNewFirearm({ ...newFirearm, model: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div>
              <label htmlFor="firearm-caliber" className="block text-xs font-semibold text-text-secondary mb-1">Caliber</label>
              <input id="firearm-caliber" type="text" required value={newFirearm.caliber} onChange={(e) => setNewFirearm({ ...newFirearm, caliber: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" placeholder="e.g., 9mm" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full rounded bg-[color:var(--color-info-bg)] text-[color:var(--color-info-text)] border border-[color:var(--color-info-border)] py-2 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
            {submitting ? 'Adding...' : 'Add Firearm'}
          </button>
        </form>
      )}

      {firearms.length === 0 ? (
        <EmptyState icon={Shield} title="No firearms registered" subtitle="Add firearms to the inventory to get started" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="thead-glass">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Serial</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Model</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden sm:table-cell">Caliber</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {firearms.map((f) => (
                <tr key={f.id} className="border-b border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 text-text-primary text-sm">{f.serialNumber}</td>
                  <td className="px-4 py-3 text-text-primary text-sm">{f.model}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm hidden sm:table-cell">{f.caliber}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      f.status === 'available' ? 'bg-success-bg text-success-text ring-1 ring-success-border' :
                      f.status === 'deployed' ? 'bg-info-bg text-info-text ring-1 ring-info-border' :
                      f.status === 'maintenance' ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' :
                      'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
                    }`}>
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const VehiclesTab: FC = () => {
  const [cars, setCars] = useState<ArmoredCar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newCar, setNewCar] = useState({
    licensePlate: '',
    vin: '',
    model: '',
    manufacturer: '',
    capacityKg: 0,
    passengerCapacity: 4,
  })

  useEffect(() => {
    fetchCars()
  }, [])

  const fetchCars = async () => {
    try {
      setLoading(true)
      const data = await fetchJsonOrThrow<ArmoredCar[]>(
        `${API_BASE_URL}/api/armored-cars`,
        { headers: getAuthHeaders() },
        'Failed to fetch vehicles'
      )
      setCars(data)
    } catch (err) {
      logError('Error fetching vehicles:', err)
    } finally {
      setLoading(false)
    }
  }

  const addCar = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/armored-cars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newCar),
      })
      if (!response.ok) throw new Error('Failed to add vehicle')
      setSuccess('Vehicle added successfully')
      setNewCar({ licensePlate: '', vin: '', model: '', manufacturer: '', capacityKg: 0, passengerCapacity: 4 })
      setShowAddForm(false)
      fetchCars()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add vehicle')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSkeleton variant="table" />

  return (
    <section className="table-glass rounded p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="soc-section-title">Vehicle Fleet ({cars.length})</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1 rounded px-4 py-2 text-sm font-semibold bg-[color:var(--color-info-bg)] text-[color:var(--color-info-text)] border border-[color:var(--color-info-border)] hover:opacity-90 transition-opacity"
        >
          {showAddForm ? 'Cancel' : '+ Add Vehicle'}
        </button>
      </div>

      {error && <div className="p-3 bg-danger-bg border border-danger-border rounded text-danger-text text-sm">{error}</div>}
      {success && <div className="p-3 bg-success-bg border border-success-border rounded text-success-text text-sm">{success}</div>}

      {showAddForm && (
        <form onSubmit={addCar} className="bg-surface-elevated p-4 rounded border border-border space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label htmlFor="vehicle-plate" className="block text-xs font-semibold text-text-secondary mb-1">License Plate</label>
              <input id="vehicle-plate" type="text" required value={newCar.licensePlate} onChange={(e) => setNewCar({ ...newCar, licensePlate: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div>
              <label htmlFor="vehicle-vin" className="block text-xs font-semibold text-text-secondary mb-1">VIN</label>
              <input id="vehicle-vin" type="text" required value={newCar.vin} onChange={(e) => setNewCar({ ...newCar, vin: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div>
              <label htmlFor="vehicle-model" className="block text-xs font-semibold text-text-secondary mb-1">Model</label>
              <input id="vehicle-model" type="text" required value={newCar.model} onChange={(e) => setNewCar({ ...newCar, model: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div>
              <label htmlFor="vehicle-mfr" className="block text-xs font-semibold text-text-secondary mb-1">Manufacturer</label>
              <input id="vehicle-mfr" type="text" required value={newCar.manufacturer} onChange={(e) => setNewCar({ ...newCar, manufacturer: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div>
              <label htmlFor="vehicle-cap" className="block text-xs font-semibold text-text-secondary mb-1">Capacity (kg)</label>
              <input id="vehicle-cap" type="number" required value={newCar.capacityKg} onChange={(e) => setNewCar({ ...newCar, capacityKg: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div>
              <label htmlFor="vehicle-pax" className="block text-xs font-semibold text-text-secondary mb-1">Passengers</label>
              <input id="vehicle-pax" type="number" required min={1} max={20} value={newCar.passengerCapacity} onChange={(e) => setNewCar({ ...newCar, passengerCapacity: parseInt(e.target.value) || 4 })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full rounded bg-[color:var(--color-info-bg)] text-[color:var(--color-info-text)] border border-[color:var(--color-info-border)] py-2 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
            {submitting ? 'Adding...' : 'Add Vehicle'}
          </button>
        </form>
      )}

      {cars.length === 0 ? (
        <EmptyState icon={Truck} title="No vehicles in fleet" subtitle="Register armored vehicles to manage the fleet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="thead-glass">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Plate</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden sm:table-cell">Model</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden md:table-cell">Capacity</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={car.id} className="border-b border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 text-text-primary text-sm">{car.license_plate}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm hidden sm:table-cell">{car.model}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm hidden md:table-cell">{car.capacity_kg} kg</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      car.status === 'available' ? 'bg-success-bg text-success-text ring-1 ring-success-border' :
                      car.status === 'allocated' ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' :
                      car.status === 'maintenance' ? 'bg-info-bg text-info-text ring-1 ring-info-border' :
                      'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
                    }`}>
                      {car.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const ClientSitesTab: FC = () => {
  const { clientSites, createClientSite, deleteClientSite } = useOperationalMapData()
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newSite, setNewSite] = useState<ClientSiteInput>({
    name: '',
    latitude: 7.0731,
    longitude: 125.6128,
    address: '',
  })

  const addSite = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createClientSite(newSite)
      setSuccess('Client site created')
      setNewSite({ name: '', latitude: 7.0731, longitude: 125.6128, address: '' })
      setShowAddForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteClientSite(id)
      setSuccess('Site deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete site')
    }
  }

  return (
    <section className="table-glass rounded p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="soc-section-title">Client Sites ({clientSites.length})</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1 rounded px-4 py-2 text-sm font-semibold bg-[color:var(--color-info-bg)] text-[color:var(--color-info-text)] border border-[color:var(--color-info-border)] hover:opacity-90 transition-opacity"
        >
          {showAddForm ? 'Cancel' : '+ Add Site'}
        </button>
      </div>

      {error && <div className="p-3 bg-danger-bg border border-danger-border rounded text-danger-text text-sm">{error}</div>}
      {success && <div className="p-3 bg-success-bg border border-success-border rounded text-success-text text-sm">{success}</div>}

      {showAddForm && (
        <form onSubmit={addSite} className="bg-surface-elevated p-4 rounded border border-border space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="site-name" className="block text-xs font-semibold text-text-secondary mb-1">Site Name</label>
              <input id="site-name" type="text" required value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div>
              <label htmlFor="site-lat" className="block text-xs font-semibold text-text-secondary mb-1">Latitude</label>
              <input id="site-lat" type="number" step="any" required value={newSite.latitude} onChange={(e) => setNewSite({ ...newSite, latitude: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div>
              <label htmlFor="site-lng" className="block text-xs font-semibold text-text-secondary mb-1">Longitude</label>
              <input id="site-lng" type="number" step="any" required value={newSite.longitude} onChange={(e) => setNewSite({ ...newSite, longitude: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="site-address" className="block text-xs font-semibold text-text-secondary mb-1">Address</label>
              <input id="site-address" type="text" value={newSite.address || ''} onChange={(e) => setNewSite({ ...newSite, address: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)]" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full rounded bg-[color:var(--color-info-bg)] text-[color:var(--color-info-text)] border border-[color:var(--color-info-border)] py-2 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
            {submitting ? 'Creating...' : 'Create Site'}
          </button>
        </form>
      )}

      {clientSites.length === 0 ? (
        <EmptyState icon={MapPin} title="No client sites" subtitle="Add geofenced client sites for guard tracking" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="thead-glass">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden sm:table-cell">Address</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden md:table-cell">Coordinates</th>
                <th className="px-4 py-3 text-right font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clientSites.map((site) => (
                <tr key={site.id} className="border-b border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 text-text-primary text-sm">{site.name}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm hidden sm:table-cell">{site.address || '-'}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs font-mono hidden md:table-cell">{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(site.id)}
                      className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold text-danger-text bg-danger-bg ring-1 ring-danger-border hover:bg-danger-bg/80 transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default ResourceManagementPanel
