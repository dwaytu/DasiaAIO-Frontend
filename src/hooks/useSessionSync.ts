import { useEffect, useRef } from 'react'

const CHANNEL_NAME = 'sentinel-auth-sync'

type SyncMessage =
  | { type: 'logout'; eventId: string }
  | { type: 'login'; eventId: string }

/**
 * Cross-tab session sync using BroadcastChannel with localStorage event fallback.
 * Prevents infinite sync loops using a per-broadcast eventId.
 *
 * @param onLogout - Called when another tab signals logout
 * @param onLogin  - Called when another tab signals login
 */
export function useSessionSync(
  onLogout: () => void,
  onLogin: () => void,
): {
  broadcastLogout: () => void
  broadcastLogin: () => void
} {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const pendingEventsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel

    const handler = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data
      if (!msg || !msg.eventId) return
      // Ignore events we originated
      if (pendingEventsRef.current.has(msg.eventId)) return

      if (msg.type === 'logout') {
        onLogout()
      } else if (msg.type === 'login') {
        onLogin()
      }
    }

    channel.addEventListener('message', handler)

    return () => {
      channel.removeEventListener('message', handler)
      channel.close()
      channelRef.current = null
    }
  }, [onLogout, onLogin])

  // Fallback: listen for storage events when BroadcastChannel is unavailable
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') return

    const handler = (event: StorageEvent) => {
      if (event.key === 'sentinel-auth-logout') {
        onLogout()
      } else if (event.key === 'sentinel-auth-login') {
        onLogin()
      }
    }

    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [onLogout, onLogin])

  const broadcastLogout = () => {
    const eventId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    pendingEventsRef.current.add(eventId)
    // Allow cleanup after 2s
    window.setTimeout(() => pendingEventsRef.current.delete(eventId), 2000)

    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'logout', eventId } satisfies SyncMessage)
    } else {
      // Fallback: toggle a localStorage key to trigger storage event in other tabs
      localStorage.setItem('sentinel-auth-logout', eventId)
      window.setTimeout(() => localStorage.removeItem('sentinel-auth-logout'), 100)
    }
  }

  const broadcastLogin = () => {
    const eventId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    pendingEventsRef.current.add(eventId)
    window.setTimeout(() => pendingEventsRef.current.delete(eventId), 2000)

    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'login', eventId } satisfies SyncMessage)
    } else {
      localStorage.setItem('sentinel-auth-login', eventId)
      window.setTimeout(() => localStorage.removeItem('sentinel-auth-login'), 100)
    }
  }

  return { broadcastLogout, broadcastLogin }
}
