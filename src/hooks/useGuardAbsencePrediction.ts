import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

export type GuardAbsenceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface GuardAbsencePrediction {
  guardId: string
  guardName: string
  riskScore: number
  riskLevel: GuardAbsenceRiskLevel
  previousAbsences: number
  lateCheckins: number
  recentLeaveRequests: number
  formula: string
  calculatedAt: string
}

interface UseGuardAbsencePredictionState {
  predictions: GuardAbsencePrediction[]
  loading: boolean
  error: string
  lastUpdated: string
  refresh: () => Promise<void>
}

export function useGuardAbsencePrediction(): UseGuardAbsencePredictionState {
  const [predictions, setPredictions] = useState<GuardAbsencePrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const hasLoadedOnceRef = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!hasLoadedOnceRef.current) {
        setLoading(true)
      }
      const data = await fetchJsonOrThrow<GuardAbsencePrediction[]>(
        `${API_BASE_URL}/api/analytics/guard-absence-risk`,
        { headers: getAuthHeaders(), signal },
        'Failed to load guard absence predictions',
      )

      setPredictions(Array.isArray(data) ? data : [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load guard absence predictions')
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

  return { predictions, loading, error, lastUpdated, refresh }
}
