import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

export interface Incident {
  id: string
  title: string
  description: string
  location: string
  reported_by: string
  reported_by_name?: string
  status: 'open' | 'investigating' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
  updated_at: string
}

export interface CreateIncidentPayload {
  title: string
  description: string
  location: string
  priority: 'low' | 'medium' | 'high' | 'critical'
}

interface IncidentListResponse {
  incidents?: Incident[]
  total?: number
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchJsonOrThrow<Incident[] | IncidentListResponse>(
        `${API_BASE_URL}/api/incidents/active?page=1&page_size=50`,
        { headers: getAuthHeaders() },
        'Failed to load incidents',
      )
      const normalized = Array.isArray(data)
        ? data
        : Array.isArray(data?.incidents)
          ? data.incidents
          : []
      setIncidents(normalized)
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incidents')
    } finally {
      setLoading(false)
    }
  }, [])

  const reportIncident = useCallback(async (payload: CreateIncidentPayload): Promise<void> => {
    await fetchJsonOrThrow<{ id: string }>(
      `${API_BASE_URL}/api/incidents`,
      {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      'Failed to report incident',
    )
    await refresh()
  }, [refresh])

  const updateStatus = useCallback(async (id: string, status: Incident['status']): Promise<void> => {
    await fetchJsonOrThrow<void>(
      `${API_BASE_URL}/api/incidents/${id}/status`,
      {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      },
      'Failed to update incident status',
    )
    await refresh()
  }, [refresh])

  useEffect(() => {
    refresh()
  }, [refresh])

  const activeCount = incidents.filter(
    (i) => i.status === 'open' || i.status === 'investigating',
  ).length

  return { incidents, activeCount, loading, error, lastUpdated, refresh, reportIncident, updateStatus }
}
