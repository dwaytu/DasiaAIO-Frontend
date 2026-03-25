import { useCallback, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

export interface AuditLogFilters {
  page?: number
  pageSize?: number
  result?: string
  entityType?: string
  actorId?: string
  search?: string
}

export interface AuditLogEntry {
  id: string
  actor_user_id?: string | null
  actor_name?: string | null
  actor_email?: string | null
  actor_role?: string | null
  action_key: string
  entity_type: string
  entity_id?: string | null
  result: string
  reason?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

export interface AuditLogMeta {
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

interface AuditLogResponse {
  items: AuditLogEntry[]
  meta: {
    total: number
    page: number
    page_size: number
    has_more: boolean
  }
}

const BASE_FILTERS: AuditLogFilters = Object.freeze({
  page: 1,
  pageSize: 25,
})

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [meta, setMeta] = useState<AuditLogMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchLogs = useCallback(async (filters: AuditLogFilters = BASE_FILTERS) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      const nextFilters = { ...BASE_FILTERS, ...filters }

      if (nextFilters.page) params.append('page', String(nextFilters.page))
      if (nextFilters.pageSize) params.append('page_size', String(nextFilters.pageSize))
      if (nextFilters.result) params.append('result', nextFilters.result)
      if (nextFilters.entityType) params.append('entity_type', nextFilters.entityType)
      if (nextFilters.actorId) params.append('actor_id', nextFilters.actorId)
      if (nextFilters.search) params.append('search', nextFilters.search)

      const queryString = params.toString()
      const url = queryString ? `${API_BASE_URL}/api/audit-logs?${queryString}` : `${API_BASE_URL}/api/audit-logs`

      const response = await fetchJsonOrThrow<AuditLogResponse>(
        url,
        { headers: getAuthHeaders() },
        'Failed to load audit logs',
        20000,
      )

      setLogs(response.items)
      setMeta({
        total: response.meta.total,
        page: response.meta.page,
        pageSize: response.meta.page_size,
        hasMore: response.meta.has_more,
      })
      setError('')
      return response
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit logs'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    logs,
    meta,
    loading,
    error,
    fetchLogs,
  }
}
