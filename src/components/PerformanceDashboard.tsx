import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'

interface User {
  [key: string]: any
}

interface Props {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

interface Performance {
  guardId: string
  guardName: string
  attendanceRate: number
  allocationsCompleted: number
  maintenanceCompleted: number
  [key: string]: any
}

const PerformanceDashboard: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [performance, setPerformance] = useState<Performance[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const currentView = activeView || 'performance'
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
    fetchPerformance()
  }, [])

  const fetchPerformance = async () => {
    try {
      setLoading(true)
      // Simulated performance data from attendance and allocations
      const response = await fetch(`${API_BASE_URL}/api/users`)
      if (response.ok) {
        const data = await response.json()
        // Create mock performance data
        const perf = data.users.map((u: any) => ({
          guardId: u.id,
          guardName: u.email.split('@')[0],
          attendanceRate: Math.floor(Math.random() * 40 + 60),
          allocationsCompleted: Math.floor(Math.random() * 50 + 10),
          maintenanceCompleted: Math.floor(Math.random() * 20 + 5)
        }))
        setPerformance(perf)
      }
    } catch (err) {
      console.error('Error fetching performance:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    if (onViewChange) {
      onViewChange(view)
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
        <Header title="Performance Dashboard" badgeLabel="Performance" onLogout={onLogout} onMenuClick={() => setMobileMenuOpen(true)} user={user} onNavigateToProfile={() => onViewChange('profile')} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading performance data...</div>
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <section className="bg-white p-4 md:p-8 rounded-xl shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Guard Performance</h2>
              {performance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Guard Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Attendance Rate</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Allocations</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 text-sm uppercase tracking-wider">Maintenance Tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.map((p) => (
                        <tr key={p.guardId} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{p.guardName}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-indigo-600 h-full transition-all duration-300" 
                                  style={{width: `${p.attendanceRate}%`}}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-gray-700 min-w-12">{p.attendanceRate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">{p.allocationsCompleted}</span></td>
                          <td className="px-4 py-3"><span className="inline-block bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">{p.maintenanceCompleted}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8 italic">No performance data available</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default PerformanceDashboard
