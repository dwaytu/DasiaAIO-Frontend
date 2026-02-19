import { useState, useEffect, FC } from 'react'
import Logo from './Logo'
import { API_BASE_URL } from '../config'

interface Maintenance {
  id: string
  firearmId: string
  maintenanceType: string
  maintenanceDate: string
  nextScheduledDate?: string
  status: string
  notes?: string
  [key: string]: any
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
}

const FirearmMaintenance: FC<Props> = ({ onLogout, onViewChange }) => {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetchMaintenances()
  }, [])

  const fetchMaintenances = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/firearm-maintenance`)
      if (response.ok) {
        const data = await response.json()
        setMaintenances(data.maintenances || [])
      }
    } catch (err) {
      console.error('Error fetching maintenance records:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    if (onViewChange) {
      onViewChange(view)
    }
  }

  const isOverdue = (nextDate: string | undefined) => {
    if (!nextDate) return false
    return new Date(nextDate) < new Date()
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-amber-100 text-amber-800'
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="flex min-h-screen w-screen bg-gray-100 font-sans">
      <aside className="w-64 bg-gradient-to-b from-indigo-600 to-purple-900 text-white p-8 flex flex-col shadow-lg">
        <div className="pb-6 border-b border-white/20 mb-8">
          <Logo />
        </div>
        <nav className="flex-1 flex flex-col gap-2">
          {[
            { view: 'users', label: 'Dashboard' },
            { view: 'performance', label: 'Performance' },
            { view: 'firearms', label: 'Firearms' },
            { view: 'allocation', label: 'Allocation' },
            { view: 'permits', label: 'Permits' },
            { view: 'maintenance', label: 'Maintenance' },
            { view: 'armored-cars', label: 'Armored Cars' }
          ].map(({ view, label }) => (
            <button
              key={view}
              className={`text-white px-4 py-3 rounded-lg text-left font-medium transition-all duration-300 hover:translate-x-1 ${
                view === 'maintenance' 
                  ? 'bg-white/30 border-l-4 border-yellow-400 pl-3' 
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              onClick={() => handleNavigate(view)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button 
          onClick={onLogout} 
          className="bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 text-white px-4 py-3 rounded-lg font-semibold mt-6 transition-colors"
        >
          Logout
        </button>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="bg-white px-8 py-6 flex justify-between items-center shadow-sm border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 m-0">Firearm Maintenance</h1>
          <button 
            onClick={onLogout} 
            className="bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5"
          >
            Logout
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading maintenance records...</div>
          </div>
        ) : (
          <div className="flex-1 p-8 overflow-y-auto w-full">
            <section className="bg-white p-8 rounded-xl shadow-sm w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Maintenance Records ({maintenances.length})</h2>
              {maintenances.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Firearm ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Maintenance Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Next Scheduled</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenances.map((m) => (
                        <tr key={m.id} className={`border-b border-gray-200 hover:bg-gray-50 ${isOverdue(m.nextScheduledDate) ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 text-gray-700">{m.firearmId}</td>
                          <td className="px-4 py-3 text-gray-700">{m.maintenanceType}</td>
                          <td className="px-4 py-3 text-gray-700">{new Date(m.maintenanceDate).toLocaleDateString()}</td>
                          <td className={`px-4 py-3 ${isOverdue(m.nextScheduledDate) ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
                            {m.nextScheduledDate ? new Date(m.nextScheduledDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(m.status)}`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{m.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8 italic">No maintenance records found</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default FirearmMaintenance
