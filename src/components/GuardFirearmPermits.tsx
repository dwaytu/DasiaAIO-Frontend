import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'

interface Permit {
  id: string
  guardId: string
  firearmId: string
  permitType: string
  issuedDate: string
  expiryDate: string
  status: string
  [key: string]: any
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const GuardFirearmPermits: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const currentView = activeView || 'permits'
  const navItems = [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'calendar', label: 'Calendar' },
    { view: 'analytics', label: 'Analytics' },
    { view: 'trips', label: 'Trip Management' },
    { view: 'schedule', label: 'Schedule' },
    { view: 'missions', label: 'Missions' },
    { view: 'performance', label: 'Performance' },
    { view: 'merit', label: 'Merit Scores' },
    { view: 'firearms', label: 'Firearms' },
    { view: 'allocation', label: 'Allocation' },
    { view: 'permits', label: 'Permits' },
    { view: 'maintenance', label: 'Maintenance' },
    { view: 'armored-cars', label: 'Armored Cars' }
  ]

  useEffect(() => {
    fetchPermits()
  }, [])

  const fetchPermits = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/guard-firearm-permits`)
      if (response.ok) {
        const data = await response.json()
        setPermits(data.permits || [])
      }
    } catch (err) {
      console.error('Error fetching permits:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    if (onViewChange) {
      onViewChange(view)
    }
  }

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date()
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-amber-100 text-amber-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="flex min-h-screen w-screen bg-gray-100 font-sans">
      <Sidebar
        items={navItems}
        activeView={currentView}
        onNavigate={handleNavigate}
        onLogoClick={() => onViewChange?.('dashboard')}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header title="Guard Firearm Permits" badgeLabel="Permits" onLogout={onLogout} onMenuClick={() => setMobileMenuOpen(true)} user={user} onNavigateToProfile={onViewChange ? () => onViewChange('profile') : undefined} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading permits...</div>
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <section className="bg-white p-4 md:p-8 rounded-xl shadow-sm w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Permits ({permits.length})</h2>
              {permits.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Guard ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Firearm ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Issued Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Expiry Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permits.map((p) => (
                        <tr key={p.id} className={`border-b border-gray-200 hover:bg-gray-50 ${isExpired(p.expiryDate) ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3 text-gray-700">{p.guardId}</td>
                          <td className="px-4 py-3 text-gray-700">{p.firearmId}</td>
                          <td className="px-4 py-3 text-gray-700">{p.permitType}</td>
                          <td className="px-4 py-3 text-gray-700">{new Date(p.issuedDate).toLocaleDateString()}</td>
                          <td className={`px-4 py-3 ${isExpired(p.expiryDate) ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
                            {new Date(p.expiryDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(p.status)}`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8 italic">No permits found</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default GuardFirearmPermits
