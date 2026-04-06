import { useState, useEffect, useCallback, useId, FC } from 'react'
import { BarChart3, TrendingUp, Filter, RefreshCw } from 'lucide-react'
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
    vehicles_deployed: number
    vehicles_available: number
    guards_on_duty: number
    guards_available: number
  }
  mission_stats: {
    total_missions_this_month: number
    completed_missions_this_month: number
    pending_missions: number
    average_guards_per_mission: number
    average_duration_hours: number
  }
}

interface InsightItem {
  id: string
  title: string
  detail: string
  tone: 'success' | 'warning' | 'danger' | 'analytics'
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
              className="fill-text-secondary"
              style={{ fontSize: '11px', fontWeight: 600 }}
            >
              {d.value}
            </text>
            <text
              x={x + barWidth / 2}
              y={chartHeight - 8}
              textAnchor="middle"
              className="fill-text-tertiary"
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
        className="stroke-border"
        strokeWidth={1}
      />
    </svg>
  )
}

interface LineChartData { label: string; value: number }

function SimpleLineChart({ data, height = 200, lineColor = 'var(--color-success-text)' }: { data: LineChartData[]; height?: number; lineColor?: string }) {
  const gradientId = useId()
  if (data.length === 0) return null
  const maxVal = Math.max(...data.map(d => d.value), 1)
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

  const description = `Line chart showing: ${data.map(d => `${d.label}: ${d.value}%`).join(', ')}`

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
            <title>{`${data[i].label}: ${data[i].value}%`}</title>
          </circle>
          <text
            x={p.x}
            y={chartHeight - 8}
            textAnchor="middle"
            className="fill-text-tertiary"
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
        className="stroke-border"
        strokeWidth={1}
      />
    </svg>
  )
}

/* ── Constants & Helpers ──────────────────────────────────── */

const KPI_TARGETS = {
  missionCompletionRate: 90,
  guardAttendanceRate: 95,
  firearmAvailabilityRate: 98,
  vehicleUtilizationRate: 80,
}

const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const

