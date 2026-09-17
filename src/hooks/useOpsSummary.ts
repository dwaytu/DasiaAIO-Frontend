import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'
import { normalizeRole } from '../types/auth'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { useAuth } from './useAuth'

export interface OpsSummary {
  activeGuardsOnDuty: number
  totalApprovedGuards: number | null
  guardsAbsentToday: number
  pendingGuardApprovals: number
  firearmsCurrentlyIssued: number
  overdueFirearmReturns: number
  activeArmoredCarTrips: number
  vehiclesInMaintenance: number
  expiringGuardPermits: number
}

export function useOpsSummary() {
  const { user } = useAuth()
  const viewerRole = normalizeRole(user?.role)
  const canApproveGuards = viewerRole === 'admin' || viewerRole === 'superadmin'
  const [summary, setSummary] = useState<OpsSummary>({
    activeGuardsOnDuty: 0,
    totalApprovedGuards: null,
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
  const hasLoadedOnceRef = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!hasLoadedOnceRef.current) {
        setLoading(true)
      }
      const headers = getAuthHeaders()

      const approvalsRequest = canApproveGuards
        ? fetchJsonOrThrow<any>(`${API_BASE_URL}/api/users/pending-approvals`, { headers, signal }, 'Failed to load approvals')
        : Promise.resolve({ users: [] })

      const [shiftsResult, approvalsResult, guardsResult, allocationsResult, overdueResult, tripsResult, vehiclesResult, permitsResult] = await Promise.allSettled([
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/guard-replacement/shifts`, { headers, signal }, 'Failed to load shifts'),
        approvalsRequest,
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/guards`, { headers, signal }, 'Failed to load approved guards'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/firearm-allocations/active`, { headers, signal }, 'Failed to load active allocations'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/firearm-allocations/overdue`, { headers, signal }, 'Failed to load overdue allocations'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/trips`, { headers, signal }, 'Failed to load trips'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/armored-cars`, { headers, signal }, 'Failed to load vehicles'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/guard-firearm-permits/expiring`, { headers, signal }, 'Failed to load expiring permits'),
      ])

      if (signal?.aborted) return

      const shifts = shiftsResult.status === 'fulfilled' ? (shiftsResult.value.shifts || shiftsResult.value || []) : []
      const approvals = approvalsResult.status === 'fulfilled' ? (approvalsResult.value.users || approvalsResult.value || []) : []
      const guards = guardsResult.status === 'fulfilled'
        ? (Array.isArray(guardsResult.value) ? guardsResult.value : guardsResult.value.guards || [])
        : []
      const activeAllocations = allocationsResult.status === 'fulfilled'
        ? (allocationsResult.value.allocations || allocationsResult.value.activeAllocations || allocationsResult.value || [])
        : []
      const overdueAllocations = overdueResult.status === 'fulfilled'
        ? (overdueResult.value.overdueAllocations || overdueResult.value.allocations || overdueResult.value || [])
        : []
      const trips = tripsResult.status === 'fulfilled' ? (tripsResult.value.trips || tripsResult.value || []) : []
      const vehicles = vehiclesResult.status === 'fulfilled' ? (vehiclesResult.value.armored_cars || vehiclesResult.value.vehicles || vehiclesResult.value || []) : []
      const expiringPermits = permitsResult.status === 'fulfilled' ? (permitsResult.value.permits || permitsResult.value || []) : []

      setSummary((previous) => ({
        activeGuardsOnDuty: shifts.filter((shift: any) => shift.status === 'in_progress').length,
        totalApprovedGuards: guardsResult.status === 'fulfilled' ? guards.length : previous.totalApprovedGuards,
        guardsAbsentToday: shifts.filter((shift: any) => shift.status === 'absent' || shift.status === 'no_show').length,
        pendingGuardApprovals: approvals.length,
        firearmsCurrentlyIssued: activeAllocations.length,
        overdueFirearmReturns: overdueAllocations.length,
        activeArmoredCarTrips: trips.filter((trip: any) => trip.status === 'in_progress' || trip.status === 'active').length,
        vehiclesInMaintenance: vehicles.filter((vehicle: any) => vehicle.status === 'maintenance').length,
        expiringGuardPermits: expiringPermits.length,
      }))

      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load command summary')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        hasLoadedOnceRef.current = true
      }
    }
  }, [canApproveGuards])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  return { summary, loading, error, lastUpdated, refresh }
}
