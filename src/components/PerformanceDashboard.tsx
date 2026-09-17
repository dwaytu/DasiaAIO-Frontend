import { useEffect, useMemo, useState, FC } from 'react'
import {
  AlertTriangle,
  Award,
  CalendarCheck,
  Clock,
  Download,
  FileText,
  Printer,
  Repeat2,
  Star,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { API_BASE_URL } from '../config'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import type { User as AppUser } from '../context/AuthContext'
import { getSidebarNav } from '../config/navigation'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { buildPerformanceCsv } from '../utils/analyticsPresentation'

interface Props {
  user: AppUser
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

interface GuardPerformanceRow {
  guardId: string
  guardName: string
  totalShifts: number
  attendedShifts: number
  attendanceRate: number
  lateCheckIns: number
  completedShifts: number
  noShows: number
  incidentReportsSubmitted: number
  averageClientRating: number
  evaluationCount: number
  meritScore: number
  replacementFrequency: number
}

interface GuardPerformanceSummary {
  totalGuards: number
  averageAttendanceRate: number
  totalLateCheckIns: number
  totalCompletedShifts: number
  totalNoShows: number
  totalIncidentReports: number
  averageClientRating: number
  averageMeritScore: number
  totalReplacementFrequency: number
}

interface GuardPerformanceReport {
  period: {
    from?: string
    to?: string
  }
  summary: GuardPerformanceSummary
  guards: GuardPerformanceRow[]
}

interface DateFilters {
  from: string
  to: string
}

type NumericMetricKey = keyof Pick<
  GuardPerformanceRow,
  'attendanceRate' | 'meritScore' | 'completedShifts' | 'lateCheckIns' | 'noShows' | 'incidentReportsSubmitted' | 'replacementFrequency'
>

const emptySummary: GuardPerformanceSummary = {
  totalGuards: 0,
  averageAttendanceRate: 0,
  totalLateCheckIns: 0,
  totalCompletedShifts: 0,
  totalNoShows: 0,
  totalIncidentReports: 0,
  averageClientRating: 0,
  averageMeritScore: 0,
  totalReplacementFrequency: 0,
}

const emptyReport: GuardPerformanceReport = {
  period: {},
  summary: emptySummary,
  guards: [],
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

function formatRating(value: number): string {
  return value > 0 ? value.toFixed(1) : '0.0'
}

function truncateLabel(value: string, maxLength = 14): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}

function buildReportUrl(filters: DateFilters): string {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  const query = params.toString()
  return `${API_BASE_URL}/api/analytics/guard-performance-report${query ? `?${query}` : ''}`
}

const KpiCard: FC<{
  icon: LucideIcon
  label: string
  value: string | number
  detail: string
  tone: 'info' | 'success' | 'warning' | 'danger'
}> = ({ icon: Icon, label, value, detail, tone }) => {
  const toneClasses = {
    info: 'border-info-border bg-info-bg text-info-text',
    success: 'border-success-border bg-success-bg text-success-text',
    warning: 'border-warning-border bg-warning-bg text-warning-text',
    danger: 'border-danger-border bg-danger-bg text-danger-text',
  }[tone]

  return (
    <div className={`rounded border p-4 ${toneClasses}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">{label}</p>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-black tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-80">{detail}</p>
    </div>
  )
}

const VerticalBarChart: FC<{
  title: string
  rows: GuardPerformanceRow[]
  metricKey: NumericMetricKey
  suffix?: string
  tone: 'info' | 'success'
}> = ({ title, rows, metricKey, suffix = '', tone }) => {
  const chartRows = rows.slice(0, 8)
  const maxValue = Math.max(1, ...chartRows.map((row) => Number(row[metricKey]) || 0))
  const width = 640
  const height = 240
  const padding = { top: 24, right: 16, bottom: 46, left: 32 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const barGap = 10
  const barWidth = chartRows.length > 0
    ? Math.max(20, (plotWidth - barGap * (chartRows.length - 1)) / chartRows.length)
    : 20
  const colorClass = tone === 'success' ? 'text-success-text' : 'text-info-text'

  return (
    <section className="command-panel p-4 md:p-5">
      <h3 className="text-lg font-bold text-text-primary">{title}</h3>
      {chartRows.length > 0 ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`mt-4 h-72 w-full ${colorClass}`}
          role="img"
          aria-label={title}
        >
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = padding.top + plotHeight - (tick / 100) * plotHeight
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  className="stroke-current text-border"
                  strokeOpacity={0.5}
                  strokeWidth={1}
                />
                <text x={4} y={y + 4} className="fill-current text-[10px] text-text-tertiary">
                  {tick}
                </text>
              </g>
            )
          })}
          {chartRows.map((row, index) => {
            const rawValue = Number(row[metricKey]) || 0
            const valueForHeight = metricKey === 'attendanceRate' || metricKey === 'meritScore'
              ? Math.min(rawValue, 100)
              : rawValue
            const scaledValue = metricKey === 'attendanceRate' || metricKey === 'meritScore'
              ? valueForHeight
              : (valueForHeight / maxValue) * 100
            const barHeight = (scaledValue / 100) * plotHeight
            const x = padding.left + index * (barWidth + barGap)
            const y = padding.top + plotHeight - barHeight

            return (
              <g key={row.guardId}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={3}
                  className="fill-current"
                  opacity={0.85}
                />
                <text
                  x={x + barWidth / 2}
                  y={Math.max(12, y - 6)}
                  textAnchor="middle"
                  className="fill-current text-[10px] font-semibold text-text-primary"
                >
                  {Math.round(rawValue)}{suffix}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={height - 16}
                  textAnchor="middle"
                  className="fill-current text-[10px] text-text-secondary"
                >
                  {truncateLabel(row.guardName)}
                </text>
              </g>
            )
          })}
        </svg>
      ) : (
        <p className="mt-4 text-sm text-text-secondary">No chart data available for the selected period.</p>
      )}
    </section>
  )
}

const WorkloadBars: FC<{ rows: GuardPerformanceRow[] }> = ({ rows }) => {
  const displayRows = rows.slice(0, 8)
  const maxCompleted = Math.max(1, ...displayRows.map((row) => row.completedShifts))

  return (
    <section className="command-panel p-4 md:p-5">
      <h3 className="text-lg font-bold text-text-primary">Completed Shifts and Attendance Exceptions</h3>
      <div className="mt-4 space-y-4">
        {displayRows.length > 0 ? displayRows.map((row) => {
          const completedWidth = Math.max(2, (row.completedShifts / maxCompleted) * 100)
          const exceptionTotal = row.lateCheckIns + row.noShows
          return (
            <div key={row.guardId}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-text-primary">{row.guardName}</span>
                <span className="text-text-secondary">
                  {row.completedShifts} completed / {exceptionTotal} exceptions
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded bg-border" aria-hidden="true">
                <div className="h-full rounded bg-success-bg ring-1 ring-success-border" style={{ width: `${completedWidth}%` }} />
              </div>
              {exceptionTotal > 0 ? (
                <p className="mt-1 text-xs text-warning-text">
                  {row.lateCheckIns} late check-in{row.lateCheckIns === 1 ? '' : 's'}, {row.noShows} no-show{row.noShows === 1 ? '' : 's'}
                </p>
              ) : (
                <p className="mt-1 text-xs text-success-text">No late check-ins or no-shows recorded.</p>
              )}
            </div>
          )
        }) : (
          <p className="text-sm text-text-secondary">No workload records available for the selected period.</p>
        )}
      </div>
    </section>
  )
}

const PerformanceDashboard: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [report, setReport] = useState<GuardPerformanceReport>(emptyReport)
  const [filters, setFilters] = useState<DateFilters>({ from: '', to: '' })
  const [appliedFilters, setAppliedFilters] = useState<DateFilters>({ from: '', to: '' })
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const currentView = activeView || 'performance'

  useEffect(() => {
    const controller = new AbortController()

    async function fetchPerformance(): Promise<void> {
      try {
        setLoading(true)
        setError('')
        const data = await fetchJsonOrThrow<GuardPerformanceReport>(
          buildReportUrl(appliedFilters),
          { headers: getAuthHeaders(), signal: controller.signal },
          'Failed to fetch guard performance report',
        )
        setReport(data)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        logError('Error fetching guard performance report:', err)
        setReport(emptyReport)
        setError(err instanceof Error ? err.message : 'Unable to load performance report')
      } finally {
        setLoading(false)
      }
    }

    void fetchPerformance()
    return () => controller.abort()
  }, [appliedFilters])

  const sortedByMerit = useMemo(
    () => [...report.guards].sort((a, b) => b.meritScore - a.meritScore),
    [report.guards],
  )
  const sortedByAttendance = useMemo(
    () => [...report.guards].sort((a, b) => b.attendanceRate - a.attendanceRate),
    [report.guards],
  )
  const summary = report.summary
  const periodLabel = report.period.from || report.period.to
    ? `${report.period.from ?? 'Start'} to ${report.period.to ?? 'Present'}`
    : 'All recorded operations'

  const applyFilters = () => {
    setAppliedFilters(filters)
  }

  const clearFilters = () => {
    const empty = { from: '', to: '' }
    setFilters(empty)
    setAppliedFilters(empty)
  }

  const downloadCsv = () => {
    const blob = new Blob([buildPerformanceCsv(report.guards)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sentinel-guard-performance-${report.period.from ?? 'start'}-${report.period.to ?? 'present'}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

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
        <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full animate-fade-in">
          <section className="soc-surface mb-4 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Performance Analytics</p>
                <h2 className="text-2xl font-black uppercase tracking-wide text-text-primary">Guard Performance Report</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {periodLabel}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  Advisory metrics derived from attendance, incident, evaluation, merit, and replacement records.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto_auto]">
                <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  From
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                    className="mt-1 min-h-11 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  To
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                    className="mt-1 min-h-11 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  />
                </label>
                <button type="button" onClick={applyFilters} className="soc-btn min-h-11 self-end">
                  Apply
                </button>
                <button type="button" onClick={clearFilters} className="soc-btn soc-btn-neutral min-h-11 self-end">
                  Clear
                </button>
                <button
                  type="button"
                  onClick={downloadCsv}
                  disabled={report.guards.length === 0}
                  className="soc-btn soc-btn-neutral inline-flex min-h-11 items-center justify-center gap-2 self-end disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="soc-btn soc-btn-neutral inline-flex min-h-11 items-center justify-center gap-2 self-end"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Print
                </button>
              </div>
            </div>
          </section>

          {error ? (
            <div className="mb-4 rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text" role="alert">
              {error}
            </div>
          ) : null}

          <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={TrendingUp}
              label="Attendance Rate"
              value={formatPercent(summary.averageAttendanceRate)}
              detail={`${summary.totalGuards} guard${summary.totalGuards === 1 ? '' : 's'} tracked`}
              tone="success"
            />
            <KpiCard
              icon={Clock}
              label="Late Check-ins"
              value={summary.totalLateCheckIns}
              detail="Punctuality exceptions"
              tone={summary.totalLateCheckIns > 0 ? 'warning' : 'success'}
            />
            <KpiCard
              icon={AlertTriangle}
              label="No-shows"
              value={summary.totalNoShows}
              detail="Recorded and inferred absences"
              tone={summary.totalNoShows > 0 ? 'danger' : 'success'}
            />
            <KpiCard
              icon={Star}
              label="Evaluator Rating"
              value={formatRating(summary.averageClientRating)}
              detail="Average supervisor and administrator evaluation score"
              tone="info"
            />
            <KpiCard
              icon={CalendarCheck}
              label="Completed Shifts"
              value={summary.totalCompletedShifts}
              detail="Checked-out or completed duties"
              tone="success"
            />
            <KpiCard
              icon={FileText}
              label="Incident Reports"
              value={summary.totalIncidentReports}
              detail="Reports submitted by guards"
              tone="warning"
            />
            <KpiCard
              icon={Award}
              label="Avg Merit Score"
              value={formatPercent(summary.averageMeritScore)}
              detail="Current merit score average"
              tone="info"
            />
            <KpiCard
              icon={Repeat2}
              label="Replacement Frequency"
              value={summary.totalReplacementFrequency}
              detail="Accepted shift swap participation"
              tone="warning"
            />
          </section>

          {report.guards.length > 0 ? (
            <>
              <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <VerticalBarChart
                  title="Top Guard Merit Scores"
                  rows={sortedByMerit}
                  metricKey="meritScore"
                  suffix="%"
                  tone="info"
                />
                <VerticalBarChart
                  title="Attendance Rate by Guard"
                  rows={sortedByAttendance}
                  metricKey="attendanceRate"
                  suffix="%"
                  tone="success"
                />
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <WorkloadBars rows={sortedByMerit} />
                <VerticalBarChart
                  title="Replacement Frequency"
                  rows={[...report.guards].sort((a, b) => b.replacementFrequency - a.replacementFrequency)}
                  metricKey="replacementFrequency"
                  tone="info"
                />
              </div>

              <section className="table-glass rounded overflow-hidden">
                <div className="border-b border-border-subtle px-4 py-4 md:px-6">
                  <h3 className="text-lg font-bold text-text-primary">Detailed Guard Metrics</h3>
                  <p className="text-sm text-text-secondary">
                    Attendance, punctuality, completion, incident, guard evaluation, merit, and replacement activity.
                  </p>
                </div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[1120px] border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Guard</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Attendance</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Late</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Completed</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">No-shows</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Incidents</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Guard Eval</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Merit</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Replacements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.guards.map((row) => (
                        <tr key={row.guardId} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-sm font-semibold text-text-primary">{row.guardName}</td>
                          <td className="px-4 py-3 text-sm text-text-primary">
                            {formatPercent(row.attendanceRate)}
                            <span className="ml-2 text-xs text-text-secondary">({row.attendedShifts}/{row.totalShifts})</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-warning-text">{row.lateCheckIns}</td>
                          <td className="px-4 py-3 text-sm text-success-text">{row.completedShifts}</td>
                          <td className="px-4 py-3 text-sm text-danger-text">{row.noShows}</td>
                          <td className="px-4 py-3 text-sm text-text-primary">{row.incidentReportsSubmitted}</td>
                          <td className="px-4 py-3 text-sm text-text-primary">
                            {formatRating(row.averageClientRating)}
                            <span className="ml-2 text-xs text-text-secondary">({row.evaluationCount})</span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-info-text">{formatPercent(row.meritScore)}</td>
                          <td className="px-4 py-3 text-sm text-text-primary">{row.replacementFrequency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No performance data available"
              subtitle="Performance metrics will appear after guards receive schedules, attendance records, evaluations, or incident activity."
            />
          )}
        </div>
      )}
    </OperationalShell>
  )
}

export default PerformanceDashboard
