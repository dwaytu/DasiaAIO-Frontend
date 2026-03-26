import { useState, useEffect, useMemo, FC } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'
import SectionHeader from './dashboard/ui/SectionHeader'
import DashboardCard from './dashboard/ui/DashboardCard'
import StatCard from './dashboard/ui/StatCard'
import StatusBadge from './dashboard/ui/StatusBadge'
import Timeline from './dashboard/ui/Timeline'
import LiveFreshnessPill from './dashboard/ui/LiveFreshnessPill'

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

const KPI_TARGETS = {
  missionCompletionRate: 90,
  guardAttendanceRate: 95,
  firearmAvailabilityRate: 98,
  vehicleUtilizationRate: 80,
}

function formatPointDelta(value: number): string {
  if (Math.abs(value) < 0.1) return 'On target'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} pts vs target`
}

const AnalyticsDashboard: FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now())

  useEffect(() => {
    fetchAnalytics()
    const interval = setInterval(fetchAnalytics, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token')
      const data = await fetchJsonOrThrow<AnalyticsData>(`${API_BASE_URL}/api/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      }, 'Failed to fetch analytics')

      setAnalytics(data)
      setLastRefreshAt(Date.now())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-text-secondary font-medium">Loading analytics...</div>
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="soc-alert-error">
          <p className="font-semibold">Failed to load analytics data</p>
          <p className="text-xs mt-1">{error}</p>
          <p className="text-xs mt-2">Make sure the backend server is running on port 5000</p>
        </div>
        <button 
          onClick={() => fetchAnalytics()}
          className="soc-btn soc-btn-danger"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="command-panel p-4 text-center text-text-secondary">
        <p className="font-medium">No analytics data available</p>
        <p className="text-xs mt-2">Backend is not returning data. Please check server connection.</p>
      </div>
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

  const operationalInsights = useMemo<InsightItem[]>(() => {
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
  }, [analytics.mission_stats.completed_missions_this_month, analytics.mission_stats.pending_missions, guardAttendanceDelta, missionCompletionDelta, vehicleUtilizationDelta])

  const metricTimeline = [
    {
      id: 'metric-completion',
      title: 'Mission Completion',
      startLabel: `${analytics.performance_metrics.mission_completion_rate.toFixed(1)}%`,
      type: 'mission' as const,
      intensity: analytics.performance_metrics.mission_completion_rate,
    },
    {
      id: 'metric-attendance',
      title: 'Guard Attendance',
      startLabel: `${analytics.performance_metrics.guard_attendance_rate.toFixed(1)}%`,
      type: 'shift' as const,
      intensity: analytics.performance_metrics.guard_attendance_rate,
    },
    {
      id: 'metric-firearms',
      title: 'Firearm Availability',
      startLabel: `${analytics.performance_metrics.firearm_availability_rate.toFixed(1)}%`,
      type: 'maintenance' as const,
      intensity: analytics.performance_metrics.firearm_availability_rate,
    },
    {
      id: 'metric-vehicles',
      title: 'Vehicle Utilization',
      startLabel: `${analytics.performance_metrics.vehicle_utilization_rate.toFixed(1)}%`,
      type: 'trip' as const,
      intensity: analytics.performance_metrics.vehicle_utilization_rate,
    },
  ]

  return (
    <div className="space-y-6">
      <section className="soc-surface p-5">
        <SectionHeader
          title="Operational Intelligence"
          subtitle="Performance and utilization overview refreshed every 30 seconds."
          actions={
            <div className="flex items-center gap-2">
              <LiveFreshnessPill updatedAt={lastRefreshAt} label="Analytics feed" />
              <StatusBadge label={`Completion ${missionCompletion.toFixed(1)}%`} tone={missionTrendTone} />
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active Guards" value={analytics.overview.active_guards} hint={`${analytics.overview.total_guards} total personnel`} tone="guard" />
          <StatCard label="Active Missions" value={analytics.overview.active_missions} hint={`${analytics.overview.completed_missions} completed missions`} tone="mission" />
          <StatCard label="Allocated Firearms" value={analytics.overview.allocated_firearms} hint={`${analytics.overview.total_firearms} total assets`} tone="maintenance" />
          <StatCard label="Deployed Vehicles" value={analytics.overview.deployed_vehicles} hint={`${analytics.overview.total_vehicles} fleet total`} tone="vehicle" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DashboardCard title="Performance Metrics" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Mission Completion"
              value={`${analytics.performance_metrics.mission_completion_rate.toFixed(1)}%`}
              tone="mission"
              hint={formatPointDelta(missionCompletionDelta)}
            />
            <StatCard
              label="Guard Attendance"
              value={`${analytics.performance_metrics.guard_attendance_rate.toFixed(1)}%`}
              tone="guard"
              hint={formatPointDelta(guardAttendanceDelta)}
            />
            <StatCard
              label="Firearm Availability"
              value={`${analytics.performance_metrics.firearm_availability_rate.toFixed(1)}%`}
              tone="maintenance"
              hint={formatPointDelta(firearmAvailabilityDelta)}
            />
            <StatCard
              label="Vehicle Utilization"
              value={`${analytics.performance_metrics.vehicle_utilization_rate.toFixed(1)}%`}
              tone="vehicle"
              hint={formatPointDelta(vehicleUtilizationDelta)}
            />
            <StatCard label="Avg Mission Duration" value={`${analytics.performance_metrics.average_mission_duration.toFixed(1)}h`} tone="analytics" />
          </div>
        </DashboardCard>
        <Timeline title="KPI Trend Snapshot" items={metricTimeline} />
      </div>

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

      <DashboardCard title="Mission Statistics (This Month)">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Missions" value={analytics.mission_stats.total_missions_this_month} tone="mission" />
          <StatCard label="Completed Missions" value={analytics.mission_stats.completed_missions_this_month} tone="guard" />
          <StatCard label="Pending Missions" value={analytics.mission_stats.pending_missions} tone="vehicle" />
          <StatCard label="Avg Guards Per Mission" value={analytics.mission_stats.average_guards_per_mission.toFixed(1)} tone="analytics" />
        </div>
      </DashboardCard>

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
  )
}

export default AnalyticsDashboard
