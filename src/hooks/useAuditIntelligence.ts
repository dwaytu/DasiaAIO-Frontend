import { useCallback, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

export interface AuditAnomalyRecord {
  type: string
  severity: 'low' | 'medium' | 'high' | string
  actorUserId?: string
  actorName?: string
  sourceIp?: string
  failedCount?: number
  eventTotal?: number
  failedTotal?: number
  bucket?: string
  firstSeen?: string
  lastSeen?: string
  baselineAverage?: number
  baselineStd?: number
}

export interface AuditAnomalyResponse {
  windowHours: number
  total: number
  anomalies: AuditAnomalyRecord[]
}

export interface UserActivityRecord {
  id: string
  actionType: string
  resourceType: string
  resourceId?: string
  status: string
  reason?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown> | null
  timestamp: string
}

export interface UserActivityHeatmapCell {
  hour: number
  count: number
}

export interface UserActivityResponse {
  userId: string
  windowHours: number
  eventCount: number
  timeline: UserActivityRecord[]
  heatmap: UserActivityHeatmapCell[]
}

export function useAuditIntelligence() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchAnomalies = useCallback(async (windowHours = 24) => {
    try {
      setLoading(true)
      const data = await fetchJsonOrThrow<AuditAnomalyResponse>(
        `${API_BASE_URL}/api/audit/anomalies?window_hours=${Math.max(1, Math.min(windowHours, 168))}`,
        { headers: getAuthHeaders() },
        'Failed to load audit anomalies',
      )
      setError('')
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit anomalies'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUserActivity = useCallback(async (userId: string, windowHours = 72, limit = 400) => {
    try {
      setLoading(true)
      const data = await fetchJsonOrThrow<UserActivityResponse>(
        `${API_BASE_URL}/api/audit/user-activity/${encodeURIComponent(userId)}?window_hours=${Math.max(1, Math.min(windowHours, 720))}&limit=${Math.max(20, Math.min(limit, 1500))}`,
        { headers: getAuthHeaders() },
        'Failed to load user activity timeline',
      )
      setError('')
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load user activity timeline'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    fetchAnomalies,
    fetchUserActivity,
  }
}
