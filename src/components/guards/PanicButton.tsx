import { FC, useState, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../../config'
import { getAuthToken } from '../../utils/api'
import { enqueueOfflineAction } from '../../utils/offlineQueue'

interface PanicButtonProps {
  userId: string
  userDisplayName?: string
}

type ButtonState = 'idle' | 'sending' | 'sent'

const PanicButton: FC<PanicButtonProps> = ({ userId, userDisplayName }) => {
  const [state, setState] = useState<ButtonState>('idle')
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePanic = useCallback(async () => {
    if (state === 'sending') return

    setState('sending')

    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      // vibration API unsupported — ignore
    }

    let location = 'Location unavailable'
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 3000,
          enableHighAccuracy: true,
        })
      })
      location = `${pos.coords.latitude}, ${pos.coords.longitude}`
    } catch {
      // GPS unavailable or timed out — proceed without location
    }

    const payload = {
      title: '\u{1F6A8} SOS EMERGENCY',
      description: `Emergency panic alert triggered by ${userDisplayName || userId}`,
      location,
      priority: 'critical',
    }

    const token = getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/incidents`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch {
      await enqueueOfflineAction({
        url: `${API_BASE_URL}/api/incidents`,
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: payload,
      })
    }

    setState('sent')

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      setState('idle')
      resetTimerRef.current = null
    }, 3000)
  }, [state, userDisplayName, userId])

  return (
    <div className="fixed bottom-32 right-4 z-40 flex flex-col items-center gap-1">
      <span
        className="absolute inset-0 m-auto h-16 w-16 animate-ping rounded-full bg-red-500 opacity-30"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => void handlePanic()}
        disabled={state === 'sending'}
        aria-label="Emergency SOS — tap to send distress signal"
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white font-black text-lg shadow-lg shadow-red-500/40 transition-transform active:scale-95 focus:outline-2 focus:outline-offset-2 focus:outline-red-400"
      >
        {state === 'idle' && 'SOS'}
        {state === 'sending' && (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        {state === 'sent' && '\u2713'}
      </button>
      {state === 'sent' && (
        <div
          role="status"
          aria-live="assertive"
          className="mt-1 whitespace-nowrap rounded-md bg-green-600 px-2 py-0.5 text-xs font-bold text-white shadow"
        >
          SOS Sent ✓
        </div>
      )}
    </div>
  )
}

export default PanicButton
