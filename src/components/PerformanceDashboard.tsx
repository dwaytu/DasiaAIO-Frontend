import { useState, useEffect, FC } from 'react'
import Logo from './Logo'
import { API_BASE_URL } from '../config'

interface User {
  [key: string]: any
}

interface Props {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
}

interface Performance {
  guardId: string
  guardName: string
  attendanceRate: number
  allocationsCompleted: number
  maintenanceCompleted: number
  [key: string]: any
}

const PerformanceDashboard: FC<Props> = ({ user, onLogout, onViewChange }) => {
  const [performance, setPerformance] = useState<Performance[]>([])
  const [loading, setLoading] = useState<boolean>(true)

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
                view === 'performance' 
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
          <h1 className="text-3xl font-bold text-gray-900 m-0">Performance Dashboard</h1>
          <button 
            onClick={onLogout} 
            className="bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:-translate-y-0.5"
          >
            Logout
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading performance data...</div>
          </div>
        ) : (
          <div className="flex-1 p-8 overflow-y-auto w-full">
            <section className="bg-white p-8 rounded-xl shadow-sm">
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
