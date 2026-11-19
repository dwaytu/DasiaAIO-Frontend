import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { logError } from '../utils/logger'

interface FirearmInventorySummary {
  totalFirearms: number
  availableFirearms: number
  maintenanceFirearms: number
  activeCustody: number
  custodyReviewFirearms: number
  pendingCustodyReviewFirearms?: number
}

export function useFirearmInventorySummary() {
  const [summary, setSummary] = useState<FirearmInventorySummary | null>(null)
  const [summaryUnavailable, setSummaryUnavailable] = useState(false)
  const request = useRef<AbortController | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current?.abort()
    }
  }, [])

  const refreshSummary = useCallback(async () => {
    if (!mounted.current) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller

    try {
      const data = await fetchJsonOrThrow<FirearmInventorySummary>(
        `${API_BASE_URL}/api/firearm-allocations/summary`,
        { headers: getAuthHeaders(), signal: controller.signal, cache: 'no-store' },
        'Unable to load firearm inventory summary',
      )
      if (controller.signal.aborted) return
      setSummary(data)
      setSummaryUnavailable(false)
    } catch (error) {
      if (controller.signal.aborted) return
      logError('Error fetching firearm inventory summary:', error)
      setSummaryUnavailable(true)
    } finally {
      if (request.current === controller) request.current = null
    }
  }, [])

  const pendingReviewCount = summaryUnavailable ? undefined : summary?.pendingCustodyReviewFirearms ?? undefined

  return { summary, pendingReviewCount, summaryUnavailable, refreshSummary }
}
