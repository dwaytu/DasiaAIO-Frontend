import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'

export interface OpsSummary {
  activeGuardsOnDuty: number
  guardsAbsentToday: number
  pendingGuardApprovals: number
  firearmsCurrentlyIssued: number
  overdueFirearmReturns: number
  activeArmoredCarTrips: number
  vehiclesInMaintenance: number
  expiringGuardPermits: number
}

export function useOpsSummary() {
  const [summary, setSummary] = useState<OpsSummary>({
    activeGuardsOnDuty: 0,
    guardsAbsentToday: 0,
    pendingGuardApprovals: 0,
    firearmsCurrentlyIssued: 0,
    overdueFirearmReturns: 0,
    activeArmoredCarTrips: 0,
    vehiclesInMaintenance: 0,
    expiringGuardPermits: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [shiftsResult, approvalsResult, allocationsResult, overdueResult, tripsResult, vehiclesResult, permitsResult] = await Promise.allSettled([
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/guard-replacement/shifts`, { headers }, 'Failed to load shifts'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/users/pending-approvals`, { headers }, 'Failed to load approvals'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/firearm-allocations/active`, { headers }, 'Failed to load active allocations'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/firearm-allocations/overdue`, { headers }, 'Failed to load overdue allocations'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/trips`, { headers }, 'Failed to load trips'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/armored-cars`, { headers }, 'Failed to load vehicles'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/guard-firearm-permits/expiring`, { headers }, 'Failed to load expiring permits'),
      ])

      const shifts = shiftsResult.status === 'fulfilled' ? (shiftsResult.value.shifts || shiftsResult.value || []) : []
      const approvals = approvalsResult.status === 'fulfilled' ? (approvalsResult.value.users || approvalsResult.value || []) : []
      const activeAllocations = allocationsResult.status === 'fulfilled'
        ? (allocationsResult.value.allocations || allocationsResult.value.activeAllocations || allocationsResult.value || [])
        : []
      const overdueAllocations = overdueResult.status === 'fulfilled'
        ? (overdueResult.value.overdueAllocations || overdueResult.value.allocations || overdueResult.value || [])
        : []
      const trips = tripsResult.status === 'fulfilled' ? (tripsResult.value.trips || tripsResult.value || []) : []
      const vehicles = vehiclesResult.status === 'fulfilled' ? (vehiclesResult.value.armored_cars || vehiclesResult.value.vehicles || vehiclesResult.value || []) : []
      const expiringPermits = permitsResult.status === 'fulfilled' ? (permitsResult.value.permits || permitsResult.value || []) : []

      setSummary({
        activeGuardsOnDuty: shifts.filter((shift: any) => shift.status === 'in_progress').length,
        guardsAbsentToday: shifts.filter((shift: any) => shift.status === 'absent' || shift.status === 'no_show').length,
        pendingGuardApprovals: approvals.length,
        firearmsCurrentlyIssued: activeAllocations.length,
        overdueFirearmReturns: overdueAllocations.length,
        activeArmoredCarTrips: trips.filter((trip: any) => trip.status === 'in_progress' || trip.status === 'active').length,
        vehiclesInMaintenance: vehicles.filter((vehicle: any) => vehicle.status === 'maintenance').length,
        expiringGuardPermits: expiringPermits.length,
      })

      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load command summary')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { summary, loading, error, lastUpdated, refresh }
}
