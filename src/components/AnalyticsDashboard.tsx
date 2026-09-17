import { useState, useEffect, useCallback, useId, useRef, FC } from 'react'
import { BarChart3, TrendingUp, Filter, RefreshCw, Printer } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { sanitizeErrorMessage } from '../utils/sanitize'
import type { User } from '../context/AuthContext'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'
import EmptyState from './shared/EmptyState'
import DashboardCard from './dashboard/ui/DashboardCard'
import StatusBadge from './dashboard/ui/StatusBadge'
import LiveFreshnessPill from './dashboard/ui/LiveFreshnessPill'
import MetricStatCard from './dashboard/ui/MetricStatCard'
import { DashboardLoadingState } from './dashboard/ui/DashboardLoadingState'
import { formatCompactNumber, formatRatioLabel } from '../utils/numberFormat'
import { resolveUnavailable } from '../utils/analyticsPresentation'

interface AnalyticsDashboardProps {
  user: User
  onLogout: () => void
  onViewChange: (view: string) => void
  activeView: string
}

interface AnalyticsData {
  overview: {
    total_guards: number
    active_guards: number
    total_missions: number
    completed_missions: number
    active_missions: number
    total_firearms: number
    allocated_firearms: number
    total_vehicles: number
    deployed_vehicles: number
  }
  performance_metrics: {
    mission_completion_rate: number
    average_mission_duration: number
    guard_attendance_rate: number
    firearm_availability_rate: number
    vehicle_utilization_rate: number
  }
  resource_utilization: {
    firearms_in_use: number
    firearms_available: number
    firearms_unavailable: number
    vehicles_deployed: number
    vehicles_available: number
    vehicles_unavailable: number
    guards_on_duty: number
    guards_available: number
    guards_unavailable?: number
  }
  mission_stats: {
    total_missions_this_month: number
    completed_missions_this_month: number
    pending_missions: number
    average_guards_per_mission: number
    average_duration_hours: number
  }
  attendance_analytics: {
    period_days: number
    total_scheduled_shifts: number
    attended_shifts: number
    on_time_check_ins: number
    late_check_ins: number
    no_shows: number
    attendance_rate: number
  }
  attendance_trend: Array<{
    date: string
    scheduled_shifts: number
    attended_shifts: number
    late_check_ins: number
    no_shows: number
  }>
  evaluation_analytics?: {
    period_days: number
    total_evaluations: number
    guards_evaluated: number
    average_rating: number
    low_rating_count: number
    rating_distribution: Array<{
      rating: number
      count: number
    }>
  }
  evaluation_trend?: Array<{
    date: string
    average_rating: number
    evaluation_count: number
  }>
}

/* ── SVG Chart Components ─────────────────────────────────── */

interface BarChartData { label: string; value: number }

function SimpleBarChart({ data, height = 200, barColor = 'var(--color-info-border)' }: { data: BarChartData[]; height?: number; barColor?: string }) {
  if (data.length === 0) return null
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const padding = { top: 16, right: 12, bottom: 36, left: 12 }
  const chartWidth = 400
  const chartHeight = height
  const innerW = chartWidth - padding.left - padding.right
  const innerH = chartHeight - padding.top - padding.bottom
  const barGap = 8
  const barWidth = Math.max(12, (innerW - barGap * (data.length - 1)) / data.length)

  const description = `Bar chart showing: ${data.map(d => `${d.label}: ${d.value}`).join(', ')}`

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="w-full"
      style={{ height: `${height}px`, maxHeight: `${height}px` }}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      {data.map((d, i) => {
        const barH = maxVal > 0 ? (d.value / maxVal) * innerH : 0
        const x = padding.left + i * (barWidth + barGap)
        const y = padding.top + innerH - barH
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={3}
              fill={barColor}
              className="transition-all duration-300"
              style={{ opacity: 0.85 }}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={y - 6}
              textAnchor="middle"
              fill="var(--color-text-primary)"
              style={{ fontSize: '11px', fontWeight: 600 }}
            >
              {d.value}
            </text>
            <text
              x={x + barWidth / 2}
              y={chartHeight - 8}
              textAnchor="middle"
              fill="var(--color-text-secondary)"
              style={{ fontSize: '10px' }}
            >
              {d.label}
            </text>
          </g>
        )
      })}
      <line
        x1={padding.left}
        y1={padding.top + innerH}
        x2={padding.left + innerW}
        y2={padding.top + innerH}
        stroke="var(--color-border-elevated)"
        strokeWidth={1}
      />
    </svg>
  )
}

