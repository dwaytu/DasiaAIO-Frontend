import { useEffect } from 'react'
import { API_BASE_URL } from '../config'
import { getAuthToken } from '../utils/api'

const PRESENCE_HEARTBEAT_INTERVAL_MS = 120000

export function usePresenceHeartbeat(): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const sendHeartbeat = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      const token = getAuthToken().trim()
      if (!token) {
        return
      }

      // Keep last_seen_at fresh — touch_last_seen middleware runs on any authenticated request.
      void fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => undefined)
    }

    sendHeartbeat()
    const intervalId = window.setInterval(sendHeartbeat, PRESENCE_HEARTBEAT_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])
}
