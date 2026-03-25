import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'

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

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const data = await fetchJsonOrThrow<PredictiveAlert[]>(
        `${API_BASE_URL}/api/alerts/predictive`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Failed to load predictive alerts',
      )
      setAlerts(Array.isArray(data) ? data : [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictive alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { alerts, loading, error, lastUpdated, refresh }
}
