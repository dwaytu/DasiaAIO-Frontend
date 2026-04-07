import { useState, useEffect, FC } from 'react'
import { TrendingUp } from 'lucide-react'
import { API_BASE_URL } from '../config'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import type { User as AppUser } from '../context/AuthContext'
import { getSidebarNav } from '../config/navigation'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

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
  missionPerformance: number
  permitCompliance: number
  reliabilityScore: number
  rank: number
}

const PerformanceDashboard: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [performance, setPerformance] = useState<Performance[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const currentView = activeView || 'performance'

  useEffect(() => {
    fetchPerformance()
  }, [])

  const fetchPerformance = async () => {
    try {
      setLoading(true)
      const rows = await fetchJsonOrThrow<Array<{
        guardId: string
        guardName: string
        attendanceScore: number
        missionPerformance: number
        permitCompliance: number
        reliabilityScore: number
        rank: number
      }>>(
        `${API_BASE_URL}/api/analytics/guard-reliability`,
        { headers: getAuthHeaders() },
        'Failed to fetch guard reliability metrics',
      )

      const normalizedRows = rows.map((row) => ({
        guardId: row.guardId,
        guardName: row.guardName,
        attendanceRate: Math.round(row.attendanceScore),
        missionPerformance: Math.round(row.missionPerformance),
        permitCompliance: Math.round(row.permitCompliance),
        reliabilityScore: Math.round(row.reliabilityScore),
        rank: row.rank,
      }))

      setPerformance(normalizedRows)
    } catch (err) {
      logError('Error fetching performance:', err)
      setPerformance([])
    } finally {
      setLoading(false)
    }
  }

  const averageAttendance = performance.length > 0
    ? Math.round(performance.reduce((sum, row) => sum + row.attendanceRate, 0) / performance.length)
    : 0
  const averageReliability = performance.length > 0
    ? Math.round(performance.reduce((sum, row) => sum + row.reliabilityScore, 0) / performance.length)
    : 0
  const activeGuards = performance.length

  return (
    <OperationalShell
      user={user}
      title="PERFORMANCE"
      navItems={getSidebarNav(user.role)}
      activeView={currentView}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >
        {loading ? (
          <div className="flex-1 p-4 md:p-8">
            <LoadingSkeleton variant="table" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden w-full animate-fade-in">
            <section className="soc-surface mb-4 p-4 md:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Performance Operations</p>
              <h2 className="text-2xl font-black uppercase tracking-wide text-text-primary">Guard Reliability Overview</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="soc-kpi"><p className="soc-kpi-label">Avg Attendance</p><p className="soc-kpi-value">{averageAttendance}%</p></div>
                <div className="soc-kpi"><p className="soc-kpi-label">Avg Reliability</p><p className="soc-kpi-value">{averageReliability}%</p></div>
                <div className="soc-kpi"><p className="soc-kpi-label">Tracked Guards</p><p className="soc-kpi-value">{activeGuards}</p></div>
              </div>
            </section>

            <section className="flex flex-col flex-1 min-h-0 rounded overflow-hidden table-glass">
              <div className="flex-shrink-0 px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-[color:var(--color-surface)] to-[color:var(--color-surface-elevated)]">
                <h2 className="text-xl font-bold text-text-primary">Guard Performance</h2>
                <p className="text-text-secondary text-sm mt-1">Attendance reliability and task throughput by operator.</p>
              </div>
              {performance.length > 0 ? (
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Rank</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Guard Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Attendance Rate</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Mission Performance</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Permit Compliance</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Reliability Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.map((p) => (
                        <tr key={p.guardId} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary font-medium">#{p.rank}</td>
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
                          <td className="px-4 py-3"><span className="soc-chip">{p.missionPerformance}%</span></td>
                          <td className="px-4 py-3"><span className="soc-chip">{p.permitCompliance}%</span></td>
                          <td className="px-4 py-3"><span className="soc-chip status-danger">{p.reliabilityScore}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={TrendingUp} title="No performance data available" subtitle="Performance metrics will appear after guard evaluations" />
              )}
            </section>
          </div>
        )}
    </OperationalShell>
  )
}

export default PerformanceDashboard

