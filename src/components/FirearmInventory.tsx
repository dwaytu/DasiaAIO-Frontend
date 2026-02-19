import { useState, useEffect, FC } from 'react'
import Logo from './Logo'
import { API_BASE_URL } from '../config'

interface Firearm {
  id: string
  serialNumber: string
  model: string
  type: string
  status: string
  lastMaintenance?: string
  [key: string]: any
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
}

const FirearmInventory: FC<Props> = ({ onLogout, onViewChange }) => {
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetchFirearms()
  }, [])

  const fetchFirearms = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/firearms`)
      if (response.ok) {
        const data = await response.json()
        setFirearms(data.firearms || [])
      }
    } catch (err) {
      console.error('Error fetching firearms:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    if (onViewChange) {
      onViewChange(view)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'deployed': return 'bg-blue-100 text-blue-800'
      case 'maintenance': return 'bg-amber-100 text-amber-800'
      case 'lost': return 'bg-red-100 text-red-800'
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
                view === 'firearms' 
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
          <h1 className="text-3xl font-bold text-gray-900 m-0">Firearm Inventory</h1>
          <button 
            onClick={onLogout} 
            className="bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5"
          >
            Logout
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading firearms...</div>
          </div>
        ) : (
          <div className="flex-1 p-8 overflow-y-auto w-full">
            <section className="bg-white p-8 rounded-xl shadow-sm w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">All Firearms ({firearms.length})</h2>
              {firearms.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Serial Number</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Model</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Last Maintenance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {firearms.map((f) => (
                        <tr key={f.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{f.serialNumber}</td>
                          <td className="px-4 py-3 text-gray-700">{f.model}</td>
                          <td className="px-4 py-3 text-gray-700">{f.type}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(f.status)}`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{f.lastMaintenance ? new Date(f.lastMaintenance).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8 italic">No firearms in inventory</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default FirearmInventory