interface LineChartData { label: string; value: number }

function SimpleLineChart({
  data,
  height = 200,
  lineColor = 'var(--color-success-text)',
  maxValue,
  suffix = '%',
}: {
  data: LineChartData[]
  height?: number
  lineColor?: string
  maxValue?: number
  suffix?: string
}) {
  const gradientId = useId()
  if (data.length === 0) return null
  const maxVal = Math.max(maxValue ?? 0, ...data.map(d => d.value), 1)
  const minVal = Math.min(...data.map(d => d.value), 0)
  const range = maxVal - minVal || 1
  const padding = { top: 20, right: 16, bottom: 36, left: 16 }
  const chartWidth = 400
  const chartHeight = height
  const innerW = chartWidth - padding.left - padding.right
  const innerH = chartHeight - padding.top - padding.bottom

  const points = data.map((d, i) => ({
    x: padding.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2),
    y: padding.top + innerH - ((d.value - minVal) / range) * innerH,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`

  const description = `Line chart showing: ${data.map(d => `${d.label}: ${d.value}${suffix}`).join(', ')}`

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="w-full"
      style={{ height: `${height}px`, maxHeight: `${height}px` }}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={data[i].label}>
          <circle cx={p.x} cy={p.y} r={4} fill={lineColor} stroke="var(--color-surface)" strokeWidth={2}>
            <title>{`${data[i].label}: ${data[i].value}${suffix}`}</title>
          </circle>
          <text
            x={p.x}
            y={chartHeight - 8}
            textAnchor="middle"
            fill="var(--color-text-secondary)"
            style={{ fontSize: '10px' }}
          >
            {data[i].label}
          </text>
        </g>
      ))}
      <line
        x1={padding.left}
        y1={padding.top + innerH}
        x2={padding.left + innerW}
        y2={padding.top + innerH}
        stroke="var(--color-border-elevated)"
        strokeWidth={1}
      />
    </svg>
  )
}

interface AvailabilityRow {
  label: string
  available: number
  unavailable: number
}

function AvailabilityComparison({ rows }: { rows: AvailabilityRow[] }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 text-xs text-text-secondary" aria-hidden="true">
        <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: 'var(--color-success)' }} />Available</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: 'var(--color-danger)' }} />Unavailable</span>
      </div>
      {rows.map((row) => {
        const total = row.available + row.unavailable
        const availablePercent = total > 0 ? (row.available / total) * 100 : 0
        const unavailablePercent = total > 0 ? 100 - availablePercent : 0

        return (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-text-primary">{row.label}</span>
              <span className="text-xs tabular-nums text-text-secondary">
                {row.available} available / {row.unavailable} unavailable
              </span>
            </div>
            <div
              className="flex h-4 w-full overflow-hidden rounded"
              role="img"
              aria-label={`${row.label}: ${row.available} available and ${row.unavailable} unavailable`}
              style={{ backgroundColor: 'var(--color-border)' }}
            >
              <div className="h-full" style={{ width: `${availablePercent}%`, backgroundColor: 'var(--color-success)' }} />
              <div className="h-full" style={{ width: `${unavailablePercent}%`, backgroundColor: 'var(--color-danger)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Constants & Helpers ──────────────────────────────────── */

const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const

const BASE_POLL_INTERVAL_MS = 30000
const MAX_POLL_INTERVAL_MS = 300000

const AnalyticsDashboard: FC<AnalyticsDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [failCount, setFailCount] = useState(0)
  const [pollNonce, setPollNonce] = useState(0)
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now())
  const [dateRange, setDateRange] = useState('30')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const formatTime = useCallback((value: number) => {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [])

  const toUserFacingError = useCallback((message: string): string => {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes('session expired') || lowerMessage.includes('log in again')) {
      return 'Session expired -- please re-authenticate'
    }

    if (lowerMessage.includes('timed out')) {
      return 'Analytics service timed out -- showing last known data'
    }

    if (lowerMessage.includes('offline')) {
      return 'You appear to be offline'
    }

    return 'Unable to refresh analytics -- showing last known data'
  }, [])

  const fetchAnalytics = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchJsonOrThrow<AnalyticsData>(`${API_BASE_URL}/api/analytics?days=${encodeURIComponent(dateRange)}`, {
        headers: getAuthHeaders(),
        signal,
      }, 'Failed to fetch analytics')

      setAnalytics(data)
      setLastRefreshAt(Date.now())
      setError('')
      setFailCount(0)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const rawMessage = sanitizeErrorMessage(err instanceof Error ? err.message : 'Failed to load analytics')
      setError(toUserFacingError(rawMessage))
      setFailCount((previousCount) => previousCount + 1)
    } finally {
      setLoading(false)
    }
  }, [dateRange, toUserFacingError])

  const handleRetry = useCallback(() => {
    if (!analytics) {
      setLoading(true)
    }
    setError('')
    setFailCount(0)
    setPollNonce((value) => value + 1)
    void fetchAnalytics()
  }, [analytics, fetchAnalytics])

  useEffect(() => {
    const controller = new AbortController()
    void fetchAnalytics(controller.signal)
    return () => {
      controller.abort()
    }
  }, [fetchAnalytics])

  useEffect(() => {
    const controller = new AbortController()
    const intervalMs = Math.min(BASE_POLL_INTERVAL_MS * Math.pow(2, failCount), MAX_POLL_INTERVAL_MS)

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(() => {
      void fetchAnalytics(controller.signal)
    }, intervalMs)

    return () => {
      controller.abort()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [failCount, fetchAnalytics, pollNonce])

  const homeView = user.role === 'guard' ? 'overview' : 'dashboard'
  const navItems = getSidebarNav(user.role, { homeView })

  if (loading && !analytics) {
    return (
      <OperationalShell
        user={user}
        title="ANALYTICS"
        navItems={navItems}
        activeView={activeView}
        onNavigate={onViewChange}
        onLogout={onLogout}
        mobileMenuOpen={mobileMenuOpen}
        onMenuOpen={() => setMobileMenuOpen(true)}
        onMenuClose={() => setMobileMenuOpen(false)}
        onLogoClick={() => onViewChange(homeView)}
      >
        <DashboardLoadingState
          title="Operational Intelligence"
          subtitle="Performance and utilization overview refreshed every 30 seconds."
          heroCards={4}
          lowerSections={3}
        />
      </OperationalShell>
    )
  }

  if (!analytics && error) {
    return (
      <OperationalShell
        user={user}
        title="ANALYTICS"
        navItems={navItems}
        activeView={activeView}
        onNavigate={onViewChange}
        onLogout={onLogout}
        mobileMenuOpen={mobileMenuOpen}
        onMenuOpen={() => setMobileMenuOpen(true)}
        onMenuClose={() => setMobileMenuOpen(false)}
        onLogoClick={() => onViewChange(homeView)}
      >
        <div className="space-y-4">
          <div className="soc-alert-error">
            <p className="font-semibold">Failed to load analytics data</p>
            <p className="text-xs mt-1">{error}</p>
            <p className="text-xs mt-2">Make sure the backend server is running on port 5000</p>
          </div>
          <button type="button" onClick={handleRetry} className="soc-btn soc-btn-danger">
            Retry
          </button>
        </div>
      </OperationalShell>
    )
  }

  if (!analytics && !error) {
    return (
      <OperationalShell
        user={user}
        title="ANALYTICS"
        navItems={navItems}
        activeView={activeView}
        onNavigate={onViewChange}
        onLogout={onLogout}
        mobileMenuOpen={mobileMenuOpen}
        onMenuOpen={() => setMobileMenuOpen(true)}
        onMenuClose={() => setMobileMenuOpen(false)}
        onLogoClick={() => onViewChange(homeView)}
      >
        <EmptyState icon={BarChart3} title="No analytics data yet" subtitle="Analytics will populate as operations are recorded" />
      </OperationalShell>
    )
  }

  // At this point analytics is guaranteed non-null (guarded above)
  if (!analytics) return null

  const guardUnavailable = resolveUnavailable(
    analytics.overview.total_guards,
    analytics.resource_utilization.guards_available,
    analytics.resource_utilization.guards_unavailable,
  )
  const evaluationAnalytics = analytics.evaluation_analytics ?? {
    period_days: Number(dateRange),
    total_evaluations: 0,
    guards_evaluated: 0,
    average_rating: 0,
    low_rating_count: 0,
    rating_distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })),
  }

  const resourceBars = [
    {
      label: 'Firearms',
      inUse: analytics.resource_utilization.firearms_in_use,
      total: analytics.resource_utilization.firearms_available + analytics.resource_utilization.firearms_unavailable,
      tone: 'bg-warning-border',
    },
    {
      label: 'Vehicles',
      inUse: analytics.resource_utilization.vehicles_deployed,
      total: analytics.resource_utilization.vehicles_available + analytics.resource_utilization.vehicles_unavailable,
      tone: 'bg-info-border',
    },
    {
      label: 'Guards',
      inUse: analytics.resource_utilization.guards_on_duty,
      total: analytics.resource_utilization.guards_available + guardUnavailable,
      tone: 'bg-success-border',
    },
  ]

  const missionCompletion = analytics.performance_metrics.mission_completion_rate
  const missionTrendTone = missionCompletion >= 85 ? 'success' : missionCompletion >= 65 ? 'warning' : 'danger'

  const resourceAvailabilityRows: AvailabilityRow[] = [
    {
      label: 'Guards',
      available: analytics.resource_utilization.guards_available,
      unavailable: guardUnavailable,
    },
    {
      label: 'Firearms',
      available: analytics.resource_utilization.firearms_available,
      unavailable: analytics.resource_utilization.firearms_unavailable,
    },
    {
      label: 'Vehicles',
      available: analytics.resource_utilization.vehicles_available,
      unavailable: analytics.resource_utilization.vehicles_unavailable,
    },
  ]

  const attendanceBreakdownData: BarChartData[] = [
    { label: 'Scheduled', value: analytics.attendance_analytics.total_scheduled_shifts },
    { label: 'Attended', value: analytics.attendance_analytics.attended_shifts },
    { label: 'On Time', value: analytics.attendance_analytics.on_time_check_ins },
    { label: 'Late', value: analytics.attendance_analytics.late_check_ins },
    { label: 'No Shows', value: analytics.attendance_analytics.no_shows },
  ]

  const attendanceTrendData: LineChartData[] = analytics.attendance_trend
    .filter((_, index, trend) => trend.length <= 14 || index % Math.ceil(trend.length / 14) === 0)
    .map((point) => ({
      label: new Date(`${point.date}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      value: point.scheduled_shifts > 0 ? (point.attended_shifts / point.scheduled_shifts) * 100 : 0,
    }))

  const evaluationDistributionData: BarChartData[] = evaluationAnalytics.rating_distribution
    .map((bucket) => ({ label: `${bucket.rating} Star`, value: bucket.count }))

  const evaluationTrendData: LineChartData[] = (analytics.evaluation_trend ?? [])
    .filter((_, index, trend) => trend.length <= 14 || index % Math.ceil(trend.length / 14) === 0)
    .map((point) => ({
      label: new Date(`${point.date}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      value: point.average_rating,
    }))

  const completedPercent = analytics.mission_stats.total_missions_this_month > 0
    ? Math.round((analytics.mission_stats.completed_missions_this_month / analytics.mission_stats.total_missions_this_month) * 100)
    : 0

  return (
    <OperationalShell
      user={user}
      title="ANALYTICS"
      navItems={navItems}
      activeView={activeView}
      onNavigate={onViewChange}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange(homeView)}
    >
    <div className="analytics-print-report space-y-6">
      <div className="hidden analytics-print-heading">
        <p className="soc-label">SENTINEL Operational Analytics</p>
        <h1 className="soc-page-title">Analytics Report</h1>
        <p className="mt-1 text-sm">Period: last {dateRange} days | Generated {new Date(lastRefreshAt).toLocaleString()}</p>
      </div>
      {/* ── Hero Zone ──────────────────────────────────── */}
      <section className="soc-dashboard-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="soc-label mb-1">Total Missions This Month</p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-black leading-none text-text-primary">
                {formatCompactNumber(analytics.mission_stats.total_missions_this_month)}
              </span>
              <span className="flex items-center gap-1 text-sm font-semibold text-success">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                {completedPercent}% completed
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {formatCompactNumber(analytics.mission_stats.completed_missions_this_month)} completed / {formatCompactNumber(analytics.mission_stats.pending_missions)} pending
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LiveFreshnessPill updatedAt={lastRefreshAt} label="Analytics feed" />
            <StatusBadge label={`Completion ${missionCompletion.toFixed(1)}%`} tone={missionTrendTone} />
            <button
              type="button"
              onClick={() => window.print()}
              className="soc-btn soc-btn-neutral analytics-print-control"
              aria-label="Print analytics report"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Print
            </button>
          </div>
        </div>
      </section>

      {error && analytics && (
        <div
          className="rounded border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-text"
          role="status"
          aria-live="polite"
        >
          <span className="font-semibold">Stale data</span> -- {error}. Showing last known data from {formatTime(lastRefreshAt)}.
          <button
            type="button"
            onClick={handleRetry}
            className="analytics-print-control ml-2 font-semibold underline"
          >
            Retry now
          </button>
        </div>
      )}

      {/* ── KPI Row ────────────────────────────────────── */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard
            label="Guards On Duty"
            value={formatCompactNumber(analytics.overview.active_guards)}
            hint={`${formatCompactNumber(analytics.overview.total_guards)} total personnel`}
            tone="guard"
            meter={{
              value: analytics.overview.active_guards,
              max: analytics.overview.total_guards,
              label: formatRatioLabel(analytics.overview.active_guards, analytics.overview.total_guards, 'on duty'),
            }}
          />
          <MetricStatCard
            label="Active Missions"
            value={formatCompactNumber(analytics.overview.active_missions)}
            hint={`${formatCompactNumber(analytics.overview.completed_missions)} completed`}
            tone="mission"
            meter={{
              value: analytics.overview.active_missions,
              max: analytics.overview.total_missions,
              label: formatRatioLabel(analytics.overview.active_missions, analytics.overview.total_missions, 'active'),
            }}
          />
          <MetricStatCard
            label="Allocated Firearms"
            value={formatCompactNumber(analytics.overview.allocated_firearms)}
            hint={`${formatCompactNumber(analytics.overview.total_firearms)} total assets`}
            tone="maintenance"
            meter={{
              value: analytics.overview.allocated_firearms,
              max: analytics.overview.total_firearms,
              label: formatRatioLabel(analytics.overview.allocated_firearms, analytics.overview.total_firearms, 'issued'),
            }}
          />
          <MetricStatCard
            label="Deployed Vehicles"
            value={formatCompactNumber(analytics.overview.deployed_vehicles)}
            hint={`${formatCompactNumber(analytics.overview.total_vehicles)} fleet total`}
            tone="vehicle"
            meter={{
              value: analytics.overview.deployed_vehicles,
              max: analytics.overview.total_vehicles,
              label: formatRatioLabel(analytics.overview.deployed_vehicles, analytics.overview.total_vehicles, 'deployed'),
            }}
          />
        </div>
      </section>

      {/* ── Filter Bar ─────────────────────────────────── */}
      <section className="analytics-print-control soc-dashboard-card flex flex-wrap items-center gap-3 !px-4 !py-3">
        <Filter className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <label htmlFor="analytics-date-range" className="text-xs font-medium text-text-secondary">Period</label>
          <select
            id="analytics-date-range"
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-info-border"
          >
            {DATE_RANGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="ml-auto flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-info-border"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Refresh
        </button>
      </section>

      {/* ── Charts Row ─────────────────────────────────── */}
      <section aria-label="Analytics charts">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DashboardCard title="Resource Availability">
            <AvailabilityComparison rows={resourceAvailabilityRows} />
          </DashboardCard>
          <DashboardCard title="Guard Evaluation Trend">
            {evaluationTrendData.length > 0 ? (
              <SimpleLineChart
                data={evaluationTrendData}
                height={220}
                lineColor="var(--color-info-text)"
                maxValue={5}
                suffix="/5"
              />
            ) : (
              <p className="py-20 text-center text-sm text-text-secondary">No guard evaluations for the selected period.</p>
            )}
          </DashboardCard>
        </div>
      </section>

      <section aria-label="Guard attendance analytics">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DashboardCard title="Guard Attendance Breakdown">
            <SimpleBarChart data={attendanceBreakdownData} height={220} barColor="var(--color-success-text)" />
            <p className="mt-2 text-center text-xs text-text-secondary">
              {analytics.attendance_analytics.attendance_rate.toFixed(1)}% attendance rate over the last {analytics.attendance_analytics.period_days} days
            </p>
          </DashboardCard>
          <DashboardCard title="Guard Attendance Trend">
            {attendanceTrendData.length > 0 ? (
              <SimpleLineChart data={attendanceTrendData} height={220} lineColor="var(--color-success-text)" maxValue={100} />
            ) : (
              <p className="py-20 text-center text-sm text-text-secondary">No attendance records for the selected period.</p>
            )}
            <p className="mt-2 text-center text-xs text-text-secondary">Daily attended shifts as a percentage of scheduled shifts</p>
          </DashboardCard>
        </div>
      </section>

      <section aria-label="Guard evaluation analytics" className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard
            label="Average Guard Rating"
            value={`${evaluationAnalytics.average_rating.toFixed(1)}/5`}
            hint={`Across ${evaluationAnalytics.total_evaluations} evaluation${evaluationAnalytics.total_evaluations === 1 ? '' : 's'}`}
            tone="analytics"
          />
          <MetricStatCard
            label="Guards Evaluated"
            value={formatCompactNumber(evaluationAnalytics.guards_evaluated)}
            hint={`During the last ${evaluationAnalytics.period_days} days`}
            tone="guard"
          />
          <MetricStatCard
            label="Evaluation Records"
            value={formatCompactNumber(evaluationAnalytics.total_evaluations)}
            hint="Verified supervisor and administrator evaluation entries"
            tone="default"
          />
          <MetricStatCard
            label="Low Ratings"
            value={formatCompactNumber(evaluationAnalytics.low_rating_count)}
            hint="Ratings below 3 out of 5"
            tone="maintenance"
          />
        </div>
        <DashboardCard title="Guard Evaluation Distribution">
          <SimpleBarChart data={evaluationDistributionData} height={220} barColor="var(--color-info-border)" />
          <p className="mt-2 text-center text-xs text-text-secondary">Summary based on evaluations recorded by supervisors and administrators.</p>
        </DashboardCard>
      </section>

      {/* ── Performance Metrics ────────────────────────── */}
      {/* ── Operational Narrative ──────────────────────── */}
      {/* ── Mission Statistics ─────────────────────────── */}
      {/* ── Resource Utilization ───────────────────────── */}
      <DashboardCard title="Resource Utilization">
        <div className="space-y-4">
          {resourceBars.map((resource) => {
            const ratio = resource.total > 0 ? (resource.inUse / resource.total) * 100 : 0
            return (
              <div key={resource.label}>
                <div className="mb-2 flex justify-between">
                  <span className="text-sm font-medium text-text-secondary">{resource.label}</span>
                  <span className="text-sm text-text-tertiary">
                    {resource.inUse} active / {resource.total} total
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-border">
                  <div
                    className={`${resource.tone} h-3 rounded-full transition-all duration-300`}
                    style={{ width: `${ratio}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(ratio)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${resource.label} utilization ${Math.round(ratio)} percent`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </DashboardCard>
    </div>
    </OperationalShell>
  )
}

export default AnalyticsDashboard
