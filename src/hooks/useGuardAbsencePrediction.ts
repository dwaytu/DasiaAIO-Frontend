import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'

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

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const data = await fetchJsonOrThrow<GuardAbsencePrediction[]>(
        `${API_BASE_URL}/api/ai/guard-absence-risk`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Failed to load guard absence predictions',
      )

      setPredictions(Array.isArray(data) ? data : [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guard absence predictions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { predictions, loading, error, lastUpdated, refresh }
}
