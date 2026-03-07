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
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg p-4 text-sm">
          <p className="font-semibold">Failed to load analytics data</p>
          <p className="text-xs mt-1">{error}</p>
          <p className="text-xs mt-2 text-red-700">Make sure the backend server is running on port 5000</p>
        </div>
        <button 
          onClick={() => fetchAnalytics()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="bg-zinc-500/15 border border-zinc-500/30 text-text-secondary rounded-lg p-4 text-center">
        <p className="font-medium">No analytics data available</p>
        <p className="text-xs mt-2">Backend is not returning data. Please check server connection.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <section className="bg-surface p-6 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-text-primary mb-6">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800 uppercase mb-2">Guards</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold text-blue-900">{analytics.overview.active_guards}</p>
                <p className="text-xs text-blue-700">Active / {analytics.overview.total_guards} Total</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-800">{analytics.resource_utilization.guards_available} Available</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="text-sm font-semibold text-green-800 uppercase mb-2">Missions</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold text-green-900">{analytics.overview.active_missions}</p>
                <p className="text-xs text-green-700">Active / {analytics.overview.total_missions} Total</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-800">{analytics.overview.completed_missions} Completed</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 className="text-sm font-semibold text-purple-800 uppercase mb-2">Firearms</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold text-purple-900">{analytics.overview.allocated_firearms}</p>
                <p className="text-xs text-purple-700">Allocated / {analytics.overview.total_firearms} Total</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-purple-800">{analytics.resource_utilization.firearms_available} Available</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <h3 className="text-sm font-semibold text-orange-800 uppercase mb-2">Vehicles</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold text-orange-900">{analytics.overview.deployed_vehicles}</p>
                <p className="text-xs text-orange-700">Deployed / {analytics.overview.total_vehicles} Total</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-orange-800">{analytics.resource_utilization.vehicles_available} Available</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Metrics */}
      <section className="bg-surface p-6 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-text-primary mb-6">Performance Metrics</h2>
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
      <section className="bg-surface p-6 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-text-primary mb-6">Mission Statistics (This Month)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-surface-elevated rounded-lg">
            <p className="text-4xl font-bold text-indigo-500">{analytics.mission_stats.total_missions_this_month}</p>
            <p className="text-sm text-text-secondary mt-2">Total Missions</p>
          </div>

          <div className="text-center p-4 bg-surface-elevated rounded-lg">
            <p className="text-4xl font-bold text-green-500">{analytics.mission_stats.completed_missions_this_month}</p>
            <p className="text-sm text-text-secondary mt-2">Completed</p>
          </div>

          <div className="text-center p-4 bg-surface-elevated rounded-lg">
            <p className="text-4xl font-bold text-yellow-500">{analytics.mission_stats.pending_missions}</p>
            <p className="text-sm text-text-secondary mt-2">Pending</p>
          </div>

          <div className="text-center p-4 bg-surface-elevated rounded-lg">
            <p className="text-4xl font-bold text-blue-500">{analytics.mission_stats.average_guards_per_mission.toFixed(1)}</p>
            <p className="text-sm text-text-secondary mt-2">Avg Guards/Mission</p>
          </div>
        </div>
      </section>

      {/* Resource Utilization */}
      <section className="bg-surface p-6 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-text-primary mb-6">Resource Utilization</h2>
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
