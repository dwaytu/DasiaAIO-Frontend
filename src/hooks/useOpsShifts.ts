import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

export interface OpsShift {
  id: string
  guard_id: string
  guard_name?: string | null
  guard_username?: string
  client_site?: string
  site_name?: string
  start_time?: string
  startTime?: string
  end_time?: string
  updated_at?: string
  status?: string
  missed_check_in?: boolean
  replacement_eligible?: boolean
  replacement_status?: string | null
  replacement_site_id?: string | null
}

interface OpsShiftPage {
  total?: number
  shifts?: OpsShift[]
}

export async function fetchTodayOpsShifts(signal?: AbortSignal): Promise<OpsShift[]> {
  const shifts: OpsShift[] = []
  const headers = getAuthHeaders()
  let page = 1
  while (!signal?.aborted) {
    const params = new URLSearchParams({ scope: 'today', page: String(page), page_size: '200' })
    const response = await fetchJsonOrThrow<OpsShift[] | OpsShiftPage>(
      `${API_BASE_URL}/api/guard-replacement/shifts?${params}`,
      { headers, signal, cache: 'no-store' },
      'Failed to load shifts',
    )
    const batch = Array.isArray(response) ? response : (response.shifts || [])
    shifts.push(...batch)
    if (Array.isArray(response) || !response.total || shifts.length >= response.total || batch.length === 0) break
    page += 1
  }
  return shifts
}

export function useOpsShifts() {
  const [shifts, setShifts] = useState<OpsShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const mounted = useRef(false)
  const request = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!mounted.current) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const { signal } = controller
    try {
      const shifts = await fetchTodayOpsShifts(signal)
      if (signal.aborted) return
      setShifts(shifts)
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      if (signal.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load shifts')
    } finally {
      if (!signal.aborted) setLoading(false)
      if (request.current === controller) request.current = null
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void refresh()
    return () => {
      mounted.current = false
      request.current?.abort()
    }
  }, [refresh])

  return { shifts, loading, error, lastUpdated, refresh }
}
