import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

export interface ReplacementSuggestion {
  guardId: string
  guardName: string
  reliabilityScore: number
  distanceKm: number
  distanceKnown?: boolean
  availability: boolean
}

export function useReplacementSuggestions(postId?: string | null, shiftId?: string, shiftVersion?: string) {
  const key = postId && shiftId && shiftVersion ? [postId, shiftId, shiftVersion].join(':') : ''
  const [result, setResult] = useState({ key: '', suggestions: [] as ReplacementSuggestion[], error: '', lastUpdated: '' })

  useEffect(() => {
    if (!key || !postId || !shiftId) return

    let request: AbortController | undefined
    const refresh = async () => {
      request?.abort()
      const controller = new AbortController()
      request = controller
      try {
        const params = new URLSearchParams({ post_id: postId, shift_id: shiftId })
        const suggestions = await fetchJsonOrThrow<ReplacementSuggestion[]>(
          `${API_BASE_URL}/api/analytics/replacement-suggestions?${params}`,
          { headers: getAuthHeaders(), signal: controller.signal, cache: 'no-store' },
          'Failed to load replacement suggestions',
        )
        if (!controller.signal.aborted) setResult({ key, suggestions, error: '', lastUpdated: new Date().toLocaleTimeString() })
      } catch (err) {
        if (!controller.signal.aborted) setResult({ key, suggestions: [], error: err instanceof Error ? err.message : 'Failed to load replacement suggestions', lastUpdated: '' })
      }
    }
    void refresh()
    const interval = window.setInterval(refresh, 15000)
    return () => {
      window.clearInterval(interval)
      request?.abort()
    }
  }, [key, postId, shiftId])

  return result.key === key ? { ...result, loading: false } : { suggestions: [], error: '', lastUpdated: '', loading: Boolean(key) }
}
