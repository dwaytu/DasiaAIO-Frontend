import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'

interface ClientSite {
  id: string
  name: string
}

interface ClientSitesResponse {
  sites: ClientSite[]
}

export interface ReplacementSuggestion {
  guardId: string
  guardName: string
  reliabilityScore: number
  distanceKm: number
  availability: boolean
  permitValid: boolean
  distanceScore: number
  replacementScore: number
  formula: string
  generatedAt: string
}

interface UseReplacementSuggestionsState {
  postId: string
  postName: string
  suggestions: ReplacementSuggestion[]
  loading: boolean
  error: string
  lastUpdated: string
  refresh: () => Promise<void>
}

export function useReplacementSuggestions(): UseReplacementSuggestionsState {
  const [postId, setPostId] = useState('')
  const [postName, setPostName] = useState('')
  const [suggestions, setSuggestions] = useState<ReplacementSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      let resolvedPostId = postId
      let resolvedPostName = postName

      if (!resolvedPostId) {
        const sitesResponse = await fetchJsonOrThrow<ClientSite[] | ClientSitesResponse>(
          `${API_BASE_URL}/api/tracking/client-sites`,
          { headers },
          'Failed to load client sites for replacement suggestions',
        )

        const sites = Array.isArray(sitesResponse)
          ? sitesResponse
          : Array.isArray((sitesResponse as ClientSitesResponse)?.sites)
            ? (sitesResponse as ClientSitesResponse).sites
            : []

        if (!Array.isArray(sites) || sites.length === 0) {
          setSuggestions([])
          setError('No active client sites available for replacement suggestions')
          return
        }

        resolvedPostId = sites[0].id
        resolvedPostName = sites[0].name
        setPostId(resolvedPostId)
        setPostName(resolvedPostName)
      }

      const data = await fetchJsonOrThrow<ReplacementSuggestion[]>(
        `${API_BASE_URL}/api/ai/replacement-suggestions?post_id=${encodeURIComponent(resolvedPostId)}`,
        { headers },
        'Failed to load smart guard replacement suggestions',
      )

      setSuggestions(Array.isArray(data) ? data : [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load smart guard replacement suggestions')
    } finally {
      setLoading(false)
    }
  }, [postId, postName])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    postId,
    postName,
    suggestions,
    loading,
    error,
    lastUpdated,
    refresh,
  }
}
