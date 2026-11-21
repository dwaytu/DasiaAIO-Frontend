import { useEffect, useMemo, useState, FC } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  Clock,
  Download,
  Printer,
  Star,
  TrendingUp,
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
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'

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
  shiftsReplaced: number
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

const PERFORMANCE_PAGE_SIZE = 15

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

function formatRating(value: number): string {
  return value > 0 ? value.toFixed(1) : '0.0'
}

function buildReportUrl(filters: DateFilters): string {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  const query = params.toString()
  return `${API_BASE_URL}/api/analytics/guard-performance-report${query ? `?${query}` : ''}`
}

const VerticalBarChart: FC<{
  title: string
  rows: GuardPerformanceRow[]
  metricKey: NumericMetricKey
  suffix?: string
  tone: 'info' | 'success'
}> = ({ title, rows, metricKey, suffix = '', tone }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const chartRows = rows.slice(0, 8)
  const maxValue = Math.max(1, ...chartRows.map((row) => Number(row[metricKey]) || 0))
  const isPercentage = suffix === '%'
  const tickStep = isPercentage ? 25 : Math.max(1, Math.ceil(maxValue / 4))
  const axisMax = isPercentage ? 100 : Math.ceil(maxValue / tickStep) * tickStep
  const ticks = Array.from({ length: axisMax / tickStep + 1 }, (_, index) => index * tickStep)
  const activeRow = chartRows.find((row) => row.guardId === (hoveredId || focusedId))
  const width = 640
  const height = 240
  const padding = { top: 24, right: 16, bottom: 18, left: 32 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const barGap = 10
  const barWidth = chartRows.length > 0
    ? Math.max(20, (plotWidth - barGap * (chartRows.length - 1)) / chartRows.length)
    : 20
  const colorClass = tone === 'success' ? 'text-success-text' : 'text-info-text'

  return (
    <section className="command-panel soc-panel-pad">
      <h3 className="text-lg font-bold text-text-primary">{title}</h3>
      {chartRows.length > 0 ? (
        <>
        <div className="mt-2 min-h-9 text-sm text-text-primary">
          {activeRow && (
            <span role="tooltip" className="inline-block rounded border border-border bg-surface-elevated px-2 py-1">
              {activeRow.guardName} · {activeRow[metricKey]}{suffix}
            </span>
          )}
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`h-64 w-full ${colorClass}`}
          role="group"
          aria-label={title}
        >
          {ticks.map((tick) => {
            const y = padding.top + plotHeight - (tick / axisMax) * plotHeight
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
            const barHeight = (Math.min(rawValue, axisMax) / axisMax) * plotHeight
            const x = padding.left + index * (barWidth + barGap)
            const y = padding.top + plotHeight - barHeight

            return (
              <g
                key={row.guardId}
                tabIndex={0}
                role="img"
                aria-label={`${row.guardName}, ${rawValue}${suffix}`}
                onPointerEnter={() => setHoveredId(row.guardId)}
                onPointerLeave={() => setHoveredId(null)}
                onFocus={() => setFocusedId(row.guardId)}
                onBlur={() => setFocusedId(null)}
              >
                <rect x={x} y={padding.top} width={barWidth} height={plotHeight} fill="transparent" />
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
              </g>
            )
          })}
        </svg>
        </>
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
    <section className="command-panel soc-panel-pad">
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
  const [guardSearch, setGuardSearch] = useState('')
  const [guardPage, setGuardPage] = useState(1)
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
  const filteredGuardRows = useMemo(() => {
    const query = guardSearch.trim().toLocaleLowerCase()
    if (!query) return report.guards
    return report.guards.filter((guard) => `${guard.guardName} ${guard.guardId}`.toLocaleLowerCase().includes(query))
  }, [guardSearch, report.guards])
  const guardPageCount = Math.max(1, Math.ceil(filteredGuardRows.length / PERFORMANCE_PAGE_SIZE))
  const visibleGuardRows = filteredGuardRows.slice((guardPage - 1) * PERFORMANCE_PAGE_SIZE, guardPage * PERFORMANCE_PAGE_SIZE)
  const summary = report.summary
  const periodLabel = report.period.from || report.period.to
    ? `${report.period.from ?? 'Start'} to ${report.period.to ?? 'Present'}`
    : 'All recorded operations'
  const attendanceTone = summary.averageAttendanceRate >= 90 ? 'success' : summary.averageAttendanceRate >= 75 ? 'warning' : 'danger'
  const missedDutyTone = summary.totalNoShows > 0 ? 'danger' : 'success'
  const focusMessage = summary.totalNoShows > 0
    ? `${summary.totalNoShows} missed ${summary.totalNoShows === 1 ? 'duty needs' : 'duties need'} review.`
    : summary.totalLateCheckIns > 0
      ? `${summary.totalLateCheckIns} late check-in${summary.totalLateCheckIns === 1 ? '' : 's'} need follow-up.`
      : 'No missed duties or late check-ins in this period.'
  const focusClass = summary.totalNoShows > 0 || summary.totalLateCheckIns > 0
    ? 'border-warning-border bg-warning-bg text-warning-text'
    : 'border-success-border bg-success-bg text-success-text'

  useEffect(() => {
    setGuardPage((page) => Math.min(page, guardPageCount))
  }, [guardPageCount])

  const applyFilters = () => {
    setGuardPage(1)
    setAppliedFilters(filters)
  }

  const clearFilters = () => {
    const empty = { from: '', to: '' }
    setFilters(empty)
    setGuardPage(1)
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
            <OperationalPageHeader
              eyebrow="Performance analytics"
              title="Guard Performance Report"
              description="Review attendance, outcomes, and evaluations, then follow up on the exceptions that need attention."
              icon={TrendingUp}
              status={<span className="soc-status-neutral">Period: {periodLabel}</span>}
              actions={(
                <>
                  <button
                    type="button"
                    onClick={downloadCsv}
                    disabled={report.guards.length === 0}
                    className="soc-btn soc-btn-neutral inline-flex min-h-11 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="soc-btn soc-btn-neutral inline-flex min-h-11 items-center justify-center gap-2"
                  >
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    Print
                  </button>
                </>
              )}
            />

            <div className={`mt-4 border-l-4 px-3 py-3 text-sm ${focusClass}`} role="status">
              <span className="font-semibold">Review next:</span> {focusMessage}
            </div>

            <form
              className="mt-4 grid grid-cols-1 gap-3 rounded border border-border-subtle bg-surface-elevated p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault()
                applyFilters()
              }}
            >
              <p className="sm:col-span-2 xl:col-span-4 text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary">Reporting period</p>
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
              <button type="submit" className="soc-btn min-h-11 self-end">
                Apply period
              </button>
              <button type="button" onClick={clearFilters} className="soc-btn soc-btn-neutral min-h-11 self-end">
                Clear
              </button>
            </form>
          </section>

          {error ? (
            <div className="mb-4 rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text" role="alert">
              {error}
            </div>
          ) : null}

          <div className="mb-4">
            <OperationalSummaryBand
              items={[
                {
                  label: 'Attendance',
                  value: formatPercent(summary.averageAttendanceRate),
                  detail: `${summary.totalGuards} guard${summary.totalGuards === 1 ? '' : 's'} tracked`,
                  tone: attendanceTone,
                  icon: TrendingUp,
                },
                {
                  label: 'Missed duties',
                  value: summary.totalNoShows,
                  detail: 'Review each recorded absence',
                  tone: missedDutyTone,
                  icon: AlertTriangle,
                },
                {
                  label: 'Late check-ins',
                  value: summary.totalLateCheckIns,
                  detail: 'Punctuality exceptions',
                  tone: summary.totalLateCheckIns > 0 ? 'warning' : 'success',
                  icon: Clock,
                },
                {
                  label: 'Completed shifts',
                  value: summary.totalCompletedShifts,
                  detail: 'Completed duties',
                  tone: 'success',
                  icon: CalendarCheck,
                },
                {
                  label: 'Evaluation rating',
                  value: formatRating(summary.averageClientRating),
                  detail: 'Average recorded evaluation',
                  tone: 'info',
                  icon: Star,
                },
              ]}
            />
            <p className="mt-2 text-xs text-text-secondary">
              Detailed metrics below include incident reports, merit score, and replacement activity.
            </p>
          </div>

          {report.guards.length > 0 ? (
            <>
              <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <VerticalBarChart
                  title="Top Reporting-Period Merit Scores"
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
                  title="Confirmed Shifts Covered"
                  rows={[...report.guards].sort((a, b) => b.replacementFrequency - a.replacementFrequency)}
                  metricKey="replacementFrequency"
                  tone="info"
                />
              </div>

              <section className="table-glass rounded overflow-hidden">
                <div className="border-b border-border-subtle px-4 py-4 md:px-6">
                  <h3 className="text-lg font-bold text-text-primary">Detailed Guard Metrics</h3>
                  <p className="text-sm text-text-secondary">
                    Attendance uses shifts that have started. No-shows are recorded absences. Incident reports count submissions by the guard.
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">Period merit uses attendance (30%), punctuality (35%), and evaluations (35%). Replacement counts show each guard’s role in accepted Smart Guard Replacement records.</p>
                  <label className="mt-4 block max-w-md text-sm font-semibold text-text-secondary" htmlFor="performance-guard-search">
                    Find a guard
                    <input
                      id="performance-guard-search"
                      value={guardSearch}
                      onChange={(event) => { setGuardSearch(event.target.value); setGuardPage(1) }}
                      className="soc-input mt-1 w-full"
                      placeholder="Search by guard name or Guard ID"
                    />
                  </label>
                  <p className="mt-2 text-sm text-text-secondary" role="status" aria-live="polite">{filteredGuardRows.length} matching guard{filteredGuardRows.length === 1 ? '' : 's'}; page {guardPage} of {guardPageCount}.</p>
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
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Reports filed</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Guard Eval</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Period merit</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Shifts covered</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-primary">Shifts replaced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleGuardRows.map((row) => (
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
                            {row.evaluationCount > 0 ? formatRating(row.averageClientRating) : '—'}
                            <span className="ml-2 text-xs text-text-secondary">({row.evaluationCount})</span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-info-text">{formatPercent(row.meritScore)}</td>
                          <td className="px-4 py-3 text-sm text-text-primary">{row.replacementFrequency}</td>
                          <td className="px-4 py-3 text-sm text-text-primary">{row.shiftsReplaced ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 md:px-6" aria-label="Performance report pages">
                  <p className="text-sm text-text-secondary">Showing {filteredGuardRows.length === 0 ? 0 : (guardPage - 1) * PERFORMANCE_PAGE_SIZE + 1}-{Math.min(guardPage * PERFORMANCE_PAGE_SIZE, filteredGuardRows.length)} of {filteredGuardRows.length}</p>
                  <div className="flex gap-2">
                    <button type="button" className="soc-btn soc-btn-neutral min-h-11 px-3" disabled={guardPage === 1} onClick={() => setGuardPage((page) => Math.max(1, page - 1))}>Previous</button>
                    <button type="button" className="soc-btn soc-btn-neutral min-h-11 px-3" disabled={guardPage === guardPageCount} onClick={() => setGuardPage((page) => Math.min(guardPageCount, page + 1))}>Next</button>
                  </div>
                </nav>
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
