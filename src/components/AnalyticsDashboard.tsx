import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'

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

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <section className="command-panel p-6">
        <h2 className="mb-6 text-2xl font-bold uppercase tracking-wide text-text-primary">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bento-card status-bar-info">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-info-text mb-2">Guards</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-black text-text-primary">{analytics.overview.active_guards}</p>
                <p className="text-xs text-text-secondary">Active / {analytics.overview.total_guards} Total</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-secondary">{analytics.resource_utilization.guards_available} Available</p>
              </div>
            </div>
          </div>

          <div className="bento-card status-bar-success">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-success-text mb-2">Missions</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-black text-text-primary">{analytics.overview.active_missions}</p>
                <p className="text-xs text-text-secondary">Active / {analytics.overview.total_missions} Total</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-secondary">{analytics.overview.completed_missions} Completed</p>
              </div>
            </div>
          </div>

          <div className="bento-card status-bar-warning">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-warning-text mb-2">Firearms</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-black text-text-primary">{analytics.overview.allocated_firearms}</p>
                <p className="text-xs text-text-secondary">Allocated / {analytics.overview.total_firearms} Total</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-secondary">{analytics.resource_utilization.firearms_available} Available</p>
              </div>
            </div>
          </div>

          <div className="bento-card status-bar-info">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-info-text mb-2">Vehicles</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-black text-text-primary">{analytics.overview.deployed_vehicles}</p>
                <p className="text-xs text-text-secondary">Deployed / {analytics.overview.total_vehicles} Total</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-secondary">{analytics.resource_utilization.vehicles_available} Available</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Metrics */}
      <section className="command-panel p-6">
        <h2 className="mb-6 text-2xl font-bold uppercase tracking-wide text-text-primary">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="border-l-4 border-green-500 pl-4">
            <p className="text-sm text-text-secondary mb-1">Mission Completion Rate</p>
            <p className="text-3xl font-bold text-text-primary">{analytics.performance_metrics.mission_completion_rate.toFixed(1)}%</p>
          </div>

          <div className="border-l-4 border-blue-500 pl-4">
            <p className="text-sm text-text-secondary mb-1">Guard Attendance Rate</p>
            <p className="text-3xl font-bold text-text-primary">{analytics.performance_metrics.guard_attendance_rate.toFixed(1)}%</p>
          </div>

          <div className="border-l-4 border-purple-500 pl-4">
            <p className="text-sm text-text-secondary mb-1">Firearm Availability</p>
            <p className="text-3xl font-bold text-text-primary">{analytics.performance_metrics.firearm_availability_rate.toFixed(1)}%</p>
          </div>

          <div className="border-l-4 border-orange-500 pl-4">
            <p className="text-sm text-text-secondary mb-1">Vehicle Utilization</p>
            <p className="text-3xl font-bold text-text-primary">{analytics.performance_metrics.vehicle_utilization_rate.toFixed(1)}%</p>
          </div>

          <div className="border-l-4 border-indigo-500 pl-4">
            <p className="text-sm text-text-secondary mb-1">Avg Mission Duration</p>
            <p className="text-3xl font-bold text-text-primary">{analytics.performance_metrics.average_mission_duration.toFixed(1)}<span className="text-lg text-text-secondary">h</span></p>
          </div>
        </div>
      </section>

      {/* Mission Stats */}
      <section className="command-panel p-6">
        <h2 className="mb-6 text-2xl font-bold uppercase tracking-wide text-text-primary">Mission Statistics (This Month)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bento-card text-center status-bar-info">
            <p className="text-4xl font-bold text-indigo-500">{analytics.mission_stats.total_missions_this_month}</p>
            <p className="text-sm text-text-secondary mt-2">Total Missions</p>
          </div>

          <div className="bento-card text-center status-bar-success">
            <p className="text-4xl font-bold text-green-500">{analytics.mission_stats.completed_missions_this_month}</p>
            <p className="text-sm text-text-secondary mt-2">Completed</p>
          </div>

          <div className="bento-card text-center status-bar-warning">
            <p className="text-4xl font-bold text-yellow-500">{analytics.mission_stats.pending_missions}</p>
            <p className="text-sm text-text-secondary mt-2">Pending</p>
          </div>

          <div className="bento-card text-center status-bar-info">
            <p className="text-4xl font-bold text-blue-500">{analytics.mission_stats.average_guards_per_mission.toFixed(1)}</p>
            <p className="text-sm text-text-secondary mt-2">Avg Guards/Mission</p>
          </div>
        </div>
      </section>

      {/* Resource Utilization */}
      <section className="command-panel p-6">
        <h2 className="mb-6 text-2xl font-bold uppercase tracking-wide text-text-primary">Resource Utilization</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary">Firearms</span>
              <span className="text-sm text-text-tertiary">
                {analytics.resource_utilization.firearms_in_use} in use / {analytics.resource_utilization.firearms_in_use + analytics.resource_utilization.firearms_available} total
              </span>
            </div>
            <div className="w-full bg-border rounded-full h-3">
              <div 
                className="bg-purple-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(analytics.resource_utilization.firearms_in_use / (analytics.resource_utilization.firearms_in_use + analytics.resource_utilization.firearms_available)) * 100}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary">Vehicles</span>
              <span className="text-sm text-text-tertiary">
                {analytics.resource_utilization.vehicles_deployed} deployed / {analytics.resource_utilization.vehicles_deployed + analytics.resource_utilization.vehicles_available} total
              </span>
            </div>
            <div className="w-full bg-border rounded-full h-3">
              <div 
                className="bg-orange-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(analytics.resource_utilization.vehicles_deployed / (analytics.resource_utilization.vehicles_deployed + analytics.resource_utilization.vehicles_available)) * 100}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-text-secondary">Guards</span>
              <span className="text-sm text-text-tertiary">
                {analytics.resource_utilization.guards_on_duty} on duty / {analytics.resource_utilization.guards_on_duty + analytics.resource_utilization.guards_available} total
              </span>
            </div>
            <div className="w-full bg-border rounded-full h-3">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(analytics.resource_utilization.guards_on_duty / (analytics.resource_utilization.guards_on_duty + analytics.resource_utilization.guards_available)) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default AnalyticsDashboard
