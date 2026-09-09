import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

export type PredictiveAlertSeverity = 'info' | 'warning' | 'critical'

export interface PredictiveAlert {
  id: string
  category: string
  severity: PredictiveAlertSeverity
  message: string
  detectedAt: string
  context?: Record<string, unknown> | null
}

interface UsePredictiveAlertsState {
  alerts: PredictiveAlert[]
  loading: boolean
  error: string
  lastUpdated: string
  refresh: () => Promise<void>
}

export function usePredictiveAlerts(): UsePredictiveAlertsState {
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const hasLoadedOnceRef = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!hasLoadedOnceRef.current) {
        setLoading(true)
      }
      const data = await fetchJsonOrThrow<PredictiveAlert[]>(
        `${API_BASE_URL}/api/alerts/operational-risk`,
        { headers: getAuthHeaders(), signal },
        'Failed to load operational alerts',
      )
      setAlerts(Array.isArray(data) ? data : [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load operational alerts')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        hasLoadedOnceRef.current = true
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  return { alerts, loading, error, lastUpdated, refresh }
}