function formatPointDelta(value: number): string {
  if (Math.abs(value) < 0.1) return 'On target'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} pts vs target`
}

function getTrendFromDelta(delta: number): 'up' | 'down' | 'flat' {
  if (delta > 0.1) return 'up'
  if (delta < -0.1) return 'down'
  return 'flat'
}

const AnalyticsDashboard: FC<AnalyticsDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now())
  const [dateRange, setDateRange] = useState('30')

  const fetchAnalytics = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchJsonOrThrow<AnalyticsData>(`${API_BASE_URL}/api/analytics`, {
        headers: getAuthHeaders(),
        signal,
      }, 'Failed to fetch analytics')

      setAnalytics(data)
      setLastRefreshAt(Date.now())
      setError('')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(sanitizeErrorMessage(err instanceof Error ? err.message : 'Failed to load analytics'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchAnalytics(controller.signal)
    const interval = setInterval(() => fetchAnalytics(controller.signal), 30000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [fetchAnalytics])

  const homeView = user.role === 'guard' ? 'overview' : 'dashboard'
  const navItems = getSidebarNav(user.role, { homeView })

  if (loading) {
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

  if (error) {
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
          <button type="button" onClick={() => fetchAnalytics()} className="soc-btn soc-btn-danger">
            Retry
          </button>
        </div>
      </OperationalShell>
    )
  }

  if (!analytics) {
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

  const resourceBars = [
    {
      label: 'Firearms',
      inUse: analytics.resource_utilization.firearms_in_use,
      total: analytics.resource_utilization.firearms_in_use + analytics.resource_utilization.firearms_available,
      tone: 'bg-warning-border',
    },
    {
      label: 'Vehicles',
      inUse: analytics.resource_utilization.vehicles_deployed,
      total: analytics.resource_utilization.vehicles_deployed + analytics.resource_utilization.vehicles_available,
      tone: 'bg-info-border',
    },
    {
      label: 'Guards',
      inUse: analytics.resource_utilization.guards_on_duty,
      total: analytics.resource_utilization.guards_on_duty + analytics.resource_utilization.guards_available,
      tone: 'bg-success-border',
    },
  ]

  const missionCompletion = analytics.performance_metrics.mission_completion_rate
  const missionTrendTone = missionCompletion >= 85 ? 'success' : missionCompletion >= 65 ? 'warning' : 'danger'
  const missionCompletionDelta = missionCompletion - KPI_TARGETS.missionCompletionRate
  const guardAttendanceDelta = analytics.performance_metrics.guard_attendance_rate - KPI_TARGETS.guardAttendanceRate
  const firearmAvailabilityDelta = analytics.performance_metrics.firearm_availability_rate - KPI_TARGETS.firearmAvailabilityRate
  const vehicleUtilizationDelta = analytics.performance_metrics.vehicle_utilization_rate - KPI_TARGETS.vehicleUtilizationRate

  const operationalInsights: InsightItem[] = (() => {
    const insights: InsightItem[] = []

    if (missionCompletionDelta < -8) {
      insights.push({
        id: 'mission-completion-risk',
        title: 'Mission throughput below command target',
        detail: `Completion is ${Math.abs(missionCompletionDelta).toFixed(1)} points below target. Review unfinished assignments and rebalance active teams.`,
        tone: 'danger',
      })
    } else {
      insights.push({
        id: 'mission-completion-stable',
        title: 'Mission execution stable',
        detail: `Completion trend is ${formatPointDelta(missionCompletionDelta)}. Maintain current dispatch cadence.`,
        tone: 'success',
      })
    }

    if (guardAttendanceDelta < -4) {
      insights.push({
        id: 'attendance-watch',
        title: 'Guard attendance needs intervention',
        detail: `Attendance sits ${Math.abs(guardAttendanceDelta).toFixed(1)} points below target. Trigger supervisor check-ins for high-risk posts.`,
        tone: 'warning',
      })
    }

    if (analytics.mission_stats.pending_missions > analytics.mission_stats.completed_missions_this_month * 0.45) {
      insights.push({
        id: 'pending-backlog',
        title: 'Pending mission backlog building',
        detail: 'Pending missions exceed healthy backlog limits. Prioritize delayed missions in the next roster cycle.',
        tone: 'warning',
      })
    }

    if (vehicleUtilizationDelta > 8) {
      insights.push({
        id: 'fleet-saturation',
        title: 'Fleet utilization nearing saturation',
        detail: `Vehicle usage is ${vehicleUtilizationDelta.toFixed(1)} points above baseline. Reserve backup units to reduce mission risk.`,
        tone: 'analytics',
      })
    }

    return insights.slice(0, 4)
  })()

  const barChartData: BarChartData[] = [
    { label: 'Guards Active', value: analytics.resource_utilization.guards_on_duty },
    { label: 'Guards Avail', value: analytics.resource_utilization.guards_available },
    { label: 'Firearms Used', value: analytics.resource_utilization.firearms_in_use },
    { label: 'Firearms Avail', value: analytics.resource_utilization.firearms_available },
    { label: 'Vehicles Out', value: analytics.resource_utilization.vehicles_deployed },
    { label: 'Vehicles Avail', value: analytics.resource_utilization.vehicles_available },
  ]

  const lineChartData: LineChartData[] = [
    { label: 'Completion', value: analytics.performance_metrics.mission_completion_rate },
    { label: 'Attendance', value: analytics.performance_metrics.guard_attendance_rate },
    { label: 'Firearms', value: analytics.performance_metrics.firearm_availability_rate },
    { label: 'Vehicles', value: analytics.performance_metrics.vehicle_utilization_rate },
  ]

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
    <div className="space-y-6">
      {/* ── Hero Zone ──────────────────────────────────── */}
      <section className="command-panel p-5">
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
              {formatCompactNumber(analytics.mission_stats.completed_missions_this_month)} completed · {formatCompactNumber(analytics.mission_stats.pending_missions)} pending
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LiveFreshnessPill updatedAt={lastRefreshAt} label="Analytics feed" />
            <StatusBadge label={`Completion ${missionCompletion.toFixed(1)}%`} tone={missionTrendTone} />
          </div>
        </div>
      </section>

      {/* ── KPI Row ────────────────────────────────────── */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard
            label="Active Guards"
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
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-elevated px-4 py-3">
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
          onClick={() => fetchAnalytics()}
          className="ml-auto flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-info-border"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Refresh
        </button>
      </section>

      {/* ── Charts Row ─────────────────────────────────── */}
      <section aria-label="Analytics charts">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DashboardCard title="Resource Distribution">
            <SimpleBarChart data={barChartData} height={220} barColor="var(--color-info-border)" />
          </DashboardCard>
          <DashboardCard title="Performance Metrics Trend">
            <SimpleLineChart data={lineChartData} height={220} lineColor="var(--color-success-text)" />
          </DashboardCard>
        </div>
      </section>

      {/* ── Performance Metrics ────────────────────────── */}
      <DashboardCard title="Performance Metrics">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <MetricStatCard
            label="Mission Completion"
            value={`${analytics.performance_metrics.mission_completion_rate.toFixed(1)}%`}
            tone="mission"
            hint={formatPointDelta(missionCompletionDelta)}
            trend={getTrendFromDelta(missionCompletionDelta)}
            meter={{
              value: analytics.performance_metrics.mission_completion_rate,
              max: 100,
              label: `Target ${KPI_TARGETS.missionCompletionRate}%`,
            }}
          />
          <MetricStatCard
            label="Guard Attendance"
            value={`${analytics.performance_metrics.guard_attendance_rate.toFixed(1)}%`}
            tone="guard"
            hint={formatPointDelta(guardAttendanceDelta)}
            trend={getTrendFromDelta(guardAttendanceDelta)}
            meter={{
              value: analytics.performance_metrics.guard_attendance_rate,
              max: 100,
              label: `Target ${KPI_TARGETS.guardAttendanceRate}%`,
            }}
          />
          <MetricStatCard
            label="Firearm Availability"
            value={`${analytics.performance_metrics.firearm_availability_rate.toFixed(1)}%`}
            tone="maintenance"
            hint={formatPointDelta(firearmAvailabilityDelta)}
            trend={getTrendFromDelta(firearmAvailabilityDelta)}
            meter={{
              value: analytics.performance_metrics.firearm_availability_rate,
              max: 100,
              label: `Target ${KPI_TARGETS.firearmAvailabilityRate}%`,
            }}
          />
          <MetricStatCard
            label="Vehicle Utilization"
            value={`${analytics.performance_metrics.vehicle_utilization_rate.toFixed(1)}%`}
            tone="vehicle"
            hint={formatPointDelta(vehicleUtilizationDelta)}
            trend={getTrendFromDelta(vehicleUtilizationDelta)}
            meter={{
              value: analytics.performance_metrics.vehicle_utilization_rate,
              max: 100,
              label: `Target ${KPI_TARGETS.vehicleUtilizationRate}%`,
            }}
          />
          <MetricStatCard
            label="Avg Mission Duration"
            value={`${analytics.performance_metrics.average_mission_duration.toFixed(1)}h`}
            tone="analytics"
            hint={`${analytics.mission_stats.average_duration_hours.toFixed(1)}h monthly average`}
          />
        </div>
      </DashboardCard>

      {/* ── Operational Narrative ──────────────────────── */}
      <DashboardCard title="Operational Narrative">
        <div className="space-y-3">
          {operationalInsights.length === 0 ? (
            <p className="text-sm text-text-secondary">No anomalies detected. All tracked operational indicators are inside command thresholds.</p>
          ) : (
            operationalInsights.map((insight) => (
              <article key={insight.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{insight.title}</h3>
                  <StatusBadge label={insight.tone === 'danger' ? 'Immediate' : insight.tone === 'warning' ? 'Watch' : insight.tone === 'analytics' ? 'Forecast' : 'Stable'} tone={insight.tone} />
                </div>
                <p className="mt-2 text-xs text-text-secondary">{insight.detail}</p>
              </article>
            ))
          )}
        </div>
      </DashboardCard>

      {/* ── Mission Statistics ─────────────────────────── */}
      <DashboardCard title="Mission Statistics (This Month)">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard
            label="Total Missions"
            value={formatCompactNumber(analytics.mission_stats.total_missions_this_month)}
            tone="mission"
            meter={{
              value: analytics.mission_stats.total_missions_this_month,
              max: Math.max(analytics.mission_stats.total_missions_this_month, 1),
              label: 'Monthly workload',
            }}
          />
          <MetricStatCard
            label="Completed Missions"
            value={formatCompactNumber(analytics.mission_stats.completed_missions_this_month)}
            tone="guard"
            meter={{
              value: analytics.mission_stats.completed_missions_this_month,
              max: analytics.mission_stats.total_missions_this_month,
              label: formatRatioLabel(
                analytics.mission_stats.completed_missions_this_month,
                analytics.mission_stats.total_missions_this_month,
                'complete',
              ),
            }}
          />
          <MetricStatCard
            label="Pending Missions"
            value={formatCompactNumber(analytics.mission_stats.pending_missions)}
            tone="vehicle"
            meter={{
              value: analytics.mission_stats.pending_missions,
              max: analytics.mission_stats.total_missions_this_month,
              label: formatRatioLabel(
                analytics.mission_stats.pending_missions,
                analytics.mission_stats.total_missions_this_month,
                'pending',
              ),
            }}
          />
          <MetricStatCard
            label="Avg Guards Per Mission"
            value={analytics.mission_stats.average_guards_per_mission.toFixed(1)}
            tone="analytics"
            hint={`${analytics.mission_stats.average_duration_hours.toFixed(1)}h average duration`}
          />
        </div>
      </DashboardCard>

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
