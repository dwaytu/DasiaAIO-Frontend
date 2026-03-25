import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'
import SectionHeader from './dashboard/ui/SectionHeader'
import DashboardCard from './dashboard/ui/DashboardCard'
import StatCard from './dashboard/ui/StatCard'
import StatusBadge from './dashboard/ui/StatusBadge'
import Timeline from './dashboard/ui/Timeline'

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

const AnalyticsDashboard: FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          actions={<StatusBadge label={`Completion ${missionCompletion.toFixed(1)}%`} tone={missionTrendTone} />}
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
            <StatCard label="Mission Completion" value={`${analytics.performance_metrics.mission_completion_rate.toFixed(1)}%`} tone="mission" />
            <StatCard label="Guard Attendance" value={`${analytics.performance_metrics.guard_attendance_rate.toFixed(1)}%`} tone="guard" />
            <StatCard label="Firearm Availability" value={`${analytics.performance_metrics.firearm_availability_rate.toFixed(1)}%`} tone="maintenance" />
            <StatCard label="Vehicle Utilization" value={`${analytics.performance_metrics.vehicle_utilization_rate.toFixed(1)}%`} tone="vehicle" />
            <StatCard label="Avg Mission Duration" value={`${analytics.performance_metrics.average_mission_duration.toFixed(1)}h`} tone="analytics" />
          </div>
        </DashboardCard>
        <Timeline title="KPI Trend Snapshot" items={metricTimeline} />
      </div>

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
