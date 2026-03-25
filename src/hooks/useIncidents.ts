import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'

export interface Incident {
  id: string
  title: string
  description: string
  location: string
  reported_by: string
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

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const data = await fetchJsonOrThrow<Incident[]>(
        `${API_BASE_URL}/api/incidents/active`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Failed to load incidents',
      )
      setIncidents(Array.isArray(data) ? data : [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incidents')
    } finally {
      setLoading(false)
    }
  }, [])

  const reportIncident = useCallback(async (payload: CreateIncidentPayload): Promise<void> => {
    const token = localStorage.getItem('token')
    await fetchJsonOrThrow<{ id: string }>(
      `${API_BASE_URL}/api/incidents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      'Failed to report incident',
    )
    await refresh()
  }, [refresh])

  const updateStatus = useCallback(async (id: string, status: Incident['status']): Promise<void> => {
    const token = localStorage.getItem('token')
    await fetchJsonOrThrow<void>(
      `${API_BASE_URL}/api/incidents/${id}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
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
