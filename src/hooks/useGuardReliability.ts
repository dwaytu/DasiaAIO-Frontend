import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'

export interface GuardReliability {
  guardId: string
  guardName: string
  attendanceScore: number
  missionPerformance: number
  permitCompliance: number
  reliabilityScore: number
  rank: number
}

export function useGuardReliability() {
  const [leaders, setLeaders] = useState<GuardReliability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const data = await fetchJsonOrThrow<GuardReliability[]>(
        `${API_BASE_URL}/api/analytics/guard-reliability`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Failed to load guard reliability data',
      )
      setLeaders(Array.isArray(data) ? data : [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guard reliability data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { leaders, loading, error, lastUpdated, refresh }
}
