import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'
import { User as AppUser } from '../App'
import { getSidebarNav } from '../config/navigation'
import { logError } from '../utils/logger'

interface Props {
  user: AppUser
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
  const navItems = getSidebarNav(user.role)

  useEffect(() => {
    fetchPerformance()
  }, [])

  const fetchPerformance = async () => {
    try {
      setLoading(true)
      // Simulated performance data from attendance and allocations
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        // Create mock performance data
        const users = Array.isArray(data) ? data : (data.users || data || [])
        const perf = users.map((u: any) => ({
          guardId: u.id,
          guardName: u.email.split('@')[0],
          attendanceRate: Math.floor(Math.random() * 40 + 60),
          allocationsCompleted: Math.floor(Math.random() * 50 + 10),
          maintenanceCompleted: Math.floor(Math.random() * 20 + 5)
        }))
        setPerformance(perf)
      }
    } catch (err) {
      logError('Error fetching performance:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = (view: string) => {
    if (onViewChange) {
      onViewChange(view)
    }
  }

  const averageAttendance = performance.length > 0
    ? Math.round(performance.reduce((sum, row) => sum + row.attendanceRate, 0) / performance.length)
    : 0
  const totalAllocations = performance.reduce((sum, row) => sum + row.allocationsCompleted, 0)
  const totalMaintenance = performance.reduce((sum, row) => sum + row.maintenanceCompleted, 0)

  return (
    <div className="flex h-screen w-screen bg-background font-sans">
      <a href="#maincontent" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-text-primary focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-focus-ring)]">
        Skip to main content
      </a>
      <Sidebar
        items={navItems}
        activeView={currentView}
        onNavigate={handleNavigate}
        onLogoClick={() => onViewChange?.('dashboard')}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main id="maincontent" tabIndex={-1} className="flex-1 flex flex-col overflow-hidden w-full">
        <Header title="Performance Dashboard" badgeLabel="Performance" onLogout={onLogout} onMenuClick={() => setMobileMenuOpen(true)} user={user} onNavigateToProfile={() => onViewChange?.('profile')} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-text-secondary text-lg font-medium">Loading performance data...</div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden w-full animate-fade-in">
            <section className="soc-surface mb-4 p-4 md:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Performance Operations</p>
              <h2 className="text-2xl font-black uppercase tracking-wide text-text-primary">Guard Reliability Overview</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="soc-kpi"><p className="soc-kpi-label">Avg Attendance</p><p className="soc-kpi-value">{averageAttendance}%</p></div>
                <div className="soc-kpi"><p className="soc-kpi-label">Allocations Closed</p><p className="soc-kpi-value">{totalAllocations}</p></div>
                <div className="soc-kpi"><p className="soc-kpi-label">Maintenance Tasks</p><p className="soc-kpi-value">{totalMaintenance}</p></div>
              </div>
            </section>

            <section className="flex flex-col flex-1 min-h-0 rounded-2xl overflow-hidden table-glass">
              <div className="flex-shrink-0 px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-[color:var(--color-surface)] to-[color:var(--color-surface-elevated)]">
                <h2 className="text-xl font-bold text-text-primary">Guard Performance</h2>
                <p className="text-text-secondary text-sm mt-1">Attendance reliability and task throughput by operator.</p>
              </div>
              {performance.length > 0 ? (
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Guard Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Attendance Rate</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Allocations</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Maintenance Tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.map((p) => (
                        <tr key={p.guardId} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary font-medium">{p.guardName}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-border rounded-full h-2 overflow-hidden" aria-hidden="true">
                                <div 
                                  className="bg-[color:var(--status-success-border)] h-full transition-all duration-300" 
                                  style={{width: `${p.attendanceRate}%`}}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-text-primary min-w-12" aria-label={`Attendance rate ${p.attendanceRate} percent`}>{p.attendanceRate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="soc-chip">{p.allocationsCompleted}</span></td>
                          <td className="px-4 py-3"><span className="soc-chip status-danger">{p.maintenanceCompleted}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-text-secondary py-8 italic">No performance data available</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default PerformanceDashboard

